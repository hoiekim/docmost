import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { BadRequestException } from '@nestjs/common';
import { compileFilter } from './filter-compiler';
import { PropLike } from './column-expr';
import { FilterNode } from '../types/base.types';

const db = new Kysely<any>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (d) => new PostgresIntrospector(d),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

const props = new Map<string, PropLike>(
  (
    [
      { id: 'prpText', type: 'text', typeOptions: {} },
      { id: 'prpNum', type: 'number', typeOptions: {} },
      { id: 'prpSel', type: 'select', typeOptions: {} },
      { id: 'prpMulti', type: 'multiSelect', typeOptions: {} },
      { id: 'prpDate', type: 'date', typeOptions: {} },
      { id: 'prpCheck', type: 'checkbox', typeOptions: {} },
      { id: 'prpPerson', type: 'person', typeOptions: { allowMultiple: true } },
      { id: 'prpCreated', type: 'createdAt', typeOptions: {} },
      { id: 'prpEditor', type: 'lastEditedBy', typeOptions: {} },
      { id: 'prpFormula', type: 'formula', typeOptions: { resultType: 'number' } },
    ] as PropLike[]
  ).map((p) => [p.id, p]),
);

const NOW = new Date('2026-09-14T12:00:00Z');

function compile(node: FilterNode) {
  const expr = compileFilter(node, props, NOW);
  if (!expr) return null;
  const q = db.selectFrom('base_rows').selectAll().where(expr).compile();
  return { sql: q.sql, parameters: q.parameters };
}

describe('compileFilter', () => {
  it('returns null for an empty group', () => {
    expect(compileFilter({ op: 'and', children: [] }, props)).toBeNull();
    expect(compileFilter(undefined, props)).toBeNull();
  });

  it('compiles text eq / contains with escaping', () => {
    const eq = compile({ propertyId: 'prpText', op: 'eq', value: 'hi' });
    expect(eq.sql).toContain('base_cell_text(cells, $1) = $2');
    expect(eq.parameters).toEqual(['prpText', 'hi']);

    const contains = compile({ propertyId: 'prpText', op: 'contains', value: '50%' });
    expect(contains.sql).toContain('ilike');
    expect(contains.parameters).toEqual(['prpText', '%50\\%%']);
  });

  it('coerces numeric strings and rejects NaN', () => {
    const gt = compile({ propertyId: 'prpNum', op: 'gt', value: '3' });
    expect(gt.sql).toContain('base_cell_numeric(cells, $1) > $2');
    expect(gt.parameters).toEqual(['prpNum', 3]);

    const nan = compile({ propertyId: 'prpNum', op: 'eq', value: 'abc' });
    expect(nan.sql).toContain('where false');
  });

  it('handles isEmpty per column kind', () => {
    expect(compile({ propertyId: 'prpText', op: 'isEmpty' }).sql).toContain(
      "is null or base_cell_text(cells, $2) = ''",
    );
    expect(compile({ propertyId: 'prpNum', op: 'isNotEmpty' }).sql).toContain(
      'not base_cell_numeric(cells, $1) is null',
    );
    expect(compile({ propertyId: 'prpMulti', op: 'isEmpty' }).sql).toContain(
      'jsonb_array_length',
    );
  });

  it('compiles select any/none against choice ids', () => {
    const any = compile({ propertyId: 'prpSel', op: 'any', value: ['a', 'b'] });
    expect(any.sql).toContain('in ($2, $3)');
    const none = compile({ propertyId: 'prpSel', op: 'none', value: ['a'] });
    expect(none.sql).toContain('is null or');
    expect(none.sql).toContain('not in ($3)');
  });

  it('compiles multi-valued any/all with jsonb operators', () => {
    const any = compile({ propertyId: 'prpMulti', op: 'any', value: ['a', 'b'] });
    expect(any.sql).toContain('?| array[$');
    const all = compile({ propertyId: 'prpPerson', op: 'all', value: ['u1'] });
    expect(all.sql).toContain('?& array[$');
    const eq = compile({ propertyId: 'prpPerson', op: 'eq', value: 'u1' });
    expect(eq.sql).toContain('? $');
  });

  it('compiles date eq as a UTC day range', () => {
    const eq = compile({
      propertyId: 'prpDate',
      op: 'eq',
      value: { mode: 'exact', date: '2026-01-15' },
    });
    expect(eq.sql).toContain('>= $2::timestamptz and base_cell_timestamptz(cells, $3) < $4::timestamptz');
    expect(eq.parameters).toEqual([
      'prpDate',
      '2026-01-15T00:00:00.000Z',
      'prpDate',
      '2026-01-16T00:00:00.000Z',
    ]);
  });

  it('compiles relative and range presets against system columns', () => {
    const before = compile({
      propertyId: 'prpCreated',
      op: 'before',
      value: { mode: 'relative', preset: 'today' },
    });
    expect(before.sql).toContain('created_at < $1::timestamptz');
    expect(before.parameters).toEqual(['2026-09-14T00:00:00.000Z']);

    const within = compile({
      propertyId: 'prpCreated',
      op: 'isWithin',
      value: { mode: 'range', preset: 'thisMonth' },
    });
    expect(within.parameters).toEqual([
      '2026-09-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z',
    ]);
  });

  it('treats a missing checkbox as false', () => {
    const unchecked = compile({ propertyId: 'prpCheck', op: 'eq', value: 'false' });
    expect(unchecked.sql).toContain('coalesce(base_cell_bool(cells, $1), false) = false');
    const checked = compile({ propertyId: 'prpCheck', op: 'eq', value: true });
    expect(checked.sql).toContain('base_cell_bool(cells, $1) = true');
  });

  it('uses the editor column for lastEditedBy', () => {
    const eq = compile({ propertyId: 'prpEditor', op: 'eq', value: 'u1' });
    expect(eq.sql).toContain('coalesce(last_updated_by_id, creator_id)::text = $1');
  });

  it('picks the extractor from a formula result type', () => {
    const lt = compile({ propertyId: 'prpFormula', op: 'lt', value: 10 });
    expect(lt.sql).toContain('base_cell_numeric');
  });

  it('nests and/or groups', () => {
    const out = compile({
      op: 'or',
      children: [
        { propertyId: 'prpText', op: 'eq', value: 'a' },
        {
          op: 'and',
          children: [
            { propertyId: 'prpNum', op: 'gte', value: 1 },
            { propertyId: 'prpNum', op: 'lte', value: 5 },
          ],
        },
      ],
    });
    expect(out.sql).toMatch(/\(.* or \(.* and .*\)\)/);
  });

  it('rejects unknown properties and bad operator/type pairs', () => {
    expect(() =>
      compile({ propertyId: 'nope', op: 'eq', value: 1 }),
    ).toThrow(BadRequestException);
    expect(() =>
      compile({ propertyId: 'prpNum', op: 'contains', value: '1' }),
    ).toThrow(BadRequestException);
    expect(() =>
      compile({ propertyId: 'prpText', op: 'isEmpty', value: 'x' } as any),
    ).not.toThrow();
  });
});
