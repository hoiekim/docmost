import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v7 as uuidv7 } from 'uuid';
import { EventName } from '../../../common/events/event.contants';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import { BasePropertyRepo } from '../repos/base-property.repo';
import { BaseRowRepo, ROW_BATCH_SIZE } from '../repos/base-row.repo';
import { BasePageRepo } from '../repos/base-page.repo';
import { convertCell } from '../engine/cell-converter';
import { RenderRefs } from '../engine/cell-renderer';
import { BaseFormulaService } from './base-formula.service';
import { BaseReferenceService } from './base-reference.service';
import {
  BaseTypeConversionJob,
  INLINE_ROW_THRESHOLD,
} from '../jobs/base-job.types';
import {
  BasePropertyType,
  BaseSchemaBumpedEvent,
  IBaseProperty,
  toIBaseProperty,
  TypeOptions,
  UpdatePropertyResult,
} from '../types/base.types';

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

@Injectable()
export class BaseConversionService {
  private readonly logger = new Logger(BaseConversionService.name);

  constructor(
    private readonly propertyRepo: BasePropertyRepo,
    private readonly rowRepo: BaseRowRepo,
    private readonly basePageRepo: BasePageRepo,
    private readonly formulaService: BaseFormulaService,
    private readonly referenceService: BaseReferenceService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(QueueName.BASE_QUEUE) private readonly baseQueue: Queue,
  ) {}

  /** Increment pages.base_schema_version and tell subscribers to refetch. */
  async bumpSchema(pageId: string): Promise<number> {
    const schemaVersion = await this.basePageRepo.bumpSchemaVersion(pageId);
    this.eventEmitter.emit(EventName.BASE_SCHEMA_BUMPED, {
      pageId,
      schemaVersion,
    } satisfies BaseSchemaBumpedEvent);
    return schemaVersion;
  }

  /**
   * Change a property's type. Small bases convert synchronously and return
   * the property with its new type (jobId null). Large bases mark the
   * property pending and enqueue the conversion; the client shows a
   * "Converting…" badge until base:schema:bumped arrives.
   */
  async requestConversion(
    pageId: string,
    property: IBaseProperty,
    toType: BasePropertyType,
    toTypeOptions: TypeOptions,
  ): Promise<UpdatePropertyResult> {
    const count = await this.rowRepo.count(pageId);
    if (count <= INLINE_ROW_THRESHOLD) {
      await this.convert(pageId, property.id, { toType, toTypeOptions });
      const updated = await this.propertyRepo.findById(pageId, property.id);
      return { property: toIBaseProperty(updated), jobId: null };
    }

    const token = uuidv7();
    const pending = await this.propertyRepo.update(pageId, property.id, {
      pendingType: toType,
      pendingTypeOptions: toTypeOptions,
      pendingToken: token,
    });
    const job = await this.baseQueue.add(QueueJob.BASE_TYPE_CONVERSION, {
      pageId,
      propertyId: property.id,
      token,
    } satisfies BaseTypeConversionJob);
    return {
      property: toIBaseProperty(pending),
      jobId: job.id ? String(job.id) : 'queued',
    };
  }

  /**
   * Rewrite every cell of the property, then flip its type. When `token` is
   * given (queued mode) the target comes from the pending_* columns and a
   * token mismatch means a newer request superseded this job.
   */
  async convert(
    pageId: string,
    propertyId: string,
    opts: { toType?: BasePropertyType; toTypeOptions?: TypeOptions; token?: string },
  ): Promise<void> {
    const prop = await this.propertyRepo.findById(pageId, propertyId);
    if (!prop) return;

    let toType = opts.toType;
    let toTypeOptions = opts.toTypeOptions;
    if (opts.token) {
      if (prop.pendingToken !== opts.token || !prop.pendingType) {
        this.logger.debug(`Skipping stale conversion job for ${propertyId}`);
        return;
      }
      toType = prop.pendingType as BasePropertyType;
      toTypeOptions = (prop.pendingTypeOptions ?? {}) as TypeOptions;
    }
    if (!toType) return;

    const fromProp = toIBaseProperty(prop);
    const allProps = (await this.propertyRepo.findAlive(pageId)).map(
      toIBaseProperty,
    );

    for await (const batch of this.rowRepo.iterate(pageId, ROW_BATCH_SIZE)) {
      const refs = await this.refsForBatch(fromProp, batch, prop.workspaceId);
      const patches: Array<{ rowId: string; cells: Record<string, unknown> }> = [];
      for (const row of batch) {
        const cells = (row.cells ?? {}) as Record<string, unknown>;
        if (!(propertyId in cells)) continue;
        const next = convertCell(cells[propertyId], fromProp, toType, toTypeOptions, {
          refs,
        });
        if (!sameValue(cells[propertyId], next ?? null)) {
          patches.push({ rowId: row.id, cells: { [propertyId]: next ?? null } });
        }
      }
      if (patches.length > 0) {
        await this.rowRepo.patchCellsMany(pageId, patches);
      }
    }

    const updated = await this.propertyRepo.update(pageId, propertyId, {
      type: toType,
      typeOptions: toTypeOptions ?? {},
      pendingType: null,
      pendingTypeOptions: null,
      pendingToken: null,
      bumpSchemaVersion: true,
    });

    // Formulas reading this property were typechecked against the old type.
    const propsAfter = allProps.map((p) =>
      p.id === propertyId ? toIBaseProperty(updated) : p,
    );
    const dependents = this.formulaService.affectedFormulaIds(propsAfter, [
      propertyId,
    ]);
    if (dependents.length > 0) {
      await this.formulaService.backfill(pageId, propsAfter, dependents);
    }

    await this.bumpSchema(pageId);
  }

  /** User / page summaries needed to stringify person and page cells. */
  private async refsForBatch(
    fromProp: IBaseProperty,
    batch: Array<{ cells: unknown }>,
    workspaceId: string,
  ): Promise<RenderRefs> {
    const ids = new Set<string>();
    for (const row of batch) {
      const v = (row.cells as Record<string, unknown>)?.[fromProp.id];
      if (typeof v === 'string') ids.add(v);
      else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') ids.add(x);
    }
    if (fromProp.type === 'person') {
      return {
        users: await this.referenceService.resolveUsers(workspaceId, ids),
        pages: new Map(),
      };
    }
    if (fromProp.type === 'page') {
      const pages = await this.basePageRepo.findResolvedPages(
        [...ids].filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
        workspaceId,
      );
      return { users: new Map(), pages: new Map(pages.map((p) => [p.id, p])) };
    }
    return { users: new Map(), pages: new Map() };
  }
}
