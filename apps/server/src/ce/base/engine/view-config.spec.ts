import { applyViewConfigPatch } from './view-config';
import { projectResultType } from './formula-types';

describe('applyViewConfigPatch', () => {
  it('deletes on null, ignores undefined, replaces otherwise', () => {
    const next = applyViewConfigPatch(
      { groupByPropertyId: 'a', hiddenChoiceIds: ['x'], propertyWidths: { a: 100 } },
      { groupByPropertyId: null, hiddenChoiceIds: undefined, propertyWidths: { a: 200 } },
    );
    expect(next).toEqual({ hiddenChoiceIds: ['x'], propertyWidths: { a: 200 } });
  });

  it('tolerates a missing current config', () => {
    expect(applyViewConfigPatch(null, { sorts: [] })).toEqual({ sorts: [] });
  });
});

describe('projectResultType', () => {
  it('matches the client projection table', () => {
    expect(projectResultType('number')).toBe('number');
    expect(projectResultType('url')).toBe('string');
    expect(projectResultType('checkbox')).toBe('boolean');
    expect(projectResultType('lastEditedAt')).toBe('date');
    expect(projectResultType('select')).toBe('null');
    expect(projectResultType('formula', { resultType: 'number' })).toBe('number');
  });
});
