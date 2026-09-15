import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB, KyselyTransaction } from '@docmost/db/types/kysely.types';
import { BaseProperty } from '@docmost/db/types/entity.types';
import { dbOrTx } from '@docmost/db/utils';
import { generateBasePropertyId } from '../../../common/helpers/nanoid.utils';
import { jsonb } from './repo.utils';

export type InsertBasePropertyInput = {
  pageId: string;
  workspaceId: string;
  name: string;
  type: string;
  position: string;
  typeOptions: unknown;
  isPrimary?: boolean;
};

export type UpdateBasePropertyInput = {
  name?: string;
  type?: string;
  typeOptions?: unknown;
  pendingType?: string | null;
  pendingTypeOptions?: unknown | null;
  pendingToken?: string | null;
  position?: string;
  bumpSchemaVersion?: boolean;
};

@Injectable()
export class BasePropertyRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findAlive(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseProperty[]> {
    return dbOrTx(this.db, trx)
      .selectFrom('baseProperties')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy(sql`position collate "C"`, 'asc')
      .orderBy('id', 'asc')
      .execute();
  }

  async findById(
    pageId: string,
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<BaseProperty | undefined> {
    return dbOrTx(this.db, trx)
      .selectFrom('baseProperties')
      .selectAll()
      .where('pageId', '=', pageId)
      .where('id', '=', propertyId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async insert(
    input: InsertBasePropertyInput,
    trx?: KyselyTransaction,
  ): Promise<BaseProperty> {
    return dbOrTx(this.db, trx)
      .insertInto('baseProperties')
      .values({
        id: generateBasePropertyId(),
        pageId: input.pageId,
        workspaceId: input.workspaceId,
        name: input.name,
        type: input.type,
        position: input.position,
        typeOptions: jsonb(input.typeOptions ?? {}) as any,
        isPrimary: input.isPrimary ?? false,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(
    pageId: string,
    propertyId: string,
    patch: UpdateBasePropertyInput,
    trx?: KyselyTransaction,
  ): Promise<BaseProperty> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.type !== undefined) set.type = patch.type;
    if (patch.position !== undefined) set.position = patch.position;
    if (patch.typeOptions !== undefined) {
      set.typeOptions = jsonb(patch.typeOptions);
    }
    if (patch.pendingType !== undefined) set.pendingType = patch.pendingType;
    if (patch.pendingTypeOptions !== undefined) {
      set.pendingTypeOptions =
        patch.pendingTypeOptions === null
          ? null
          : jsonb(patch.pendingTypeOptions);
    }
    if (patch.pendingToken !== undefined) set.pendingToken = patch.pendingToken;
    if (patch.bumpSchemaVersion) {
      set.schemaVersion = sql`schema_version + 1`;
    }
    return dbOrTx(this.db, trx)
      .updateTable('baseProperties')
      .set(set as any)
      .where('pageId', '=', pageId)
      .where('id', '=', propertyId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async softDelete(
    pageId: string,
    propertyId: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    await dbOrTx(this.db, trx)
      .updateTable('baseProperties')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('pageId', '=', pageId)
      .where('id', '=', propertyId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async lastPosition(
    pageId: string,
    trx?: KyselyTransaction,
  ): Promise<string | null> {
    const row = await dbOrTx(this.db, trx)
      .selectFrom('baseProperties')
      .select('position')
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .orderBy(sql`position collate "C"`, 'desc')
      .limit(1)
      .executeTakeFirst();
    return row?.position ?? null;
  }

  async nameExists(
    pageId: string,
    name: string,
    excludePropertyId?: string,
    trx?: KyselyTransaction,
  ): Promise<boolean> {
    const normalized = name.trim().toLowerCase();
    let query = dbOrTx(this.db, trx)
      .selectFrom('baseProperties')
      .select('id')
      .where('pageId', '=', pageId)
      .where('deletedAt', 'is', null)
      .where(sql`lower(trim(name))`, '=', normalized);
    if (excludePropertyId) {
      query = query.where('id', '!=', excludePropertyId);
    }
    const row = await query.limit(1).executeTakeFirst();
    return !!row;
  }
}
