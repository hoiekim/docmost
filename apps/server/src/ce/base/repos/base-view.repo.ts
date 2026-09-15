import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { BaseView } from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';
import { jsonb } from './repo.utils';

export type InsertBaseViewInput = {
  pageId: string;
  workspaceId: string;
  name: string;
  type: string;
  position: string;
  config: unknown;
  creatorId: string;
};

export type UpdateBaseViewInput = {
  name?: string;
  type?: string;
  config?: unknown;
  position?: string;
};

@Injectable()
export class BaseViewRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findByPage(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseView[]> {
    return dbOrTx(this.db, trx)
      .selectFrom('baseViews')
      .selectAll()
      .where('pageId', '=', pageId)
      .orderBy(sql`position collate "C"`, 'asc')
      .orderBy('id', 'asc')
      .execute();
  }

  async findById(
    pageId: string,
    viewId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseView | undefined> {
    return dbOrTx(this.db, trx)
      .selectFrom('baseViews')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('id', '=', viewId)
      .executeTakeFirst();
  }

  async count(pageId: string, trx?: KyselyTransaction): Promise<number> {
    const row = await dbOrTx(this.db, trx)
      .selectFrom('baseViews')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('pageId', '=', pageId)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async insert(
    input: InsertBaseViewInput,
    trx?: KyselyTransaction,
  ): Promise<BaseView> {
    return dbOrTx(this.db, trx)
      .insertInto('baseViews')
      .values({
        pageId: input.pageId,
        workspaceId: input.workspaceId,
        name: input.name,
        type: input.type,
        position: input.position,
        config: jsonb(input.config ?? {}) as any,
        creatorId: input.creatorId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    pageId: string,
    viewId: string,
    patch: UpdateBaseViewInput,
    trx?: KyselyTransaction,
  ): Promise<BaseView> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.type !== undefined) set.type = patch.type;
    if (patch.position !== undefined) set.position = patch.position;
    if (patch.config !== undefined) set.config = jsonb(patch.config);
    return dbOrTx(this.db, trx)
      .updateTable('baseViews')
      .set(set as any)
      .where('pageId', '=', pageId)
      .where('id', '=', viewId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async delete(
    pageId: string,
    viewId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await dbOrTx(this.db, trx)
      .deleteFrom('baseViews')
      .where('pageId', '=', pageId)
      .where('id', '=', viewId)
      .execute();
  }

  async nextPosition(pageId: string, trx?: KyselyTransaction): Promise<string> {
    const row = await dbOrTx(this.db, trx)
      .selectFrom('baseViews')
      .select('position')
      .where('pageId', '=', pageId)
      .orderBy(sql`position collate "C"`, 'desc')
      .limit(1)
      .executeTakeFirst();
    return generateJitteredKeyBetween(row?.position ?? null, null);
  }
}
