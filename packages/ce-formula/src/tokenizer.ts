import { FormulaParseError } from './errors';
import type { Span } from './types';

export type TokenKind =
  | 'number'
  | 'string'
  | 'ident'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'eof';

export type Token = {
  kind: TokenKind;
  /** Literal text for idents and operators; parsed value for number/string. */
  text: string;
  value?: string | number;
  span: Span;
};

/** Multi-character operators, longest first so `<=` beats `<`. */
const OPERATORS = [
  '!=',
  '<>',
  '<=',
  '>=',
  '==',
  '+',
  '-',
  '*',
  '/',
  '%',
  '^',
  '&',
  '=',
  '<',
  '>',
];

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const push = (kind: TokenKind, text: string, start: number, value?: string | number) => {
    tokens.push({ kind, text, value, span: { start, end: i } });
  };

  while (i < source.length) {
    const start = i;
    const ch = source[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    if (ch === '(') {
      i++;
      push('lparen', '(', start);
      continue;
    }
    if (ch === ')') {
      i++;
      push('rparen', ')', start);
      continue;
    }
    if (ch === ',') {
      i++;
      push('comma', ',', start);
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let out = '';
      let closed = false;
      while (i < source.length) {
        const c = source[i];
        if (c === '\\') {
          const next = source[i + 1];
          if (next === undefined) break;
          out += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          i += 2;
          continue;
        }
        if (c === quote) {
          i++;
          closed = true;
          break;
        }
        out += c;
        i++;
      }
      if (!closed) {
        throw FormulaParseError.of('Unterminated text value', { start, end: i });
      }
      push('string', out, start, out);
      continue;
    }

    if (isDigit(ch) || (ch === '.' && isDigit(source[i + 1] ?? ''))) {
      while (i < source.length && isDigit(source[i])) i++;
      if (source[i] === '.') {
        i++;
        while (i < source.length && isDigit(source[i])) i++;
      }
      if (source[i] === 'e' || source[i] === 'E') {
        const save = i;
        i++;
        if (source[i] === '+' || source[i] === '-') i++;
        if (isDigit(source[i] ?? '')) {
          while (i < source.length && isDigit(source[i])) i++;
        } else {
          i = save;
        }
      }
      const text = source.slice(start, i);
      const n = Number(text);
      if (Number.isNaN(n)) {
        throw FormulaParseError.of(`"${text}" is not a valid number`, { start, end: i });
      }
      push('number', text, start, n);
      continue;
    }

    if (isIdentStart(ch)) {
      while (i < source.length && isIdentPart(source[i])) i++;
      push('ident', source.slice(start, i), start);
      continue;
    }

    const op = OPERATORS.find((candidate) => source.startsWith(candidate, i));
    if (op) {
      i += op.length;
      push('op', op, start);
      continue;
    }

    i++;
    throw FormulaParseError.of(`Unexpected character "${ch}"`, { start, end: i });
  }

  tokens.push({ kind: 'eof', text: '', span: { start: source.length, end: source.length } });
  return tokens;
}
