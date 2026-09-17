import type { IPagination } from "@/lib/types.ts";
import { emptyPage } from "../../_empty-page";

/** Enterprise-only list endpoint; CE serves nothing here. */
export async function getVerificationList(_params?: any): Promise<IPagination<any>> {
  return emptyPage<any>();
}
