import { RawBuilder, sql } from 'kysely';

/**
 * Bind a JS value as a jsonb parameter. Going through ::text avoids relying
 * on the driver's json serialization (which would double-encode strings).
 */
export function jsonb(value: unknown): RawBuilder<unknown> {
  return sql`${JSON.stringify(value ?? null)}::text::jsonb`;
}

/** postgres unique_violation */
export function isUniqueViolation(err: unknown): boolean {
  return (err as any)?.code === '23505';
}

export function encodeOffsetCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), 'utf8').toString(
    'base64url',
  );
}

export function decodeOffsetCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    const o = Number(parsed?.o);
    return Number.isInteger(o) && o >= 0 ? o : 0;
  } catch {
    return 0;
  }
}
