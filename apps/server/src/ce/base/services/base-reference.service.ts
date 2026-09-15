import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { validate as isValidUUID } from 'uuid';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User } from '@docmost/db/types/entity.types';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { BasePageRepo } from '../repos/base-page.repo';
import {
  IBaseProperty,
  IBaseRow,
  ResolvedPage,
  RowReferences,
  UserRef,
} from '../types/base.types';

/**
 * Resolves the ids stored in person / page cells into the user and page
 * summaries the client renders, respecting the caller's page access.
 */
@Injectable()
export class BaseReferenceService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly basePageRepo: BasePageRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
  ) {}

  async resolveUsers(
    workspaceId: string,
    userIds: Iterable<string>,
  ): Promise<Map<string, UserRef>> {
    const ids = [...new Set(userIds)].filter((id) => isValidUUID(id));
    const out = new Map<string, UserRef>();
    if (ids.length === 0) return out;
    const rows = await this.db
      .selectFrom('users')
      .select(['id', 'name', 'avatarUrl'])
      .where('id', 'in', ids)
      .where('workspaceId', '=', workspaceId)
      .execute();
    for (const r of rows) out.set(r.id, r);
    return out;
  }

  /** Pages the user may see, keyed by id. Inaccessible ids are simply absent. */
  async resolvePages(
    user: User,
    workspaceId: string,
    pageIds: Iterable<string>,
  ): Promise<Map<string, ResolvedPage>> {
    const ids = [...new Set(pageIds)].filter((id) => isValidUUID(id));
    const out = new Map<string, ResolvedPage>();
    if (ids.length === 0) return out;

    const pages = await this.basePageRepo.findResolvedPages(ids, workspaceId);
    if (pages.length === 0) return out;

    const memberSpaceIds = new Set(
      await this.spaceMemberRepo.getUserSpaceIds(user.id),
    );
    const inSpaces = pages.filter((p) => memberSpaceIds.has(p.spaceId));
    if (inSpaces.length === 0) return out;

    const accessible = new Set(
      await this.pagePermissionRepo.filterAccessiblePageIds({
        pageIds: inSpaces.map((p) => p.id),
        userId: user.id,
      }),
    );
    for (const p of inSpaces) {
      if (accessible.has(p.id)) out.set(p.id, p);
    }
    return out;
  }

  async buildRowReferences(
    rows: IBaseRow[],
    props: IBaseProperty[],
    user: User,
    workspaceId: string,
  ): Promise<RowReferences> {
    const userIds = new Set<string>();
    const pageIds = new Set<string>();
    const personProps = props.filter((p) => p.type === 'person');
    const pageProps = props.filter((p) => p.type === 'page');

    for (const row of rows) {
      if (row.creatorId) userIds.add(row.creatorId);
      if (row.lastUpdatedById) userIds.add(row.lastUpdatedById);
      for (const p of personProps) {
        const v = row.cells[p.id];
        if (typeof v === 'string') userIds.add(v);
        else if (Array.isArray(v)) {
          for (const id of v) if (typeof id === 'string') userIds.add(id);
        }
      }
      for (const p of pageProps) {
        const v = row.cells[p.id];
        if (typeof v === 'string') pageIds.add(v);
      }
    }

    const [users, pages] = await Promise.all([
      this.resolveUsers(workspaceId, userIds),
      this.resolvePages(user, workspaceId, pageIds),
    ]);
    return {
      users: Object.fromEntries(users),
      pages: Object.fromEntries(pages),
    };
  }
}
