import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { dbOrTx } from '@docmost/db/utils';
import { validate as isValidUUID } from 'uuid';
import { ResolvedPage } from '../types/base.types';

/** The page columns the bases feature needs (PageRepo.baseFields lacks baseSchemaVersion). */
export type BasePage = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceId: string;
  workspaceId: string;
  creatorId: string | null;
  parentPageId: string | null;
  isBase: boolean;
  baseSchemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

const PAGE_FIELDS = [
  'id',
  'slugId',
  'title',
  'icon',
  'spaceId',
  'workspaceId',
  'creatorId',
  'parentPageId',
  'isBase',
  'baseSchemaVersion',
  'createdAt',
  'updatedAt',
  'deletedAt',
] as const;

@Injectable()
export class BasePageRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  /** Look a page up by id or slugId. */
  async findPage(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<BasePage | undefined> {
    let query = dbOrTx(this.db, trx).selectFrom('pages').select(PAGE_FIELDS);
    query = isValidUUID(pageId)
      ? query.where('id', '=', pageId)
      : query.where('slugId', '=', pageId);
    return query.executeTakeFirst() as Promise<BasePage | undefined>;
  }

  async getSchemaVersion(pageId: string): Promise<number | null> {
    const row = await this.db
      .selectFrom('pages')
      .select('baseSchemaVersion')
      .where('id', '=', pageId)
      .executeTakeFirst();
    return row?.baseSchemaVersion ?? null;
  }

  async bumpSchemaVersion(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const row = await dbOrTx(this.db, trx)
      .updateTable('pages')
      .set({ baseSchemaVersion: sql`base_schema_version + 1` as any })
      .where('id', '=', pageId)
      .returning('baseSchemaVersion')
      .executeTakeFirstOrThrow();
    return row.baseSchemaVersion;
  }

  async markAsBase(pageId: string, trx?: KyselyTransaction): Promise<number> {
    const row = await dbOrTx(this.db, trx)
      .updateTable('pages')
      .set({
        isBase: true,
        baseSchemaVersion: sql`base_schema_version + 1` as any,
        updatedAt: new Date(),
      })
      .where('id', '=', pageId)
      .returning('baseSchemaVersion')
      .executeTakeFirstOrThrow();
    return row.baseSchemaVersion;
  }

  /** Live pages in a workspace with their space summary, for expand/references. */
  async findResolvedPages(
    pageIds: string[],
    workspaceId: string,
  ): Promise<ResolvedPage[]> {
    if (pageIds.length === 0) return [];
    const rows = await this.db
      .selectFrom('pages')
      .select(['pages.id', 'pages.slugId', 'pages.title', 'pages.icon', 'pages.spaceId'])
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('spaces')
            .select(['spaces.id', 'spaces.slug', 'spaces.name'])
            .whereRef('spaces.id', '=', 'pages.spaceId'),
        ).as('space'),
      )
      .where('pages.id', 'in', pageIds)
      .where('pages.workspaceId', '=', workspaceId)
      .where('pages.deletedAt', 'is', null)
      .execute();
    return rows as ResolvedPage[];
  }

  async listBasePageIdsInSpace(
    spaceId: string,
    workspaceId: string,
  ): Promise<BasePage[]> {
    return this.db
      .selectFrom('pages')
      .select(PAGE_FIELDS)
      .where('spaceId', '=', spaceId)
      .where('workspaceId', '=', workspaceId)
      .where('isBase', '=', true)
      .where('deletedAt', 'is', null)
      .orderBy(sql`position collate "C"`, 'asc')
      .orderBy('id', 'asc')
      .execute() as Promise<BasePage[]>;
  }
}
