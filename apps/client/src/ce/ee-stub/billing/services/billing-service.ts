/** Cloud billing. CE has no billing, so there is nothing to report. */
export async function getBilling(): Promise<any> {
  return null;
}

export async function getBillingPlans(): Promise<any[]> {
  return [];
}
