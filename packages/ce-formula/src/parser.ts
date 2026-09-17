import { FormulaParseError } from './errors';
import { tokenize, type Token } from './tokenizer';
import {
  MAX_FORMULA_SOURCE_LENGTH,
  type BinaryOp,
  type RawAst,
  type Span,
} from './types';

/**
 * Precedence, loosest first. Unary `not` sits between `and` and comparison;
 * unary minus binds tighter than `*` but looser than `^`, so -2^2 is -4.
 */
const COMPARISON: Record<string, BinaryOp> = {
  '=': '=',
  '==': '=',
  '!=': '!=',
  '<>': '!=',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
};

const KEYWORD_LITERALS: Record<string, boolean | null> = {
  true: true,
  false: false,
  null: null,
  blank: null,
  empty: null,
};

/** Reference form: prop("Name"). The only place a bare name may appear. */
const PROP_FN = 'prop';

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    const token = this.peek();
    if (token.kind !== 'eof') this.pos++;
    return token;
  }

  private isIdent(text: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.kind === 'ident' && token.text.toLowerCase() === text;
  }

  private isOp(text: string): boolean {
    const token = this.peek();
    return token.kind === 'op' && token.text === text;
  }

  private expect(kind: Token['kind'], what: string): Token {
    const token = this.peek();
    if (token.kind !== kind) {
      throw FormulaParseError.of(
        `Expected ${what}${token.kind === 'eof' ? ' but the formula ended' : ` but found "${token.text}"`}`,
        token.span,
      );
    }
    return this.next();
  }

  parse(): RawAst {
    if (this.peek().kind === 'eof') {
      throw FormulaParseError.of('Formula is empty', this.peek().span);
    }
    const ast = this.parseOr();
    const token = this.peek();
    if (token.kind !== 'eof') {
      throw FormulaParseError.of(`Unexpected "${token.text}"`, token.span);
    }
    return ast;
  }

  private parseOr(): RawAst {
    let left = this.parseAnd();
    while (this.isIdent('or')) {
      this.next();
      const right = this.parseAnd();
      left = { k: 'bin', op: 'or', l: left, r: right, span: join(left.span, right.span) };
    }
    return left;
  }

  private parseAnd(): RawAst {
    let left = this.parseNot();
    while (this.isIdent('and')) {
      this.next();
      const right = this.parseNot();
      left = { k: 'bin', op: 'and', l: left, r: right, span: join(left.span, right.span) };
    }
    return left;
  }

  private parseNot(): RawAst {
    // `NOT(x)` is the registry function; bare `not x` is the operator.
    if (this.isIdent('not') && this.peek(1).kind !== 'lparen') {
      const start = this.next().span;
      const arg = this.parseNot();
      return { k: 'un', op: 'not', a: arg, span: join(start, arg.span) };
    }
    return this.parseComparison();
  }

  private parseComparison(): RawAst {
    let left = this.parseConcat();
    for (;;) {
      const token = this.peek();
      const op = token.kind === 'op' ? COMPARISON[token.text] : undefined;
      if (!op) break;
      this.next();
      const right = this.parseConcat();
      left = { k: 'bin', op, l: left, r: right, span: join(left.span, right.span) };
    }
    return left;
  }

  private parseConcat(): RawAst {
    let left = this.parseAdditive();
    while (this.isOp('&')) {
      this.next();
      const right = this.parseAdditive();
      left = { k: 'bin', op: '&', l: left, r: right, span: join(left.span, right.span) };
    }
    return left;
  }

  private parseAdditive(): RawAst {
    let left = this.parseMultiplicative();
    for (;;) {
      const token = this.peek();
      if (token.kind !== 'op' || (token.text !== '+' && token.text !== '-')) break;
      this.next();
      const right = this.parseMultiplicative();
      left = {
        k: 'bin',
        op: token.text as BinaryOp,
        l: left,
        r: right,
        span: join(left.span, right.span),
      };
    }
    return left;
  }

  private parseMultiplicative(): RawAst {
    let left = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (
        token.kind !== 'op' ||
        (token.text !== '*' && token.text !== '/' && token.text !== '%')
      ) {
        break;
      }
      this.next();
      const right = this.parseUnary();
      left = {
        k: 'bin',
        op: token.text as BinaryOp,
        l: left,
        r: right,
        span: join(left.span, right.span),
      };
    }
    return left;
  }

  private parseUnary(): RawAst {
    const token = this.peek();
    if (token.kind === 'op' && (token.text === '-' || token.text === '+')) {
      this.next();
      const arg = this.parseUnary();
      if (token.text === '+') return arg;
      return { k: 'un', op: 'neg', a: arg, span: join(token.span, arg.span) };
    }
    return this.parsePower();
  }

  private parsePower(): RawAst {
    const left = this.parsePrimary();
    if (this.isOp('^')) {
      this.next();
      // Right-associative: 2^3^2 is 2^(3^2).
      const right = this.parseUnary();
      return { k: 'bin', op: '^', l: left, r: right, span: join(left.span, right.span) };
    }
    return left;
  }

  private parsePrimary(): RawAst {
    const token = this.peek();

    if (token.kind === 'number') {
      this.next();
      return { k: 'lit', v: token.value as number, span: token.span };
    }

    if (token.kind === 'string') {
      this.next();
      return { k: 'lit', v: token.value as string, span: token.span };
    }

    if (token.kind === 'lparen') {
      this.next();
      const inner = this.parseOr();
      this.expect('rparen', 'a closing ")"');
      return inner;
    }

    if (token.kind === 'ident') {
      const lower = token.text.toLowerCase();

      if (this.peek(1).kind !== 'lparen') {
        if (lower in KEYWORD_LITERALS) {
          this.next();
          return { k: 'lit', v: KEYWORD_LITERALS[lower], span: token.span };
        }
        throw FormulaParseError.of(
          `Unknown name "${token.text}". Reference a property with prop("${token.text}").`,
          token.span,
        );
      }

      this.next();
      this.next(); // consume "("

      if (lower === PROP_FN) {
        const arg = this.peek();
        if (arg.kind !== 'string') {
          throw FormulaParseError.of(
            'prop() takes a property name in quotes, like prop("Status")',
            arg.span,
          );
        }
        this.next();
        const close = this.expect('rparen', 'a closing ")"');
        const name = arg.value as string;
        if (name.trim() === '') {
          throw FormulaParseError.of('prop() needs a property name', arg.span);
        }
        return { k: 'name', name, span: join(token.span, close.span) };
      }

      const args: RawAst[] = [];
      if (this.peek().kind !== 'rparen') {
        for (;;) {
          args.push(this.parseOr());
          if (this.peek().kind === 'comma') {
            this.next();
            continue;
          }
          break;
        }
      }
      const close = this.expect('rparen', `a closing ")" for ${token.text}()`);
      return {
        k: 'call',
        fn: token.text.toUpperCase(),
        args,
        span: join(token.span, close.span),
      };
    }

    throw FormulaParseError.of(
      token.kind === 'eof'
        ? 'The formula ended unexpectedly'
        : `Unexpected "${token.text}"`,
      token.span,
    );
  }
}

function join(a: Span, b: Span): Span {
  return { start: a.start, end: b.end };
}

/**
 * Parse source into an unresolved AST. Property references stay as names;
 * call resolve() to turn them into ids. Throws FormulaParseError.
 */
export function parseRaw(source: string): RawAst {
  if (source.length > MAX_FORMULA_SOURCE_LENGTH) {
    throw FormulaParseError.of('Formula is too long');
  }
  return new Parser(tokenize(source)).parse();
}
