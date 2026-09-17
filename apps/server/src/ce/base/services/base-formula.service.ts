import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import {
  BaseFormulaRecomputeJob,
  INLINE_ROW_THRESHOLD,
} from '../jobs/base-job.types';
import {
  AST_VERSION,
  Ast,
  BaseFormulaGraph,
  DEFAULT_MAX_DEPTH,
  EvalContext,
  EvalProperty,
  FormulaParseError,
  MAX_FORMULA_SOURCE_LENGTH,
  evaluate,
  parseRaw,
  registry,
  resolve,
  typecheck,
  isErrorCell,
} from '@docmost/ce-formula/server';
import { EventName } from '../../../common/events/event.contants';
import { projectResultType } from '../engine/formula-types';
import { BaseRowRepo, ROW_BATCH_SIZE } from '../repos/base-row.repo';
import {
  BaseFormulaRecomputeCompletedEvent,
  BaseFormulaRecomputeStartedEvent,
  BaseRowsUpdatedEvent,
  FormulaTypeOptions,
  IBaseProperty,
} from '../types/base.types';

type PropLike = { id: string; type: string; typeOptions: unknown };

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Cap on recompiled ASTs held for formulas stored by an older engine. */
const RECOMPILE_CACHE_LIMIT = 500;

@Injectable()
export class BaseFormulaService {
  private readonly logger = new Logger(BaseFormulaService.name);

  /** `${propertyId}:${source}` → AST, for formulas stored at an older astVersion. */
  private readonly recompiled = new Map<string, Ast | null>();

  constructor(
    private readonly rowRepo: BaseRowRepo,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(QueueName.BASE_QUEUE) private readonly baseQueue: Queue,
  ) {}

  /**
   * Recompute formulas for a whole base: inline for small bases, queued
   * otherwise. Returns the queue job id when queued, null when done inline.
   */
  async scheduleBackfill(
    pageId: string,
    props: IBaseProperty[],
    formulaIds: string[],
  ): Promise<string | null> {
    if (formulaIds.length === 0) return null;
    const count = await this.rowRepo.count(pageId);
    if (count <= INLINE_ROW_THRESHOLD) {
      await this.backfill(pageId, props, formulaIds);
      return null;
    }
    const job = await this.baseQueue.add(QueueJob.BASE_FORMULA_RECOMPUTE, {
      pageId,
      propertyIds: formulaIds,
    } satisfies BaseFormulaRecomputeJob);
    return job.id ? String(job.id) : null;
  }

  /**
   * Re-derive a formula's AST, dependencies and result type from its source
   * against the base's current properties. Throws 400 on any formula error,
   * including cycles. `candidateId` is the property being created/updated
   * (null when creating; the id is not yet known).
   */
  validate(
    props: IBaseProperty[],
    candidateId: string | null,
    typeOptions: Record<string, unknown> | undefined,
  ): FormulaTypeOptions {
    const source = typeof typeOptions?.source === 'string' ? typeOptions.source : '';
    if (source.trim() === '') {
      throw new BadRequestException('Formula is empty');
    }
    if (source.length > MAX_FORMULA_SOURCE_LENGTH) {
      throw new BadRequestException('Formula is too long');
    }

    const others = props.filter((p) => p.id !== candidateId);
    const nameToId = new Map<string, string>();
    const propertyTypes = new Map<string, ReturnType<typeof projectResultType>>();
    for (const p of others) {
      nameToId.set(p.name, p.id);
      propertyTypes.set(p.id, projectResultType(p.type, p.typeOptions));
    }

    try {
      const raw = parseRaw(source);
      const { ast, dependencies } = resolve(raw, nameToId);
      const { resultType } = typecheck(ast, propertyTypes, registry);

      const candidate: PropLike = {
        id: candidateId ?? '__candidate__',
        type: 'formula',
        typeOptions: { dependencies },
      };
      const graph = new BaseFormulaGraph([...others, candidate]);
      const cycle = graph.detectCycle(candidate);
      if (cycle) {
        throw new BadRequestException(
          'Formula would create a circular reference',
        );
      }

      return {
        source,
        ast,
        resultType,
        dependencies,
        astVersion: AST_VERSION,
        ...(typeOptions?.formatOptions && typeof typeOptions.formatOptions === 'object'
          ? { formatOptions: typeOptions.formatOptions as Record<string, unknown> }
          : {}),
      };
    } catch (err) {
      if (err instanceof FormulaParseError) {
        const first = err.errors[0];
        throw new BadRequestException(first?.message ?? 'Invalid formula');
      }
      throw err;
    }
  }

  formulaProps(props: IBaseProperty[]): IBaseProperty[] {
    return props.filter((p) => p.type === 'formula');
  }

  /** Formula property ids (transitively) depending on any of `changedIds`. */
  affectedFormulaIds(props: IBaseProperty[], changedIds: string[]): string[] {
    if (changedIds.length === 0) return [];
    return new BaseFormulaGraph(props).affectedFormulas(changedIds);
  }

  /**
   * Evaluate formulas for one row. Returns a map formulaId → value for the
   * requested ids (or every formula when `onlyIds` is omitted). Nested
   * formulas are evaluated from source by the engine, not read from cells.
   */
  /**
   * The AST to evaluate for a formula property. A formula stored by an older
   * engine (missing or outdated `astVersion`) is recompiled from its `source`
   * so existing bases keep working; the stored copy is refreshed the next time
   * the property is saved. Returns null when the source no longer compiles,
   * for instance because a property it referenced was renamed.
   */
  private astFor(prop: IBaseProperty, props: IBaseProperty[]): Ast | null {
    const opts = prop.typeOptions as FormulaTypeOptions | undefined;
    if (opts?.ast && opts.astVersion === AST_VERSION) return opts.ast as Ast;

    const source = typeof opts?.source === 'string' ? opts.source : '';
    if (source.trim() === '') return null;

    const key = `${prop.id}:${source}`;
    if (this.recompiled.has(key)) return this.recompiled.get(key) ?? null;

    let ast: Ast | null = null;
    try {
      const nameToId = new Map(
        props.filter((p) => p.id !== prop.id).map((p) => [p.name, p.id]),
      );
      ast = resolve(parseRaw(source), nameToId).ast;
    } catch (err) {
      this.logger.warn(
        `Formula ${prop.id} could not be recompiled: ${(err as Error).message}`,
      );
    }

    if (this.recompiled.size >= RECOMPILE_CACHE_LIMIT) this.recompiled.clear();
    this.recompiled.set(key, ast);
    return ast;
  }

  computeRow(
    props: IBaseProperty[],
    cells: Record<string, unknown>,
    onlyIds?: string[],
  ): Record<string, unknown> {
    const formulas = this.formulaProps(props);
    if (formulas.length === 0) return {};
    const wanted = onlyIds ? new Set(onlyIds) : null;

    // Normalize every formula property to a current-version AST up front, so
    // formulas that reference other formulas resolve through the same path.
    const asts = new Map<string, Ast | null>();
    for (const f of formulas) asts.set(f.id, this.astFor(f, props));

    const properties = new Map<string, EvalProperty>(
      props.map((p) => [
        p.id,
        {
          id: p.id,
          type: p.type,
          typeOptions:
            p.type === 'formula'
              ? { ...(p.typeOptions as object), ast: asts.get(p.id), astVersion: AST_VERSION }
              : p.typeOptions,
        },
      ]),
    );

    const ctx: EvalContext = {
      registry,
      properties,
      depth: 0,
      maxDepth: DEFAULT_MAX_DEPTH,
      memo: new Map(),
      now: Date.now(),
    };

    const out: Record<string, unknown> = {};
    for (const f of formulas) {
      if (wanted && !wanted.has(f.id)) continue;
      const ast = asts.get(f.id);
      if (!ast) {
        out[f.id] = null;
        continue;
      }
      try {
        out[f.id] = evaluate(ast, cells, ctx);
      } catch (err) {
        this.logger.warn(`Formula ${f.id} failed: ${(err as Error).message}`);
        out[f.id] = null;
      }
    }
    return out;
  }

  /**
   * Recompute the given formulas for every row of the base, writing only
   * changed values. Emits base:rows:updated per batch and, when a jobId is
   * given, the recompute started/completed events.
   */
  async backfill(
    pageId: string,
    props: IBaseProperty[],
    formulaIds: string[],
    opts: { jobId?: string } = {},
  ): Promise<{ processed: number; errored: number }> {
    let processed = 0;
    let errored = 0;
    if (formulaIds.length === 0) return { processed, errored };

    if (opts.jobId) {
      this.eventEmitter.emit(EventName.BASE_FORMULA_RECOMPUTE_STARTED, {
        pageId,
        propertyIds: formulaIds,
        jobId: opts.jobId,
      } satisfies BaseFormulaRecomputeStartedEvent);
    }

    for await (const batch of this.rowRepo.iterate(pageId, ROW_BATCH_SIZE)) {
      const patches: Array<{ rowId: string; cells: Record<string, unknown> }> = [];
      for (const row of batch) {
        const cells = (row.cells ?? {}) as Record<string, unknown>;
        const values = this.computeRow(props, cells, formulaIds);
        const patch: Record<string, unknown> = {};
        for (const [id, value] of Object.entries(values)) {
          if (isErrorCell(value)) errored++;
          if (!sameValue(cells[id] ?? null, value ?? null)) patch[id] = value;
        }
        if (Object.keys(patch).length > 0) patches.push({ rowId: row.id, cells: patch });
      }
      if (patches.length > 0) {
        await this.rowRepo.patchCellsMany(pageId, patches);
        this.eventEmitter.emit(EventName.BASE_ROWS_UPDATED, {
          pageId,
          rowIds: patches.map((p) => p.rowId),
          propertyIds: formulaIds,
        } satisfies BaseRowsUpdatedEvent);
      }
      processed += batch.length;
    }

    if (opts.jobId) {
      this.eventEmitter.emit(EventName.BASE_FORMULA_RECOMPUTE_COMPLETED, {
        pageId,
        propertyIds: formulaIds,
        jobId: opts.jobId,
        processed,
        errored,
      } satisfies BaseFormulaRecomputeCompletedEvent);
    }
    return { processed, errored };
  }
}
