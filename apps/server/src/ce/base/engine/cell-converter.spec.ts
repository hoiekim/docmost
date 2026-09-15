import { convertCell } from './cell-converter';
import { IBaseProperty } from '../types/base.types';

const prop = (
  id: string,
  type: IBaseProperty['type'],
  typeOptions: Record<string, unknown> = {},
): IBaseProperty => ({
  id,
  pageId: 'p',
  name: id,
  type,
  position: 'a0',
  typeOptions,
  isPrimary: false,
  workspaceId: 'w',
  createdAt: '',
  updatedAt: '',
});

const choices = {
  choices: [
    { id: 'optA', name: 'Alpha', color: 'gray' },
    { id: 'optB', name: 'Beta', color: 'blue' },
  ],
  choiceOrder: ['optA', 'optB'],
};

const refs = {
  users: new Map([['u1', { id: 'u1', name: 'Ada', avatarUrl: null }]]),
  pages: new Map([['pg1', { id: 'pg1', title: 'Roadmap' }]]),
};

describe('convertCell', () => {
  it('stringifies choices, people, pages and files into text', () => {
    expect(convertCell('optA', prop('s', 'select', choices), 'text', {})).toBe('Alpha');
    expect(convertCell(['optA', 'optB'], prop('m', 'multiSelect', choices), 'text', {})).toBe(
      'Alpha, Beta',
    );
    expect(convertCell(['u1'], prop('p', 'person'), 'text', {}, { refs })).toBe('Ada');
    expect(convertCell('pg1', prop('pg', 'page'), 'longText', {}, { refs })).toBe('Roadmap');
    expect(
      convertCell([{ id: 'f', fileName: 'a.png' }, { id: 'g', fileName: 'b.png' }], prop('f', 'file'), 'text', {}),
    ).toBe('a.png, b.png');
  });

  it('truncates longText into text', () => {
    const long = 'x'.repeat(2500);
    expect((convertCell(long, prop('l', 'longText'), 'text', {}) as string).length).toBe(2000);
  });

  it('moves between choice kinds keeping known ids', () => {
    expect(convertCell(['optB', 'optA'], prop('m', 'multiSelect', choices), 'select', choices)).toBe(
      'optB',
    );
    expect(convertCell('optA', prop('s', 'select', choices), 'multiSelect', choices)).toEqual(['optA']);
    expect(convertCell('optZ', prop('s', 'select', choices), 'status', choices)).toBeNull();
    expect(convertCell('anything', prop('t', 'text'), 'select', choices)).toBeNull();
  });

  it('parses numbers, dates, booleans, urls and emails or clears', () => {
    expect(convertCell('1,234.5', prop('t', 'text'), 'number', {})).toBe(1234.5);
    expect(convertCell('abc', prop('t', 'text'), 'number', {})).toBeNull();
    expect(convertCell('2026-01-02', prop('t', 'text'), 'date', {})).toBe('2026-01-02');
    expect(convertCell('someday', prop('t', 'text'), 'date', {})).toBeNull();
    expect(convertCell('yes', prop('t', 'text'), 'checkbox', {})).toBe(true);
    expect(convertCell('0', prop('t', 'text'), 'checkbox', {})).toBe(false);
    expect(convertCell('maybe', prop('t', 'text'), 'checkbox', {})).toBeNull();
    expect(convertCell('https://x.y', prop('t', 'text'), 'url', {})).toBe('https://x.y');
    expect(convertCell('x y', prop('t', 'text'), 'url', {})).toBeNull();
    expect(convertCell('a@b.co', prop('t', 'text'), 'email', {})).toBe('a@b.co');
    expect(convertCell('a@b', prop('t', 'text'), 'email', {})).toBeNull();
  });

  it('clears incompatible targets', () => {
    expect(convertCell('text', prop('t', 'text'), 'page', {})).toBeNull();
    expect(convertCell('text', prop('t', 'text'), 'person', {})).toBeNull();
    expect(convertCell('text', prop('t', 'text'), 'file', {})).toBeNull();
    expect(convertCell(1, prop('n', 'number'), 'formula', {})).toBeNull();
  });

  it('returns the value untouched when the type does not change', () => {
    expect(convertCell(['u1', 'u2'], prop('p', 'person', { allowMultiple: true }), 'person', {})).toEqual(
      ['u1', 'u2'],
    );
  });
});
