import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { User } from '@docmost/db/types/entity.types';
import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { EventName } from '../../../common/events/event.contants';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import { BasePropertyRepo } from '../repos/base-property.repo';
import { BasePage } from '../repos/base-page.repo';
import { isUniqueViolation } from '../repos/repo.utils';
import { typeOptionsSchemaFor } from '../engine/schema.zod';
import { defaultTypeOptionsFor } from '../engine/property-defaults';
import { BaseFormulaService } from './base-formula.service';
import { BaseConversionService } from './base-conversion.service';
import { BaseCellGcJob } from '../jobs/base-job.types';
import {
  CreatePropertyDto,
  DeletePropertyDto,
  ReorderPropertyDto,
  UpdatePropertyDto,
} from '../dto/property.dto';
import {
  BasePropertyEvent,
  BasePropertyType,
  IBaseProperty,
  NON_CONVERSION_TARGET_TYPES,
  SYSTEM_PROPERTY_TYPES,
  toIBaseProperty,
  TypeOptions,
  UpdatePropertyResult,
} from '../types/base.types';

const DUPLICATE_NAME = 'A property with this name already exists';

@Injectable()
export class BasePropertyService {
  constructor(
    private readonly propertyRepo: BasePropertyRepo,
    private readonly formulaService: BaseFormulaService,
    private readonly conversionService: BaseConversionService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(QueueName.BASE_QUEUE) private readonly baseQueue: Queue,
  ) {}

  async list(pageId: string, trx?: KyselyTransaction): Promise<IBaseProperty[]> {
    return (await this.propertyRepo.findAlive(pageId, trx)).map(toIBaseProperty);
  }

  /** Validate typeOptions for a type and merge over that type's defaults. */
  parseTypeOptions(type: BasePropertyType, raw: unknown): TypeOptions {
    const parsed = typeOptionsSchemaFor(type).safeParse(raw ?? {});
    if (!parsed.success) {
      throw new BadRequestException('Invalid property options');
    }
    return { ...defaultTypeOptionsFor(type), ...(parsed.data as TypeOptions) };
  }

  async create(
    page: BasePage,
    user: User,
    dto: CreatePropertyDto,
  ): Promise<IBaseProperty> {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Property name is required');
    if (await this.propertyRepo.nameExists(page.id, name)) {
      throw new BadRequestException(DUPLICATE_NAME);
    }

    const type = dto.type as BasePropertyType;
    const props = await this.list(page.id);
    const typeOptions =
      type === 'formula'
        ? this.formulaService.validate(props, null, dto.typeOptions)
        : this.parseTypeOptions(type, dto.typeOptions);

    let inserted;
    try {
      inserted = await this.propertyRepo.insert({
        pageId: page.id,
        workspaceId: page.workspaceId,
        name,
        type,
        typeOptions,
        position: generateJitteredKeyBetween(
          await this.propertyRepo.lastPosition(page.id),
          null,
        ),
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new BadRequestException(DUPLICATE_NAME);
      throw err;
    }
    const property = toIBaseProperty(inserted);

    if (type === 'formula') {
      await this.formulaService.scheduleBackfill(
        page.id,
        [...props, property],
        [property.id],
      );
    }

    this.eventEmitter.emit(EventName.BASE_PROPERTY_CREATED, {
      pageId: page.id,
      property,
      requestId: dto.requestId ?? null,
    } satisfies BasePropertyEvent);
    return property;
  }

  async update(
    page: BasePage,
    user: User,
    dto: UpdatePropertyDto,
  ): Promise<UpdatePropertyResult> {
    const existing = await this.propertyRepo.findById(page.id, dto.propertyId);
    if (!existing) throw new NotFoundException('Property not found');
    const current = toIBaseProperty(existing);
    const props = await this.list(page.id);

    let name: string | undefined;
    if (dto.name !== undefined) {
      name = dto.name.trim();
      if (!name) throw new BadRequestException('Property name is required');
      if (
        name.toLowerCase() !== current.name.trim().toLowerCase() &&
        (await this.propertyRepo.nameExists(page.id, name, current.id))
      ) {
        throw new BadRequestException(DUPLICATE_NAME);
      }
    }

    const toType = dto.type as BasePropertyType | undefined;
    const isConversion = !!toType && toType !== current.type;

    if (isConversion) {
      this.assertConvertible(current, toType);
      const toTypeOptions = this.parseTypeOptions(toType, dto.typeOptions);
      if (name !== undefined) {
        await this.safeUpdate(page.id, current.id, { name });
      }
      const result = await this.conversionService.requestConversion(
        page.id,
        current,
        toType,
        toTypeOptions,
      );
      this.eventEmitter.emit(EventName.BASE_PROPERTY_UPDATED, {
        pageId: page.id,
        property: result.property,
        requestId: dto.requestId ?? null,
      } satisfies BasePropertyEvent);
      return result;
    }

    let jobId: string | null = null;
    let typeOptions: TypeOptions | undefined;
    let recomputeIds: string[] = [];
    if (dto.typeOptions !== undefined) {
      if (current.type === 'formula') {
        typeOptions = this.formulaService.validate(props, current.id, dto.typeOptions);
        recomputeIds = [current.id];
      } else {
        // Person single/multi toggles need no cell rewrite: readers accept
        // both string and string[] storage.
        typeOptions = this.parseTypeOptions(current.type, dto.typeOptions);
      }
    }

    const updated = await this.safeUpdate(page.id, current.id, {
      name,
      typeOptions,
    });
    const property = toIBaseProperty(updated);

    if (recomputeIds.length > 0) {
      const nextProps = props.map((p) => (p.id === property.id ? property : p));
      const dependents = this.formulaService.affectedFormulaIds(nextProps, [
        property.id,
      ]);
      jobId = await this.formulaService.scheduleBackfill(page.id, nextProps, [
        ...new Set([...recomputeIds, ...dependents]),
      ]);
    }

    this.eventEmitter.emit(EventName.BASE_PROPERTY_UPDATED, {
      pageId: page.id,
      property,
      requestId: dto.requestId ?? null,
    } satisfies BasePropertyEvent);
    return { property, jobId };
  }

  async delete(page: BasePage, dto: DeletePropertyDto): Promise<void> {
    const existing = await this.propertyRepo.findById(page.id, dto.propertyId);
    if (!existing) throw new NotFoundException('Property not found');
    if (existing.isPrimary) {
      throw new BadRequestException('The primary property cannot be deleted');
    }
    const props = await this.list(page.id);

    await this.propertyRepo.softDelete(page.id, dto.propertyId);
    await this.baseQueue.add(QueueJob.BASE_CELL_GC, {
      pageId: page.id,
      propertyId: dto.propertyId,
    } satisfies BaseCellGcJob);

    // Formulas that read the deleted property now yield MISSING_PROP cells.
    const remaining = props.filter((p) => p.id !== dto.propertyId);
    const dependents = this.formulaService.affectedFormulaIds(props, [
      dto.propertyId,
    ]);
    if (dependents.length > 0) {
      await this.formulaService.scheduleBackfill(page.id, remaining, dependents);
    }

    this.eventEmitter.emit(EventName.BASE_PROPERTY_DELETED, {
      pageId: page.id,
      propertyId: dto.propertyId,
      requestId: dto.requestId ?? null,
    } satisfies BasePropertyEvent);
  }

  async reorder(page: BasePage, dto: ReorderPropertyDto): Promise<void> {
    const existing = await this.propertyRepo.findById(page.id, dto.propertyId);
    if (!existing) throw new NotFoundException('Property not found');
    const updated = await this.propertyRepo.update(page.id, dto.propertyId, {
      position: dto.position,
    });
    this.eventEmitter.emit(EventName.BASE_PROPERTY_REORDERED, {
      pageId: page.id,
      property: toIBaseProperty(updated),
      propertyId: dto.propertyId,
      requestId: dto.requestId ?? null,
    } satisfies BasePropertyEvent);
  }

  private assertConvertible(current: IBaseProperty, toType: BasePropertyType) {
    if (current.isPrimary) {
      throw new BadRequestException('The primary property cannot change type');
    }
    if (SYSTEM_PROPERTY_TYPES.includes(current.type) || current.type === 'formula') {
      throw new BadRequestException('This property cannot change type');
    }
    if (NON_CONVERSION_TARGET_TYPES.includes(toType)) {
      throw new BadRequestException(`Cannot convert a property to ${toType}`);
    }
    if (current.pendingType) {
      throw new BadRequestException('A type conversion is already in progress');
    }
  }

  private async safeUpdate(
    pageId: string,
    propertyId: string,
    patch: { name?: string; typeOptions?: TypeOptions },
  ) {
    try {
      return await this.propertyRepo.update(pageId, propertyId, patch);
    } catch (err) {
      if (isUniqueViolation(err)) throw new BadRequestException(DUPLICATE_NAME);
      throw err;
    }
  }
}
