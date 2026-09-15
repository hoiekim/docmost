import { Global, Module } from '@nestjs/common';
import {
  AUDIT_SERVICE,
  NoopAuditService,
} from '../integrations/audit/audit.service';
import { LicenceModule } from './licence/licence.module';
import { BaseModule } from './base/base.module';

/**
 * app.module.ts drops NoopAuditModule as soon as an EeModule loads, assuming
 * the enterprise bundle brings its own audit service. This fork does not, so
 * the no-op provider is re-registered here; ~20 open-source injectors depend
 * on the AUDIT_SERVICE token.
 */
@Global()
@Module({
  providers: [{ provide: AUDIT_SERVICE, useClass: NoopAuditService }],
  exports: [AUDIT_SERVICE],
})
class AuditShimModule {}

@Module({
  imports: [AuditShimModule, LicenceModule, BaseModule],
})
export class EeModule {}
