import type { IPagination, QueryParams } from "@/lib/types.ts";
import { emptyPage } from "../_empty-page";

export interface IApiKey {
  id: string;
  name: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt?: Date;
  creatorId?: string;
  workspaceId?: string;
}

/** API keys are an enterprise feature; CE serves no such list. */
export async function getApiKeys(
  _params?: QueryParams,
): Promise<IPagination<IApiKey>> {
  return emptyPage<IApiKey>();
}
