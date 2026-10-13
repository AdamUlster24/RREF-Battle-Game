import { describe, expect, it } from 'vitest';
import { Fraction } from '../../shared/fraction.js';

describe('Fraction', () => {
  it('reduces to lowest terms with a positive denominator', () => {
    expect(Fraction.of(6, -4).toString()).toBe('-3/2');
    expect(Fraction.of(-6, -3).toString()).toBe('2');
    expect(Fraction.of(0, -7).toString()).toBe('0');
  });

  it('parses integers, ratios and decimals exactly', () => {
    expect(Fraction.parse('-12').equals(Fraction.of(-12))).toBe(true);
    expect(Fraction.parse('10/4').equals(Fraction.of(5, 2))).toBe(true);
    expect(Fraction.parse('0.125').equals(Fraction.of(1, 8))).toBe(true);
    expect(Fraction.parse('-.5').equals(Fraction.of(-1, 2))).toBe(true);
    expect(() => Fraction.parse('1/2/3')).toThrow(SyntaxError);
    expect(() => Fraction.parse('abc')).toThrow(SyntaxError);
  });

  it('does arithmetic without rounding', () => {
    const third = Fraction.of(1, 3);
    expect(third.add(third).add(third).isOne()).toBe(true);
    expect(Fraction.of(1, 10).add(Fraction.of(2, 10)).equals(Fraction.of(3, 10))).toBe(true);
    expect(Fraction.of(3, 4).sub(Fraction.of(1, 4)).toString()).toBe('1/2');
    expect(Fraction.of(2, 3).mul(Fraction.of(9, 4)).toString()).toBe('3/2');
    expect(Fraction.of(2, 3).div(Fraction.of(-4, 9)).toString()).toBe('-3/2');
  });

  it('stays exact far beyond the range of a double', () => {
    const huge = Fraction.of(2n ** 80n + 1n, 3);
    expect(huge.mul(Fraction.of(3)).sub(Fraction.of(2n ** 80n)).isOne()).toBe(true);
  });

  it('rejects zero denominators, zero inverses and non-integers', () => {
    expect(() => Fraction.of(1, 0)).toThrow(RangeError);
    expect(() => Fraction.ZERO.inverse()).toThrow(RangeError);
    expect(() => Fraction.of(1.5)).toThrow(RangeError);
  });
});
