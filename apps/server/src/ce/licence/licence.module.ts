import { Global, Module } from '@nestjs/common';
import { LicenseService } from './license.service';

@Global()
@Module({
  providers: [LicenseService],
  exports: [LicenseService],
})
export class LicenceModule {}
