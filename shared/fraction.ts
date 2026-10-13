function gcd(a: bigint, b: bigint): bigint {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b > 0n) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * An exact rational number, always in lowest terms with a positive denominator.
 * Row reduction on floats drifts (1/3 * 3 !== 1); on fractions it cannot.
 */
export class Fraction {
  static readonly ZERO = new Fraction(0n, 1n);
  static readonly ONE = new Fraction(1n, 1n);

  readonly num: bigint;
  readonly den: bigint;

  private constructor(num: bigint, den: bigint) {
    this.num = num;
    this.den = den;
  }

  static of(num: bigint | number, den: bigint | number = 1): Fraction {
    const n = toBigInt(num);
    const d = toBigInt(den);
    if (d === 0n) {
      throw new RangeError('Fraction with a zero denominator');
    }
    const divisor = gcd(n, d) || 1n;
    const sign = d < 0n ? -1n : 1n;
    return new Fraction((sign * n) / divisor, (sign * d) / divisor);
  }

  /** Reads "3", "-3/2" or "0.25". Throws on anything else. */
  static parse(text: string): Fraction {
    const ratio = /^(-?\d+)(?:\/(-?\d+))?$/.exec(text);
    if (ratio) {
      return Fraction.of(BigInt(ratio[1]!), BigInt(ratio[2] ?? '1'));
    }
    const decimal = /^(-?)(\d*)\.(\d+)$/.exec(text);
    if (decimal) {
      const digits = BigInt(`${decimal[2]}${decimal[3]}`);
      const scale = 10n ** BigInt(decimal[3]!.length);
      return Fraction.of(decimal[1] ? -digits : digits, scale);
    }
    throw new SyntaxError(`Not a number: "${text}"`);
  }

  add(other: Fraction): Fraction {
    return Fraction.of(this.num * other.den + other.num * this.den, this.den * other.den);
  }

  sub(other: Fraction): Fraction {
    return this.add(other.neg());
  }

  mul(other: Fraction): Fraction {
    return Fraction.of(this.num * other.num, this.den * other.den);
  }

  div(other: Fraction): Fraction {
    return this.mul(other.inverse());
  }

  neg(): Fraction {
    return new Fraction(-this.num, this.den);
  }

  inverse(): Fraction {
    if (this.num === 0n) {
      throw new RangeError('Zero has no inverse');
    }
    return Fraction.of(this.den, this.num);
  }

  equals(other: Fraction): boolean {
    return this.num === other.num && this.den === other.den;
  }

  isZero(): boolean {
    return this.num === 0n;
  }

  isOne(): boolean {
    return this.num === 1n && this.den === 1n;
  }

  isInteger(): boolean {
    return this.den === 1n;
  }

  isNegative(): boolean {
    return this.num < 0n;
  }

  toString(): string {
    return this.den === 1n ? `${this.num}` : `${this.num}/${this.den}`;
  }
}

function toBigInt(value: bigint | number): bigint {
  if (typeof value === 'bigint') return value;
  if (!Number.isInteger(value)) {
    throw new RangeError(`Not an integer: ${value}`);
  }
  return BigInt(value);
}
