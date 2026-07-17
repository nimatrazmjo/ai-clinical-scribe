import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatPatientName, formatDob } from './formatters';

describe('formatters', () => {
  describe('formatDate()', () => {
    it('formats ISO string to readable date', () => {
      const result = formatDate('2026-07-17T10:00:00.000Z');
      expect(result).toMatch(/Jul/);
      expect(result).toMatch(/2026/);
    });
  });

  describe('formatDateTime()', () => {
    it('includes time component', () => {
      const result = formatDateTime('2026-07-17T10:00:00.000Z');
      expect(result).toMatch(/2026/);
      expect(result).toMatch(/:/);
    });
  });

  describe('formatPatientName()', () => {
    it('returns "Last, First" format', () => {
      expect(formatPatientName('John', 'Doe')).toBe('Doe, John');
    });
  });

  describe('formatDob()', () => {
    it('formats date of birth', () => {
      const result = formatDob('1966-03-15');
      expect(result).toMatch(/1966/);
      expect(result).toMatch(/Mar/);
    });
  });
});
