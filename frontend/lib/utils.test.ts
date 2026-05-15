import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn (className helper)', () => {
  it('combina classes simples', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('descarta falsy', () => {
    expect(cn('a', false && 'b', null, undefined, '')).toBe('a');
  });

  it('aceita arrays e objetos do clsx', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
  });

  it('aplica tailwind-merge para classes conflitantes', () => {
    // tailwind-merge resolve "px-2" + "px-4" mantendo a ultima.
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('preserva classes nao-tailwind', () => {
    expect(cn('btn-primary', 'my-custom')).toBe('btn-primary my-custom');
  });
});
