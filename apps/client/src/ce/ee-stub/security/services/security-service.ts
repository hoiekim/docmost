import type { IAuthProvider } from "../types/security.types";

/** SSO providers. CE implements no SSO, so there are never any. */
export async function getSsoProviders(): Promise<IAuthProvider[]> {
  return [];
}
