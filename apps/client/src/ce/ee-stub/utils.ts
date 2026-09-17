/**
 * Cloud host helpers. Both callers in `features/auth/hooks/use-auth.ts` are
 * inside `if (isCloud())` branches, which a CE server never takes; the
 * implementations below are only here to keep the shapes honest.
 */
export function getHostnameUrl(hostname: string): string {
  const url = new URL(window.location.origin);
  url.hostname = hostname;
  return url.toString().replace(/\/$/, "");
}

export function exchangeTokenRedirectUrl(
  hostname: string,
  exchangeToken: string,
): string {
  return `${getHostnameUrl(hostname)}/api/auth/exchange?token=${encodeURIComponent(exchangeToken)}`;
}
