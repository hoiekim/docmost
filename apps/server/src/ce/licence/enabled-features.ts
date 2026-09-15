import { Feature, FeatureKey } from '../../common/features';

/**
 * Feature keys this fork implements on the server. Everything listed here is
 * reported to the client via POST /workspace/entitlements for every workspace,
 * with no license key involved. Add a key only once the server actually serves
 * the feature; otherwise the client will show UI that 404s.
 */
export const ENABLED_FEATURES: readonly FeatureKey[] = [Feature.BASES];
