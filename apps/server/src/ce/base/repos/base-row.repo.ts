import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql, SqlBool } from 'kysely';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { BaseRow } from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { PaginationMeta } from '../types/base.types';
import { FilterSql } from '../engine/filter-compiler';
import { CompiledSort } from '../engine/sort-compiler';
import { decodeOffsetCursor, encodeOffsetCursor, jsonb } from './repo.utils';

export type InsertBaseRowInput = {
  pageId: string;
  workspaceId: string;
  cells: Record<string, unknown>;
  position: string;
  creatorId: string;
};

export type RowListOptions = {
  filter: FilterSql | null;
  sorts: CompiledSort[];
  cursor?: string;
  limit: number;
};

export const ROW_BATCH_SIZE = 500;

@Injectable()
export class BaseRowRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(
    pageId: string,
    rowId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseRow | undefined> {
    return dbOrTx(this.db, trx)
      .selectFrom('baseRows')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('id', '=', rowId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async count(pageId: string, trx?: KyselyTransaction): Promise<number> {
    const row = await dbOrTx(this.db, trx)
      .selectFrom('baseRows')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  async insert(
    input: InsertBaseRowInput,
    trx?: KyselyTransaction,
  ): Promise<BaseRow> {
    return dbOrTx(this.db, trx)
      .insertInto('baseRows')
      .values({
        pageId: input.pageId,
        workspaceId: input.workspaceId,
        cells: jsonb(input.cells) as any,
        position: input.position,
        creatorId: input.creatorId,
        lastUpdatedById: input.creatorId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * Merge a cells patch into the row. A null patch value deletes the key
   * (jsonb_set_many semantics from the bases migration).
   */
  async patchCells(
    pageId: string,
    rowId: string,
    patch: Record<string, unknown>,
    opts: { userId?: string; position?: string; touch?: boolean },
    trx?: KyselyTransaction,
  ): Promise<BaseRow | undefined> {
    const set: Record<string, unknown> = {
      cells: sql`jsonb_set_many(cells, ${jsonb(patch)})`,
    };
    if (opts.touch !== false) {
      set.updatedAt = new Date();
      if (opts.userId) set.lastUpdatedById = opts.userId;
    }
    if (opts.position !== undefined) set.position = opts.position;
    return dbOrTx(this.db, trx)
      .updateTable('baseRows')
      .set(set as any)
      .where('pageId', '=', pageId)
      .where('id', '=', rowId)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();
  }

  /** Apply distinct patches to many rows in one statement (formula backfill). */
  async patchCellsMany(
    pageId: string,
    patches: Array<{ rowId: string; cells: Record<string, unknown> }>,
    trx?: KyselyTransaction,
  ): Promise<void> {
    if (patches.length === 0) return;
    const values = sql.join(
      patches.map((p) => sql`(${p.rowId}::uuid, ${jsonb(p.cells)})`),
    );
    await sql`
      update base_rows as r
      set cells = jsonb_set_many(r.cells, v.patch)
      from (values ${values}) as v(id, patch)
      where r.id = v.id and r.page_id = ${pageId} and r.deleted_at is null
    `.execute(dbOrTx(this.db, trx));
  }

  async setPosition(
    pageId: string,
    rowId: string,
    position: string,
    userId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await dbOrTx(this.db, trx)
      .updateTable('baseRows')
      .set({ position, lastUpdatedById: userId, updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .where('id', '=', rowId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async softDeleteMany(
    pageId: string,
    rowIds: string[],
    trx?: KyselyTransaction,
  ): Promise<string[]> {
    if (rowIds.length === 0) return [];
    const rows = await dbOrTx(this.db, trx)
      .updateTable('baseRows')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .where('id', 'in', rowIds)
      .where('deletedAt', 'is', null)
      .returning('id')
      .execute();
    return rows.map((r) => r.id);
  }

  async lastPosition(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<string | null> {
    const row = await dbOrTx(this.db, trx)
      .selectFrom('baseRows')
      .select('position')
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy(sql`position collate "C"`, 'desc')
      .limit(1)
      .executeTakeFirst();
    return row?.position ?? null;
  }

  async nextPosition(pageId: string, trx?: KyselyTransaction): Promise<string> {
    const last = await this.lastPosition(pageId, trx);
    return generateJitteredKeyBetween(last, null);
  }

  /** Position immediately after `afterRowId` (before its current successor). */
  async positionAfter(
    pageId: string,
    afterRowId: string,
    trx?: KyselyTransaction,
  ): Promise<string> {
    const after = await this.findById(pageId, afterRowId, trx);
    if (!after) return this.nextPosition(pageId, trx);
    const next = await dbOrTx(this.db, trx)
      .selectFrom('baseRows')
      .select('position')
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .where(sql`position collate "C"`, '>', after.position)
      .orderBy(sql`position collate "C"`, 'asc')
      .limit(1)
      .executeTakeFirst();
    return generateJitteredKeyBetween(after.position, next?.position ?? null);
  }

  /** Remove one cell key from every row that has it, in id-ordered batches. */
  async stripKey(pageId: string, propertyId: string): Promise<number> {
    let total = 0;
    let lastId: string | null = null;
    for (;;) {
      let q = this.db
        .selectFrom('baseRows')
        .select('id')
        .where('pageId', '=', pageId)
        .where(sql<SqlBool>`cells ? ${propertyId}`)
        .orderBy('id', 'asc')
        .limit(ROW_BATCH_SIZE);
      if (lastId) q = q.where('id', '>', lastId);
      const ids = (await q.execute()).map((r) => r.id);
      if (ids.length === 0) break;
      await this.db
        .updateTable('baseRows')
        .set({ cells: sql`cells - ${propertyId}` as any })
        .where('id', 'in', ids)
        .execute();
      total += ids.length;
      lastId = ids[ids.length - 1];
      if (ids.length < ROW_BATCH_SIZE) break;
    }
    return total;
  }

  /** Iterate all live rows of a base in id-ordered batches. */
  async *iterate(
    pageId: string,
    batchSize = ROW_BATCH_SIZE,
  ): AsyncGenerator<BaseRow[]> {
    let lastId: string | null = null;
    for (;;) {
      let q = this.db
        .selectFrom('baseRows')
        .selectAll()
        .where('pageId', '=', pageId)
        .where('deletedAt', 'is', null)
        .orderBy('id', 'asc')
        .limit(batchSize);
      if (lastId) q = q.where('id', '>', lastId);
      const rows = await q.execute();
      if (rows.length === 0) return;
      yield rows;
      lastId = rows[rows.length - 1].id;
      if (rows.length < batchSize) return;
    }
  }

  /** Live rows in position order, for export. */
  async *iterateByPosition(
    pageId: string,
    batchSize = ROW_BATCH_SIZE,
  ): AsyncGenerator<BaseRow[]> {
    let last: { position: string; id: string } | null = null;
    for (;;) {
      let q = this.db
        .selectFrom('baseRows')
        .selectAll()
        .where('pageId', '=', pageId)
        .where('deletedAt', 'is', null)
        .orderBy(sql`position collate "C"`, 'asc')
        .orderBy('id', 'asc')
        .limit(batchSize);
      if (last) {
        q = q.where(
          sql<SqlBool>`(position collate "C", id) > (${last.position} collate "C", ${last.id}::uuid)`,
        );
      }
      const rows = await q.execute();
      if (rows.length === 0) return;
      yield rows;
      const tail = rows[rows.length - 1];
      last = { position: tail.position, id: tail.id };
      if (rows.length < batchSize) return;
    }
  }

  async list(
    pageId: string,
    opts: RowListOptions,
  ): Promise<{ items: BaseRow[]; meta: PaginationMeta }> {
    let query = this.db
      .selectFrom('baseRows')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null);
    if (opts.filter) query = query.where(opts.filter);

    if (opts.sorts.length === 0) {
      const result = await executeWithCursorPagination(query, {
        perPage: opts.limit,
        cursor: opts.cursor,
        fields: [
          {
            expression: 'position',
            direction: 'asc',
            orderModifier: (ob) => ob.collate('C').asc(),
            cursorExpression: sql`position collate "C"`,
          },
          { expression: 'id', direction: 'asc' },
        ],
        parseCursor: (cursor) => ({
          position: cursor.position,
          id: cursor.id,
        }),
      });
      return { items: result.items as BaseRow[], meta: result.meta };
    }

    // Sorted listing: keyset over nullable jsonb expressions is fragile, so
    // page with an opaque offset cursor instead.
    const offset = decodeOffsetCursor(opts.cursor);
    for (const s of opts.sorts) query = query.orderBy(s.orderBy as any);
    query = query
      .orderBy(sql`position collate "C"`, 'asc')
      .orderBy('id', 'asc')
      .offset(offset)
      .limit(opts.limit + 1);
    const rows = await query.execute();
    const hasNextPage = rows.length > opts.limit;
    const items = hasNextPage ? rows.slice(0, opts.limit) : rows;
    return {
      items,
      meta: {
        limit: opts.limit,
        hasNextPage,
        hasPrevPage: offset > 0,
        nextCursor: hasNextPage ? encodeOffsetCursor(offset + opts.limit) : null,
        prevCursor:
          offset > 0 ? encodeOffsetCursor(Math.max(0, offset - opts.limit)) : null,
      },
    };
  }
}
