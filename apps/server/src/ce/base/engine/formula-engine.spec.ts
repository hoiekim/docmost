import {
  AST_VERSION,
  BaseFormulaGraph,
  DEFAULT_MAX_DEPTH,
  EvalContext,
  EvalProperty,
  FormulaParseError,
  evaluate,
  isErrorCell,
  parseRaw,
  registry,
  resolve,
  typecheck,
  valueToString,
} from '@docmost/ce-formula/server';

type Prop = { id: string; name: string; type: string; typeOptions?: unknown };

const NUM_A: Prop = { id: 'p1', name: 'Amount', type: 'number' };
const NUM_B: Prop = { id: 'p2', name: 'Quantity', type: 'number' };
const TEXT: Prop = { id: 'p3', name: 'Title', type: 'text' };
const DONE: Prop = { id: 'p4', name: 'Done', type: 'checkbox' };
const START: Prop = { id: 'p5', name: 'Start', type: 'date' };
const SELECT: Prop = { id: 'p6', name: 'Status', type: 'select' };

const ALL: Prop[] = [NUM_A, NUM_B, TEXT, DONE, START, SELECT];

function typesOf(props: Prop[]) {
  const map = new Map<string, any>();
  for (const p of props) {
    map.set(
      p.id,
      p.type === 'number'
        ? 'number'
        : p.type === 'text'
          ? 'string'
          : p.type === 'checkbox'
            ? 'boolean'
            : p.type === 'date'
              ? 'date'
              : 'null',
    );
  }
  return map;
}

/** parse + resolve + typecheck against the fixture properties. */
function compile(source: string, props: Prop[] = ALL) {
  const nameToId = new Map(props.map((p) => [p.name, p.id]));
  const { ast, dependencies } = resolve(parseRaw(source), nameToId);
  const { resultType } = typecheck(ast, typesOf(props), registry);
  return { ast, dependencies, resultType };
}

function context(props: Prop[] = ALL, now = Date.UTC(2026, 0, 15, 12, 0, 0)): EvalContext {
  return {
    registry,
    properties: new Map<string, EvalProperty>(
      props.map((p) => [p.id, { id: p.id, type: p.type, typeOptions: p.typeOptions }]),
    ),
    depth: 0,
    maxDepth: DEFAULT_MAX_DEPTH,
    memo: new Map(),
    now,
  };
}

/** Compile and evaluate in one step. */
function run(
  source: string,
  cells: Record<string, unknown> = {},
  props: Prop[] = ALL,
) {
  const { ast } = compile(source, props);
  return evaluate(ast, cells, context(props));
}

describe('parsing', () => {
  it('applies arithmetic precedence', () => {
    expect(run('1 + 2 * 3')).toBe(7);
    expect(run('(1 + 2) * 3')).toBe(9);
  });

  it('binds unary minus looser than exponentiation', () => {
    expect(run('-2 ^ 2')).toBe(-4);
    expect(run('(-2) ^ 2')).toBe(4);
  });

  it('treats exponentiation as right-associative', () => {
    expect(run('2 ^ 3 ^ 2')).toBe(512);
  });

  it('parses both quote styles and escapes', () => {
    expect(run('"a\\"b"')).toBe('a"b');
    expect(run("'plain'")).toBe('plain');
  });

  it('rejects an unterminated string', () => {
    expect(() => parseRaw('"abc')).toThrow(FormulaParseError);
  });

  it('reports the span of the offending token', () => {
    try {
      parseRaw('1 + @');
      fail('expected a parse error');
    } catch (err) {
      expect(err).toBeInstanceOf(FormulaParseError);
      const [first] = (err as FormulaParseError).errors;
      expect(first.span).toEqual({ start: 4, end: 5 });
    }
  });

  it('points a bare identifier at prop()', () => {
    expect(() => parseRaw('Amount + 1')).toThrow(/prop\("Amount"\)/);
  });

  it('accepts keyword literals', () => {
    expect(run('true')).toBe(true);
    expect(run('blank')).toBe(null);
  });
});

describe('resolution', () => {
  it('collects dependencies in first-seen order without duplicates', () => {
    const { dependencies } = compile(
      'prop("Amount") + prop("Quantity") * prop("Amount")',
    );
    expect(dependencies).toEqual(['p1', 'p2']);
  });

  it('matches property names case-insensitively', () => {
    expect(compile('prop("amount") + 1').dependencies).toEqual(['p1']);
  });

  it('prefers an exact match over a case-insensitive one', () => {
    const props: Prop[] = [
      { id: 'lower', name: 'total', type: 'number' },
      { id: 'upper', name: 'Total', type: 'number' },
    ];
    expect(compile('prop("Total")', props).dependencies).toEqual(['upper']);
  });

  it('rejects an unknown property', () => {
    expect(() => compile('prop("Nope")')).toThrow(/No property named "Nope"/);
  });

  it('requires a quoted name', () => {
    expect(() => parseRaw('prop(Amount)')).toThrow(/property name in quotes/);
  });
});

describe('type checking', () => {
  it('infers result types', () => {
    expect(compile('prop("Amount") * 2').resultType).toBe('number');
    expect(compile('prop("Title") & "!"').resultType).toBe('string');
    expect(compile('prop("Amount") > 2').resultType).toBe('boolean');
    expect(compile('TODAY()').resultType).toBe('date');
  });

  it('rejects text in arithmetic', () => {
    expect(() => compile('prop("Title") * 2')).toThrow(/must be a number/);
  });

  it('allows anything to be concatenated', () => {
    expect(compile('prop("Amount") & prop("Title")').resultType).toBe('string');
  });

  it('rejects unknown functions', () => {
    expect(() => compile('NOPE(1)')).toThrow(/Unknown function "NOPE"/);
  });

  it('checks argument counts', () => {
    expect(() => compile('ABS()')).toThrow(/takes exactly 1/);
    expect(() => compile('ABS(1, 2)')).toThrow(/takes exactly 1/);
    expect(() => compile('SUM()')).toThrow(/at least 1/);
  });

  it('unifies the branches of IF', () => {
    expect(compile('IF(prop("Done"), 1, 2)').resultType).toBe('number');
    expect(compile('IF(prop("Done"), 1, "x")').resultType).toBe('string');
    expect(compile('IF(prop("Done"), 1)').resultType).toBe('number');
  });

  it('treats a property that cannot join a formula as empty', () => {
    expect(compile('prop("Status")').resultType).toBe('null');
  });
});

describe('evaluation', () => {
  it('reads cells by property type', () => {
    expect(run('prop("Amount") + 1', { p1: 41 })).toBe(42);
    expect(run('prop("Title") & "!"', { p3: 'hi' })).toBe('hi!');
    expect(run('IF(prop("Done"), "y", "n")', { p4: true })).toBe('y');
  });

  it('treats a missing number cell as zero', () => {
    expect(run('prop("Amount") + 1', {})).toBe(1);
  });

  it('never leaks a select cell into a formula', () => {
    expect(run('prop("Status") & ""', { p6: { id: 'opt1' } })).toBe('');
  });

  it('snaps float noise', () => {
    expect(run('0.1 + 0.2')).toBe(0.3);
  });

  it('returns an error cell for division by zero', () => {
    const value = run('prop("Amount") / 0', { p1: 5 });
    expect(isErrorCell(value)).toBe(true);
    expect((value as any).__err).toBe('DIV_BY_ZERO');
  });

  it('short-circuits AND and OR', () => {
    expect(run('false and (1 / 0) > 0')).toBe(false);
    expect(run('true or (1 / 0) > 0')).toBe(true);
  });

  it('does not evaluate the untaken branch of IF', () => {
    expect(run('IF(true, 1, 1 / 0)')).toBe(1);
  });

  it('traps failures with IFERROR', () => {
    expect(run('IFERROR(1 / 0, -1)')).toBe(-1);
    expect(run('ISERROR(1 / 0)')).toBe(true);
    expect(run('ISERROR(1)')).toBe(false);
  });

  it('errors when a referenced property was deleted', () => {
    const { ast } = compile('prop("Amount") + 1');
    const value = evaluate(ast, {}, context([NUM_B]));
    expect(isErrorCell(value)).toBe(true);
    expect((value as any).__err).toBe('MISSING_PROP');
  });
});

describe('functions', () => {
  it('does maths', () => {
    expect(run('SUM(1, 2, 3)')).toBe(6);
    expect(run('ROUND(2.345, 2)')).toBe(2.35);
    expect(run('ROUND(-2.5)')).toBe(-3);
    expect(run('ROUNDDOWN(2.99, 1)')).toBe(2.9);
    expect(run('MOD(7, 3)')).toBe(1);
    expect(run('MIN(3, 1, 2)')).toBe(1);
    expect(run('AVERAGE(1, 2, 3, 4)')).toBe(2.5);
  });

  it('handles text', () => {
    expect(run('CONCAT("a", "b", 1)')).toBe('ab1');
    expect(run('LEFT("hello", 2)')).toBe('he');
    expect(run('RIGHT("hello", 2)')).toBe('lo');
    expect(run('MID("hello", 2, 3)')).toBe('ell');
    expect(run('SUBSTITUTE("a-b-c", "-", "+")')).toBe('a+b+c');
    expect(run('FIND("hello", "ll")')).toBe(3);
    expect(run('FIND("hello", "z")')).toBe(0);
    expect(run('SPLITPART("a,b,c", ",", 2)')).toBe('b');
  });

  it('keeps date-only cells date-only', () => {
    expect(run('DATEADD(prop("Start"), 1, "day")', { p5: '2026-01-31' })).toBe(
      '2026-02-01',
    );
  });

  it('clamps month arithmetic to the end of the month', () => {
    expect(run('DATEADD(prop("Start"), 1, "month")', { p5: '2026-01-31' })).toBe(
      '2026-02-28',
    );
  });

  it('counts whole units between dates', () => {
    expect(
      run('DATEDIFF(prop("Start"), "2026-01-11", "days")', { p5: '2026-01-01' }),
    ).toBe(10);
    expect(
      run('DATEDIFF(prop("Start"), "2026-03-15", "months")', { p5: '2026-01-20' }),
    ).toBe(1);
  });

  it('formats dates', () => {
    expect(run('FORMATDATE(prop("Start"), "DD/MM/YYYY")', { p5: '2026-01-05' })).toBe(
      '05/01/2026',
    );
  });

  it('uses a stable clock', () => {
    expect(run('FORMATDATE(TODAY(), "YYYY-MM-DD")')).toBe('2026-01-15');
    expect(run('YEAR(NOW())')).toBe(2026);
  });

  it('rejects an unknown unit', () => {
    const value = run('DATEADD(prop("Start"), 1, "fortnight")', { p5: '2026-01-01' });
    expect(isErrorCell(value)).toBe(true);
  });

  it('coerces', () => {
    expect(run('TONUMBER("1,234.5")')).toBe(1234.5);
    expect(run('TOTEXT(12.5)')).toBe('12.5');
    expect(run('TOBOOLEAN("no")')).toBe(false);
    expect(isErrorCell(run('TONUMBER("abc")'))).toBe(true);
  });

  it('exposes a documented palette', () => {
    for (const fn of registry.values()) {
      expect(fn.doc.length).toBeGreaterThan(0);
      expect(['logic', 'math', 'string', 'date', 'coercion']).toContain(fn.category);
      expect(fn.arity.min).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('nested formulas', () => {
  /** A formula property whose ast is already compiled. */
  function formulaProp(id: string, name: string, source: string, props: Prop[]): Prop {
    const nameToId = new Map(props.map((p) => [p.name, p.id]));
    const { ast, dependencies } = resolve(parseRaw(source), nameToId);
    return {
      id,
      name,
      type: 'formula',
      typeOptions: { source, ast, dependencies, astVersion: AST_VERSION },
    };
  }

  it('evaluates a formula that reads another formula', () => {
    const doubled = formulaProp('f1', 'Doubled', 'prop("Amount") * 2', ALL);
    const props = [...ALL, doubled];
    expect(run('prop("Doubled") + 1', { p1: 5 }, props)).toBe(11);
  });

  it('reports a loop between formulas rather than hanging', () => {
    const a: Prop = {
      id: 'f1',
      name: 'A',
      type: 'formula',
      typeOptions: {
        source: 'prop("B")',
        ast: { k: 'prop', id: 'f2' },
        dependencies: ['f2'],
        astVersion: AST_VERSION,
      },
    };
    const b: Prop = {
      id: 'f2',
      name: 'B',
      type: 'formula',
      typeOptions: {
        source: 'prop("A")',
        ast: { k: 'prop', id: 'f1' },
        dependencies: ['f1'],
        astVersion: AST_VERSION,
      },
    };
    const value = evaluate(
      { k: 'prop', id: 'f1' } as any,
      {},
      context([...ALL, a, b]),
    );
    expect(isErrorCell(value)).toBe(true);
    expect((value as any).__err).toBe('CYCLE');
  });

  it('flags a formula compiled by an older engine', () => {
    const stale: Prop = {
      id: 'f1',
      name: 'Stale',
      type: 'formula',
      typeOptions: { source: 'prop("Amount")', ast: {}, astVersion: 1 },
    };
    const value = evaluate(
      { k: 'prop', id: 'f1' } as any,
      { p1: 1 },
      context([...ALL, stale]),
    );
    expect(isErrorCell(value)).toBe(true);
    expect((value as any).__err).toBe('MISSING_PROP');
  });
});

describe('BaseFormulaGraph', () => {
  const formula = (id: string, deps: string[]) => ({
    id,
    type: 'formula',
    typeOptions: { dependencies: deps },
  });

  it('finds a direct self-reference', () => {
    const graph = new BaseFormulaGraph([formula('f1', ['f1'])]);
    expect(graph.detectCycle(formula('f1', ['f1']))).toBe(true);
  });

  it('finds an indirect cycle', () => {
    const graph = new BaseFormulaGraph([
      formula('f1', ['f2']),
      formula('f2', ['f3']),
      formula('f3', ['f1']),
    ]);
    expect(graph.detectCycle(formula('f1', ['f2']))).toBe(true);
  });

  it('accepts a diamond', () => {
    const graph = new BaseFormulaGraph([
      formula('f1', ['p1']),
      formula('f2', ['p1']),
      formula('f3', ['f1', 'f2']),
    ]);
    expect(graph.detectCycle(formula('f3', ['f1', 'f2']))).toBe(false);
  });

  it('lists transitive dependents of a changed property', () => {
    const graph = new BaseFormulaGraph([
      formula('f1', ['p1']),
      formula('f2', ['f1']),
      formula('f3', ['p2']),
    ]);
    expect(graph.affectedFormulas(['p1']).sort()).toEqual(['f1', 'f2']);
    expect(graph.affectedFormulas(['p2'])).toEqual(['f3']);
    expect(graph.affectedFormulas(['p9'])).toEqual([]);
  });

  it('excludes the changed ids themselves', () => {
    const graph = new BaseFormulaGraph([formula('f1', ['p1']), formula('f2', ['f1'])]);
    expect(graph.affectedFormulas(['f1'])).toEqual(['f2']);
  });
});

describe('valueToString', () => {
  it('renders cell values for export', () => {
    expect(valueToString(null)).toBe('');
    expect(valueToString(true)).toBe('true');
    expect(valueToString(0.1 + 0.2)).toBe('0.3');
    expect(valueToString({ __err: 'TYPE', msg: 'x', v: 1 })).toBe('#ERROR');
  });
});
