import { ENABLED_FEATURES } from './enabled-features';

/** Cloud-plan lookup used by LicenseCheckService when CLOUD=true. */
export function getFeaturesForCloudPlan(_plan?: string): Set<string> {
  return new Set<string>(ENABLED_FEATURES);
}
