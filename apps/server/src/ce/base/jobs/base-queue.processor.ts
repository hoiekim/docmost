import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueJob, QueueName } from '../../../integrations/queue/constants';
import { BaseRowRepo } from '../repos/base-row.repo';
import { BasePropertyRepo } from '../repos/base-property.repo';
import { BaseConversionService } from '../services/base-conversion.service';
import { BaseFormulaService } from '../services/base-formula.service';
import { toIBaseProperty } from '../types/base.types';
import {
  BaseCellGcJob,
  BaseFormulaRecomputeJob,
  BaseTypeConversionJob,
} from './base-job.types';

@Processor(QueueName.BASE_QUEUE)
export class BaseQueueProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(BaseQueueProcessor.name);

  constructor(
    private readonly rowRepo: BaseRowRepo,
    private readonly propertyRepo: BasePropertyRepo,
    private readonly conversionService: BaseConversionService,
    private readonly formulaService: BaseFormulaService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case QueueJob.BASE_TYPE_CONVERSION: {
        const { pageId, propertyId, token } = job.data as BaseTypeConversionJob;
        await this.conversionService.convert(pageId, propertyId, { token });
        break;
      }
      case QueueJob.BASE_CELL_GC: {
        const { pageId, propertyId } = job.data as BaseCellGcJob;
        const stripped = await this.rowRepo.stripKey(pageId, propertyId);
        this.logger.debug(`Removed ${propertyId} from ${stripped} rows`);
        await this.conversionService.bumpSchema(pageId);
        break;
      }
      case QueueJob.BASE_FORMULA_RECOMPUTE: {
        const { pageId, propertyIds } = job.data as BaseFormulaRecomputeJob;
        const props = (await this.propertyRepo.findAlive(pageId)).map(
          toIBaseProperty,
        );
        const alive = new Set(props.map((p) => p.id));
        await this.formulaService.backfill(
          pageId,
          props,
          propertyIds.filter((id) => alive.has(id)),
          { jobId: String(job.id ?? '') },
        );
        break;
      }
    }
  }

  @OnWorkerEvent('failed')
  onError(job: Job) {
    this.logger.error(
      `Error processing ${job.name} job. Reason: ${job.failedReason}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
