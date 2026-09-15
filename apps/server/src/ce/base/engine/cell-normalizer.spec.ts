import { BadRequestException } from '@nestjs/common';
import { normalizeCell, normalizeCells } from './cell-normalizer';
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

const select = prop('sel', 'select', {
  choices: [
    { id: 'optA', name: 'A', color: 'gray' },
    { id: 'optB', name: 'B', color: 'blue' },
  ],
  choiceOrder: ['optA', 'optB'],
  defaultValue: 'optA',
});

describe('normalizeCell', () => {
  it('passes null through as a delete', () => {
    expect(normalizeCell(prop('t', 'text'), null)).toBeNull();
  });

  it('coerces numbers and rejects NaN', () => {
    expect(normalizeCell(prop('n', 'number'), '3.5')).toBe(3.5);
    expect(() => normalizeCell(prop('n', 'number'), 'x')).toThrow(BadRequestException);
  });

  it('coerces checkbox strings', () => {
    expect(normalizeCell(prop('c', 'checkbox'), 'yes')).toBe(true);
    expect(normalizeCell(prop('c', 'checkbox'), 'false')).toBe(false);
  });

  it('validates choice ids', () => {
    expect(normalizeCell(select, 'optB')).toBe('optB');
    expect(normalizeCell(select, ['optA'])).toBe('optA');
    expect(() => normalizeCell(select, 'optZ')).toThrow(BadRequestException);
  });

  it('dedupes multiSelect and drops empties', () => {
    const multi = prop('m', 'multiSelect', select.typeOptions);
    expect(normalizeCell(multi, ['optA', 'optA', 'optB'])).toEqual(['optA', 'optB']);
    expect(normalizeCell(multi, [])).toBeNull();
  });

  it('shapes person cells by allowMultiple', () => {
    expect(normalizeCell(prop('p', 'person'), ['u1', 'u2'])).toBe('u1');
    expect(normalizeCell(prop('p', 'person', { allowMultiple: true }), 'u1')).toEqual(['u1']);
  });

  it('validates urls, emails and dates', () => {
    expect(normalizeCell(prop('u', 'url'), ' https://a.b ')).toBe('https://a.b');
    expect(() => normalizeCell(prop('u', 'url'), 'has space')).toThrow(BadRequestException);
    expect(() => normalizeCell(prop('e', 'email'), 'nope')).toThrow(BadRequestException);
    expect(normalizeCell(prop('d', 'date'), '2026-01-01')).toBe('2026-01-01');
    expect(() => normalizeCell(prop('d', 'date'), '2026-13-45')).toThrow(BadRequestException);
  });

  it('validates file arrays', () => {
    const file = prop('f', 'file');
    expect(normalizeCell(file, [{ id: 'x', fileName: 'a.png' }])).toEqual([
      { id: 'x', fileName: 'a.png' },
    ]);
    expect(() => normalizeCell(file, [{ fileName: 'a.png' }])).toThrow(BadRequestException);
  });
});

describe('normalizeCells', () => {
  const props = new Map<string, IBaseProperty>(
    [
      prop('t', 'text'),
      select,
      prop('f', 'formula', { source: '1' }),
      prop('c', 'createdAt'),
      prop('n', 'number', { defaultValue: 7 }),
    ].map((p) => [p.id, p]),
  );

  it('drops unknown, formula and system keys', () => {
    expect(
      normalizeCells({ t: 'hi', f: 5, c: 'x', nope: 1, sel: null }, props),
    ).toEqual({ t: 'hi', sel: null });
  });

  it('applies defaults only for absent keys on create', () => {
    expect(normalizeCells({ t: 'hi' }, props, { applyDefaults: true })).toEqual({
      t: 'hi',
      sel: 'optA',
      n: 7,
    });
    expect(normalizeCells({ sel: 'optB', n: 1 }, props, { applyDefaults: true })).toEqual({
      sel: 'optB',
      n: 1,
    });
  });
});
