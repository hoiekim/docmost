import { customAlphabet } from "nanoid";

// Same shape as the server's generateBaseChoiceId (see nanoid.utils.ts) so
// client- and server-minted choice ids are indistinguishable.
const suffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 9);

export function newChoiceId(): string {
  return `opt${suffix()}`;
}

/**
 * Correlates a mutation with the realtime event it triggers. The socket
 * handler skips events carrying an id this client sent, because the
 * mutation already updated the cache from the HTTP response.
 */
export function newRequestId(): string {
  return `req${suffix()}${suffix()}`;
}
