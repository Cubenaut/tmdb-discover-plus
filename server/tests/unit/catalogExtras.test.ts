import { describe, expect, it } from 'vitest';
import { buildCatalogExtraFromQuery, isNoSelectionGenre } from '../../src/utils/catalogExtras.ts';

describe('catalogExtras utils', () => {
  describe('isNoSelectionGenre', () => {
    it('treats empty and missing values as no-selection', () => {
      expect(isNoSelectionGenre(undefined)).toBe(true);
      expect(isNoSelectionGenre('')).toBe(true);
      expect(isNoSelectionGenre('   ')).toBe(true);
    });

    it('treats both All and None values as no-selection', () => {
      expect(isNoSelectionGenre('All')).toBe(true);
      expect(isNoSelectionGenre('all')).toBe(true);
      expect(isNoSelectionGenre('None')).toBe(true);
      expect(isNoSelectionGenre('none')).toBe(true);
    });

    it('keeps real genre values as selections', () => {
      expect(isNoSelectionGenre('Action')).toBe(false);
      expect(isNoSelectionGenre('Comedy')).toBe(false);
    });
  });

  describe('buildCatalogExtraFromQuery', () => {
    it('keeps all string query params and adds defaults', () => {
      const extra = buildCatalogExtraFromQuery({
        skip: '20',
        search: 'alien',
        genre: 'Action',
        sortBy: 'Most Popular',
      });

      expect(extra).toEqual({
        skip: '20',
        search: 'alien',
        genre: 'Action',
        sortBy: 'Most Popular',
      });
    });

    it('accepts array query params and defaults missing skip/search', () => {
      const extra = buildCatalogExtraFromQuery({
        genre: ['None'],
        random: 123,
      });

      expect(extra).toEqual({
        genre: 'None',
        skip: '0',
        search: '',
      });
    });
  });
});
