import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from '@docmost/db/types/entity.types';
import { EventName } from '../../../common/events/event.contants';
import { BaseRowRepo } from '../repos/base-row.repo';
import { BasePropertyRepo } from '../repos/base-property.repo';
import { BasePage } from '../repos/base-page.repo';
import { normalizeCells } from '../engine/cell-normalizer';
import { compileFilter } from '../engine/filter-compiler';
import { compileSorts } from '../engine/sort-compiler';
import { filterNodeSchema, sortsSchema } from '../engine/schema.zod';
import { BaseFormulaService } from './base-formula.service';
import { BaseReferenceService } from './base-reference.service';
import {
  CreateRowDto,
  DeleteRowDto,
  DeleteRowsDto,
  ListRowsDto,
  ReorderRowDto,
  UpdateRowDto,
} from '../dto/row.dto';
import {
  BaseRowCreatedEvent,
  BaseRowDeletedEvent,
  BaseRowReorderedEvent,
  BaseRowsDeletedEvent,
  BaseRowUpdatedEvent,
  FilterNode,
  IBaseProperty,
  IBaseRow,
  RowsPage,
  toIBaseProperty,
  toIBaseRow,
  ViewSortConfig,
} from '../types/base.types';

export const DEFAULT_ROW_LIMIT = 100;
export const MAX_ROW_LIMIT = 500;

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

@Injectable()
export class BaseRowService {
  constructor(
    private readonly rowRepo: BaseRowRepo,
    private readonly propertyRepo: BasePropertyRepo,
    private readonly formulaService: BaseFormulaService,
    private readonly referenceService: BaseReferenceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async loadProps(pageId: string): Promise<{
    props: IBaseProperty[];
    propsById: Map<string, IBaseProperty>;
  }> {
    const props = (await this.propertyRepo.findAlive(pageId)).map(
      toIBaseProperty,
    );
    return { props, propsById: new Map(props.map((p) => [p.id, p])) };
  }

  async info(page: BasePage, rowId: string): Promise<IBaseRow> {
    const row = await this.rowRepo.findById(page.id, rowId);
    if (!row) throw new NotFoundException('Row not found');
    return toIBaseRow(row);
  }

  async create(page: BasePage, user: User, dto: CreateRowDto): Promise<IBaseRow> {
    const { props, propsById } = await this.loadProps(page.id);
    const cells = normalizeCells(dto.cells, propsById, { applyDefaults: true });
    const formulaValues = this.formulaService.computeRow(props, cells);
    for (const [id, value] of Object.entries(formulaValues)) {
      if (value !== null && value !== undefined) cells[id] = value;
    }

    const position =
      dto.position ??
      (dto.afterRowId
        ? await this.rowRepo.positionAfter(page.id, dto.afterRowId)
        : await this.rowRepo.nextPosition(page.id));

    const row = toIBaseRow(
      await this.rowRepo.insert({
        pageId: page.id,
        workspaceId: page.workspaceId,
        cells,
        position,
        creatorId: user.id,
      }),
    );
    this.eventEmitter.emit(EventName.BASE_ROW_CREATED, {
      pageId: page.id,
      row,
      requestId: dto.requestId ?? null,
    } satisfies BaseRowCreatedEvent);
    return row;
  }

  async update(page: BasePage, user: User, dto: UpdateRowDto): Promise<IBaseRow> {
    const existing = await this.rowRepo.findById(page.id, dto.rowId);
    if (!existing) throw new NotFoundException('Row not found');

    const { props, propsById } = await this.loadProps(page.id);
    const patch = normalizeCells(dto.cells, propsById);
    const current = (existing.cells ?? {}) as Record<string, unknown>;

    // Recompute every formula that (transitively) reads a changed cell.
    const merged: Record<string, unknown> = { ...current };
    for (const [id, value] of Object.entries(patch)) {
      if (value === null) delete merged[id];
      else merged[id] = value;
    }
    const affected = this.formulaService.affectedFormulaIds(
      props,
      Object.keys(patch),
    );
    const formulaValues = this.formulaService.computeRow(props, merged, affected);
    for (const [id, value] of Object.entries(formulaValues)) {
      if (!sameValue(current[id] ?? null, value ?? null)) patch[id] = value;
    }

    const positionChanged =
      dto.position !== undefined && dto.position !== existing.position;
    if (Object.keys(patch).length === 0 && !positionChanged) {
      return toIBaseRow(existing);
    }

    const updated = await this.rowRepo.patchCells(page.id, dto.rowId, patch, {
      userId: user.id,
      position: positionChanged ? dto.position : undefined,
    });
    if (!updated) throw new NotFoundException('Row not found');

    if (Object.keys(patch).length > 0) {
      this.eventEmitter.emit(EventName.BASE_ROW_UPDATED, {
        pageId: page.id,
        rowId: dto.rowId,
        updatedCells: patch,
        requestId: dto.requestId ?? null,
      } satisfies BaseRowUpdatedEvent);
    }
    if (positionChanged) {
      this.eventEmitter.emit(EventName.BASE_ROW_REORDERED, {
        pageId: page.id,
        rowId: dto.rowId,
        position: dto.position,
        requestId: dto.requestId ?? null,
      } satisfies BaseRowReorderedEvent);
    }
    return toIBaseRow(updated);
  }

  async delete(page: BasePage, dto: DeleteRowDto): Promise<void> {
    const deleted = await this.rowRepo.softDeleteMany(page.id, [dto.rowId]);
    if (deleted.length === 0) throw new NotFoundException('Row not found');
    this.eventEmitter.emit(EventName.BASE_ROW_DELETED, {
      pageId: page.id,
      rowId: dto.rowId,
      requestId: dto.requestId ?? null,
    } satisfies BaseRowDeletedEvent);
  }

  async deleteMany(page: BasePage, dto: DeleteRowsDto): Promise<void> {
    const deleted = await this.rowRepo.softDeleteMany(page.id, dto.rowIds);
    if (deleted.length === 0) return;
    this.eventEmitter.emit(EventName.BASE_ROWS_DELETED, {
      pageId: page.id,
      rowIds: deleted,
      requestId: dto.requestId ?? null,
    } satisfies BaseRowsDeletedEvent);
  }

  async reorder(page: BasePage, user: User, dto: ReorderRowDto): Promise<void> {
    const existing = await this.rowRepo.findById(page.id, dto.rowId);
    if (!existing) throw new NotFoundException('Row not found');
    await this.rowRepo.setPosition(page.id, dto.rowId, dto.position, user.id);
    this.eventEmitter.emit(EventName.BASE_ROW_REORDERED, {
      pageId: page.id,
      rowId: dto.rowId,
      position: dto.position,
      requestId: dto.requestId ?? null,
    } satisfies BaseRowReorderedEvent);
  }

  async list(page: BasePage, user: User, dto: ListRowsDto): Promise<RowsPage> {
    const { props, propsById } = await this.loadProps(page.id);

    let filter: FilterNode | null = null;
    if (dto.filter !== undefined && dto.filter !== null) {
      const parsed = filterNodeSchema.safeParse(dto.filter);
      if (!parsed.success) throw new BadRequestException('Invalid filter');
      filter = parsed.data as FilterNode;
    }
    let sorts: ViewSortConfig[] = [];
    if (dto.sorts !== undefined && dto.sorts !== null) {
      const parsed = sortsSchema.safeParse(dto.sorts);
      if (!parsed.success) throw new BadRequestException('Invalid sorts');
      sorts = parsed.data;
    }

    const limit = Math.min(
      Math.max(dto.limit ?? DEFAULT_ROW_LIMIT, 1),
      MAX_ROW_LIMIT,
    );
    const { items, meta } = await this.rowRepo.list(page.id, {
      filter: compileFilter(filter, propsById),
      sorts: compileSorts(sorts, propsById),
      cursor: dto.cursor,
      limit,
    });
    const rows = items.map(toIBaseRow);
    const references = await this.referenceService.buildRowReferences(
      rows,
      props,
      user,
      page.workspaceId,
    );
    return { items: rows, meta, references };
  }
}
