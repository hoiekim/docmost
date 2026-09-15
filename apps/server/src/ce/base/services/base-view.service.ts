import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from '@docmost/db/types/entity.types';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { EventName } from '../../../common/events/event.contants';
import { BaseViewRepo } from '../repos/base-view.repo';
import { BasePage } from '../repos/base-page.repo';
import { viewConfigPatchSchema, viewConfigSchema } from '../engine/schema.zod';
import { applyViewConfigPatch } from '../engine/view-config';
import { CreateViewDto, DeleteViewDto, UpdateViewDto } from '../dto/view.dto';
import {
  BaseViewEvent,
  IBaseView,
  toIBaseView,
  ViewConfig,
  ViewConfigPatch,
} from '../types/base.types';

@Injectable()
export class BaseViewService {
  constructor(
    private readonly viewRepo: BaseViewRepo,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(page: BasePage): Promise<IBaseView[]> {
    const views = await this.viewRepo.findByPage(page.id);
    return views.map(toIBaseView);
  }

  async create(
    page: BasePage,
    user: User,
    dto: CreateViewDto,
    trx?: KyselyTransaction,
  ): Promise<IBaseView> {
    const config = this.parseConfig(dto.config);
    const view = await this.viewRepo.insert(
      {
        pageId: page.id,
        workspaceId: page.workspaceId,
        name: dto.name.trim() || 'View',
        type: dto.type ?? 'table',
        position: await this.viewRepo.nextPosition(page.id, trx),
        config,
        creatorId: user.id,
      },
      trx,
    );
    const result = toIBaseView(view);
    this.eventEmitter.emit(EventName.BASE_VIEW_CREATED, {
      pageId: page.id,
      view: result,
    } satisfies BaseViewEvent);
    return result;
  }

  async update(page: BasePage, dto: UpdateViewDto): Promise<IBaseView> {
    const existing = await this.viewRepo.findById(page.id, dto.viewId);
    if (!existing) throw new NotFoundException('View not found');

    let config: ViewConfig | undefined;
    if (dto.config !== undefined) {
      const patch = this.parseConfigPatch(dto.config);
      config = applyViewConfigPatch(existing.config as ViewConfig, patch);
    }

    const updated = await this.viewRepo.update(page.id, dto.viewId, {
      name: dto.name?.trim() || undefined,
      type: dto.type,
      position: dto.position,
      config,
    });
    const result = toIBaseView(updated);
    this.eventEmitter.emit(EventName.BASE_VIEW_UPDATED, {
      pageId: page.id,
      view: result,
    } satisfies BaseViewEvent);
    return result;
  }

  async delete(page: BasePage, dto: DeleteViewDto): Promise<void> {
    const existing = await this.viewRepo.findById(page.id, dto.viewId);
    if (!existing) throw new NotFoundException('View not found');
    if ((await this.viewRepo.count(page.id)) <= 1) {
      throw new BadRequestException('A base must keep at least one view');
    }
    await this.viewRepo.delete(page.id, dto.viewId);
    this.eventEmitter.emit(EventName.BASE_VIEW_DELETED, {
      pageId: page.id,
      viewId: dto.viewId,
    } satisfies BaseViewEvent);
  }

  private parseConfig(raw: unknown): ViewConfig {
    if (raw === undefined || raw === null) return {};
    const parsed = viewConfigSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException('Invalid view config');
    }
    return parsed.data as ViewConfig;
  }

  private parseConfigPatch(raw: unknown): ViewConfigPatch {
    const parsed = viewConfigPatchSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException('Invalid view config');
    }
    return parsed.data as ViewConfigPatch;
  }
}
