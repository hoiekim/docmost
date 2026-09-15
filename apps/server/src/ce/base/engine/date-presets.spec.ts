import { parseExactDay, resolveDateFilter } from './date-presets';

// Monday 2026-09-14, noon UTC.
const NOW = new Date('2026-09-14T12:00:00Z');
const iso = (r: { start: Date; end: Date } | null) =>
  r ? [r.start.toISOString(), r.end.toISOString()] : null;

describe('date presets', () => {
  it('parses exact days and instants', () => {
    expect(parseExactDay('2026-02-03')?.toISOString()).toBe('2026-02-03T00:00:00.000Z');
    expect(parseExactDay('2026-02-03T23:59:00Z')?.toISOString()).toBe('2026-02-03T00:00:00.000Z');
    expect(parseExactDay('nope')).toBeNull();
  });

  it('resolves bare strings and exact mode to a single day', () => {
    expect(iso(resolveDateFilter('2026-02-03', NOW))).toEqual([
      '2026-02-03T00:00:00.000Z',
      '2026-02-04T00:00:00.000Z',
    ]);
    expect(iso(resolveDateFilter({ mode: 'exact', date: '2026-02-03' }, NOW))).toEqual([
      '2026-02-03T00:00:00.000Z',
      '2026-02-04T00:00:00.000Z',
    ]);
  });

  it('resolves relative anchors', () => {
    const rel = (preset: any) => iso(resolveDateFilter({ mode: 'relative', preset }, NOW));
    expect(rel('today')).toEqual(['2026-09-14T00:00:00.000Z', '2026-09-15T00:00:00.000Z']);
    expect(rel('yesterday')[0]).toBe('2026-09-13T00:00:00.000Z');
    expect(rel('tomorrow')[0]).toBe('2026-09-15T00:00:00.000Z');
    expect(rel('oneWeekAgo')[0]).toBe('2026-09-07T00:00:00.000Z');
    expect(rel('oneWeekFromNow')[0]).toBe('2026-09-21T00:00:00.000Z');
    expect(rel('oneMonthAgo')[0]).toBe('2026-08-14T00:00:00.000Z');
    expect(rel('oneMonthFromNow')[0]).toBe('2026-10-14T00:00:00.000Z');
  });

  it('resolves calendar ranges', () => {
    const range = (preset: any) => iso(resolveDateFilter({ mode: 'range', preset }, NOW));
    expect(range('thisWeek')).toEqual(['2026-09-14T00:00:00.000Z', '2026-09-21T00:00:00.000Z']);
    expect(range('thisMonth')).toEqual(['2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z']);
    expect(range('thisYear')).toEqual(['2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z']);
    expect(range('pastWeek')).toEqual(['2026-09-07T00:00:00.000Z', '2026-09-15T00:00:00.000Z']);
    expect(range('pastMonth')[0]).toBe('2026-08-14T00:00:00.000Z');
    expect(range('pastYear')[0]).toBe('2025-09-14T00:00:00.000Z');
    expect(range('nextWeek')).toEqual(['2026-09-14T00:00:00.000Z', '2026-09-21T00:00:00.000Z']);
    expect(range('nextMonth')[1]).toBe('2026-10-14T00:00:00.000Z');
    expect(range('nextYear')[1]).toBe('2027-09-14T00:00:00.000Z');
  });

  it('starts weeks on Monday', () => {
    const sunday = new Date('2026-09-20T08:00:00Z');
    expect(iso(resolveDateFilter({ mode: 'range', preset: 'thisWeek' }, sunday))).toEqual([
      '2026-09-14T00:00:00.000Z',
      '2026-09-21T00:00:00.000Z',
    ]);
  });

  it('returns null for garbage', () => {
    expect(resolveDateFilter({ mode: 'relative', preset: 'never' }, NOW)).toBeNull();
    expect(resolveDateFilter(42, NOW)).toBeNull();
  });
});
