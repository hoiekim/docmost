import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectKysely } from 'nestjs-kysely';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { executeTx } from '@docmost/db/utils';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { EventName } from '../../../common/events/event.contants';
import { PageService } from '../../../core/page/services/page.service';
import SpaceAbilityFactory from '../../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../../core/casl/interfaces/space-ability.type';
import { BaseAccessService } from './base-access.service';
import { BasePropertyRepo } from '../repos/base-property.repo';
import { BaseRowRepo } from '../repos/base-row.repo';
import { BaseViewRepo } from '../repos/base-view.repo';
import { BasePage, BasePageRepo } from '../repos/base-page.repo';
import { BaseReferenceService } from './base-reference.service';
import {
  DEFAULT_KANBAN_VIEW_NAME,
  DEFAULT_PRIMARY_NAME,
  DEFAULT_STATUS_NAME,
  DEFAULT_TABLE_VIEW_NAME,
  DEFAULT_TEXT_NAMES,
  defaultStatusTypeOptions,
} from '../engine/property-defaults';
import { CreateBaseDto, ListBasesDto, UpdateBaseDto } from '../dto/base.dto';
import {
  BasePermissions,
  BaseTemplate,
  IBase,
  PaginationMeta,
  ResolvedPage,
  toIBaseProperty,
  toIBaseView,
} from '../types/base.types';
import { decodeOffsetCursor, encodeOffsetCursor } from '../repos/repo.utils';

@Injectable()
export class BaseService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly access: BaseAccessService,
    private readonly basePageRepo: BasePageRepo,
    private readonly propertyRepo: BasePropertyRepo,
    private readonly rowRepo: BaseRowRepo,
    private readonly viewRepo: BaseViewRepo,
    private readonly pageRepo: PageRepo,
    private readonly pageService: PageService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly referenceService: BaseReferenceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Assemble the IBase payload for a page already known to be a base. */
  async getBase(
    page: BasePage,
    permissions?: BasePermissions,
    trx?: KyselyTransaction,
  ): Promise<IBase> {
    const [properties, views] = await Promise.all([
      this.propertyRepo.findAlive(page.id, trx),
      this.viewRepo.findByPage(page.id, trx),
    ]);
    return {
      id: page.id,
      slugId: page.slugId,
      name: page.title ?? '',
      icon: page.icon,
      pageId: page.id,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
      creatorId: page.creatorId,
      properties: properties.map(toIBaseProperty),
      views: views.map(toIBaseView),
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      permissions,
      baseSchemaVersion: page.baseSchemaVersion,
    };
  }

  async create(user: User, workspace: Workspace, dto: CreateBaseDto): Promise<IBase> {
    let spaceId: string;
    let parentPageId: string | undefined;

    if (dto.parentPageId) {
      const parent = await this.access.loadPage(dto.parentPageId, workspace.id);
      await this.access.canEdit(parent, user);
      spaceId = parent.spaceId;
      parentPageId = parent.id;
    } else {
      spaceId = dto.spaceId;
      const ability = await this.spaceAbility.createForUser(user, spaceId);
      if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
        throw new ForbiddenException();
      }
    }

    const pageId = await executeTx(this.db, async (trx) => {
      const page = await this.pageService.create(
        user.id,
        workspace.id,
        {
          spaceId,
          parentPageId,
          title: dto.name?.trim() || undefined,
          icon: dto.icon,
        },
        trx,
        true,
      );
      await this.seedDefaults(page.id, workspace.id, user.id, dto.template, trx);
      return page.id;
    });

    const created = await this.access.loadBase(pageId, workspace.id);
    const base = await this.getBase(created, {
      canEdit: true,
      hasRestriction: false,
    });
    this.eventEmitter.emit(EventName.BASE_CREATED, {
      pageId: base.id,
      spaceId: base.spaceId,
      workspaceId: workspace.id,
    });
    return base;
  }

  /** Turn an existing (empty) page into a base in place. */
  async convert(
    user: User,
    workspace: Workspace,
    pageId: string,
    template?: BaseTemplate,
  ): Promise<IBase> {
    const page = await this.access.loadPage(pageId, workspace.id);
    if (page.isBase) throw new BadRequestException('Page is already a base');
    await this.access.canEdit(page, user);

    await executeTx(this.db, async (trx) => {
      await this.basePageRepo.markAsBase(page.id, trx);
      await this.seedDefaults(page.id, workspace.id, user.id, template, trx);
    });

    const converted = await this.access.loadBase(page.id, workspace.id);
    const permissions = await this.access.canView(converted, user);
    const base = await this.getBase(converted, permissions);
    this.eventEmitter.emit(EventName.BASE_CREATED, {
      pageId: base.id,
      spaceId: base.spaceId,
      workspaceId: workspace.id,
    });
    return base;
  }

  async update(page: BasePage, user: User, dto: UpdateBaseDto): Promise<IBase> {
    const patch: Record<string, unknown> = { lastUpdatedById: user.id };
    if (dto.name !== undefined) patch.title = dto.name;
    if (dto.icon !== undefined) patch.icon = dto.icon;
    await this.pageRepo.updatePage(patch as any, page.id);
    const refreshed = await this.access.loadBase(page.id, page.workspaceId);
    const permissions = await this.access.canView(refreshed, user);
    this.eventEmitter.emit(EventName.BASE_UPDATED, {
      pageId: page.id,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
    });
    return this.getBase(refreshed, permissions);
  }

  /** Bases are pages: deleting moves the page (and its rows) to trash. */
  async delete(page: BasePage, user: User): Promise<void> {
    await this.pageService.removePage(page.id, user.id, page.workspaceId);
    this.eventEmitter.emit(EventName.BASE_DELETED, {
      pageId: page.id,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
    });
  }

  async list(
    user: User,
    workspace: Workspace,
    dto: ListBasesDto,
  ): Promise<{ items: IBase[]; meta: PaginationMeta }> {
    const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
    const pages = await this.basePageRepo.listBasePageIdsInSpace(
      dto.spaceId,
      workspace.id,
    );
    const accessible = new Set(
      await this.pagePermissionRepo.filterAccessiblePageIds({
        pageIds: pages.map((p) => p.id),
        userId: user.id,
        spaceId: dto.spaceId,
      }),
    );
    const visible = pages.filter((p) => accessible.has(p.id));

    const limit = Math.min(Math.max(Number(dto.limit) || 20, 1), 100);
    const offset = decodeOffsetCursor(dto.cursor);
    const slice = visible.slice(offset, offset + limit);
    const items = await Promise.all(slice.map((p) => this.getBase(p)));
    const hasNextPage = offset + limit < visible.length;
    return {
      items,
      meta: {
        limit,
        hasNextPage,
        hasPrevPage: offset > 0,
        nextCursor: hasNextPage ? encodeOffsetCursor(offset + limit) : null,
        prevCursor: offset > 0 ? encodeOffsetCursor(Math.max(0, offset - limit)) : null,
      },
    };
  }

  async expandPages(
    user: User,
    workspace: Workspace,
    pageIds: string[],
  ): Promise<{ items: ResolvedPage[] }> {
    const resolved = await this.referenceService.resolvePages(
      user,
      workspace.id,
      pageIds,
    );
    return { items: [...resolved.values()] };
  }

  /**
   * Seed the layout a new base starts with: Title + two text columns, one
   * empty row and a table view. The kanban template adds a Status property
   * and a kanban view grouped by it.
   */
  private async seedDefaults(
    pageId: string,
    workspaceId: string,
    userId: string,
    template: BaseTemplate | undefined,
    trx: KyselyTransaction,
  ): Promise<void> {
    const existing = await this.propertyRepo.findAlive(pageId, trx);
    if (existing.length > 0) {
      throw new NotFoundException('Base already initialised');
    }

    let position: string | null = null;
    const nextPosition = () => {
      position = generateJitteredKeyBetween(position, null);
      return position;
    };

    await this.propertyRepo.insert(
      {
        pageId,
        workspaceId,
        name: DEFAULT_PRIMARY_NAME,
        type: 'text',
        typeOptions: {},
        position: nextPosition(),
        isPrimary: true,
      },
      trx,
    );
    for (const name of DEFAULT_TEXT_NAMES) {
      await this.propertyRepo.insert(
        { pageId, workspaceId, name, type: 'text', typeOptions: {}, position: nextPosition() },
        trx,
      );
    }

    let statusPropertyId: string | null = null;
    if (template === 'kanban') {
      const status = await this.propertyRepo.insert(
        {
          pageId,
          workspaceId,
          name: DEFAULT_STATUS_NAME,
          type: 'status',
          typeOptions: defaultStatusTypeOptions(),
          position: nextPosition(),
        },
        trx,
      );
      statusPropertyId = status.id;
    }

    await this.rowRepo.insert(
      {
        pageId,
        workspaceId,
        cells: {},
        position: generateJitteredKeyBetween(null, null),
        creatorId: userId,
      },
      trx,
    );

    let viewPosition = generateJitteredKeyBetween(null, null);
    await this.viewRepo.insert(
      {
        pageId,
        workspaceId,
        name: DEFAULT_TABLE_VIEW_NAME,
        type: 'table',
        position: viewPosition,
        config: {},
        creatorId: userId,
      },
      trx,
    );
    if (statusPropertyId) {
      viewPosition = generateJitteredKeyBetween(viewPosition, null);
      await this.viewRepo.insert(
        {
          pageId,
          workspaceId,
          name: DEFAULT_KANBAN_VIEW_NAME,
          type: 'kanban',
          position: viewPosition,
          config: { groupByPropertyId: statusPropertyId },
          creatorId: userId,
        },
        trx,
      );
    }
  }
}
