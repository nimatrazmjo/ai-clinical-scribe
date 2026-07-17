import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn()', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('resolves tailwind conflicts (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('handles conditional classes', () => {
    const condition = false as boolean;
    expect(cn('base', condition && 'skipped', 'end')).toBe('base end');
  });

  it('handles undefined/null gracefully', () => {
    expect(cn(undefined, null, 'valid')).toBe('valid');
  });

  it('merges multiple conflicting utilities', () => {
    expect(cn('text-sm text-gray-500', 'text-base')).toBe('text-gray-500 text-base');
  });
});
