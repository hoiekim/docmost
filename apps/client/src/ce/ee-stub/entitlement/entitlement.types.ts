/**
 * Response shape of POST /workspace/entitlements, as defined by the
 * open-source `core/workspace/controllers/workspace.controller.ts`:
 *
 *   { cloud: isCloud(), tier: resolveTier(...), features: resolveFeatures(...) }
 *
 * `resolveTier` is typed `string` there and returns "free" on any server
 * without an enterprise license, which includes every CE server.
 */
export type Entitlements = {
  cloud: boolean;
  tier: string;
  features: string[];
};
