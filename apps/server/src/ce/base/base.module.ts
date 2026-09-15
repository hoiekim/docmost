import { Module } from '@nestjs/common';
import { PageModule } from '../../core/page/page.module';
import { BaseController } from './base.controller';
import { BasePageRepo } from './repos/base-page.repo';
import { BasePropertyRepo } from './repos/base-property.repo';
import { BaseRowRepo } from './repos/base-row.repo';
import { BaseViewRepo } from './repos/base-view.repo';
import { BaseAccessService } from './services/base-access.service';
import { BaseReferenceService } from './services/base-reference.service';
import { BaseFormulaService } from './services/base-formula.service';
import { BaseConversionService } from './services/base-conversion.service';
import { BasePropertyService } from './services/base-property.service';
import { BaseRowService } from './services/base-row.service';
import { BaseViewService } from './services/base-view.service';
import { BaseService } from './services/base.service';
import { BaseCsvService } from './services/base-csv.service';
import { BaseQueueProcessor } from './jobs/base-queue.processor';
import { BaseWsService } from './realtime/base-ws.service';

/**
 * DatabaseModule, CaslModule, PageAccessModule, QueueModule, WsModule and
 * EnvironmentModule are @Global, so only PageModule (PageService) needs an
 * explicit import.
 */
@Module({
  imports: [PageModule],
  controllers: [BaseController],
  providers: [
    BasePageRepo,
    BasePropertyRepo,
    BaseRowRepo,
    BaseViewRepo,
    BaseAccessService,
    BaseReferenceService,
    BaseFormulaService,
    BaseConversionService,
    BasePropertyService,
    BaseRowService,
    BaseViewService,
    BaseService,
    BaseCsvService,
    BaseQueueProcessor,
    BaseWsService,
  ],
  exports: [BaseWsService],
})
export class BaseModule {}
