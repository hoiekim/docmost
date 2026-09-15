import { Injectable } from '@nestjs/common';
import { ENABLED_FEATURES } from './enabled-features';

/**
 * Minimal stand-in for the enterprise LicenseService. The open-source
 * LicenseCheckService resolves this class by name through ModuleRef and calls
 * the four methods below; every workspace gets the fork's enabled feature set.
 */
@Injectable()
export class LicenseService {
  isValidEELicense(_licenseKey: string): boolean {
    return false;
  }

  hasFeature(_licenseKey: string, feature: string): boolean {
    return (ENABLED_FEATURES as readonly string[]).includes(feature);
  }

  getFeatures(_licenseKey: string): string[] {
    return [...ENABLED_FEATURES];
  }

  getLicenseType(_licenseKey: string): string | null {
    return null;
  }
}
