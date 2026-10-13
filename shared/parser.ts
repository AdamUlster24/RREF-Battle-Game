import { Fraction } from './fraction.js';
import { validateOp, type RowOp } from './matrix.js';

export type ParseResult = { ok: true; op: RowOp } | { ok: false; error: string };

export const COMMAND_EXAMPLES = 'Try R1 <> R2, R2 = R2/3 or R1 = R1 - 2R2.';

/** One `coefficient × row` piece of the right-hand side. */
interface Term {
  row: number;
  factor: Fraction;
}

class CommandError extends Error {}

/**
 * Reads a row-operation command typed by a player.
 *
 *   swap   R1 <> R2        (also <-> and ↔)
 *   scale  R1 = 3R1        R1 = R1/3      R1 = (2/3)*R1      R1 = -R1
 *   add    R1 = R1 + 2R2   R1 = R1 - (3/2)R2   R1 = 2R2 + R1
 *
 * The target can also go last: `R1 + 2R2 -> R1`. Case and spaces are ignored.
 * Only genuine elementary operations are accepted, so `R1 = R2` and
 * `R1 = 2R1 + R2` are rejected with an explanation.
 */
export function parseCommand(input: string, rowCount: number): ParseResult {
  try {
    const op = read(normalize(input));
    const problem = validateOp(op, rowCount);
    return problem ? { ok: false, error: problem } : { ok: true, op };
  } catch (error) {
    if (error instanceof CommandError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

function normalize(input: string): string {
  return input
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/<->|↔/g, '<>')
    .replace(/→/g, '->');
}

function read(text: string): RowOp {
  const swap = /^R(\d+)<>R(\d+)$/.exec(text);
  if (swap) {
    return { type: 'swap', a: Number(swap[1]) - 1, b: Number(swap[2]) - 1 };
  }

  const targetFirst = /^R(\d+)=(.+)$/.exec(text);
  const targetLast = /^(.+)->R(\d+)$/.exec(text);
  if (!targetFirst && !targetLast) {
    throw new CommandError(`Couldn't read that. ${COMMAND_EXAMPLES}`);
  }
  const target = Number(targetFirst ? targetFirst[1] : targetLast![2]) - 1;
  const terms = new ExpressionReader(targetFirst ? targetFirst[2]! : targetLast![1]!).terms();
  const name = `R${target + 1}`;

  if (terms.length === 1) {
    const [only] = terms as [Term];
    if (only.row !== target) {
      throw new CommandError(`That would overwrite ${name}. To add another row to it, write ${name} = ${name} + R${only.row + 1}.`);
    }
    return { type: 'scale', row: target, factor: only.factor };
  }

  if (terms.length === 2) {
    const [first, second] = terms as [Term, Term];
    const kept = first.row === target ? first : second;
    const added = kept === first ? second : first;
    if (kept.row !== target || !kept.factor.isOne()) {
      throw new CommandError(`Keep ${name} as it is and add a multiple of one other row, like ${name} = ${name} + 2R${added.row + 1}.`);
    }
    return { type: 'add', target, source: added.row, factor: added.factor };
  }

  throw new CommandError('One operation at a time: add a multiple of a single row.');
}

class ExpressionReader {
  private readonly text: string;
  private pos = 0;

  constructor(text: string) {
    this.text = text;
  }

  terms(): Term[] {
    const terms = [this.term(this.sign())];
    while (this.pos < this.text.length) {
      const operator = this.text[this.pos];
      if (operator !== '+' && operator !== '-') {
        throw this.unreadable();
      }
      this.pos++;
      const sign = this.sign();
      terms.push(this.term(operator === '-' ? -sign : sign));
    }
    return terms;
  }

  /** `3R2`, `3*R2`, `1/2R2`, `(1/2)R2`, `R2*3`, `R2/3` or `3R2/4`. */
  private term(sign: number): Term {
    let factor = Fraction.of(sign);
    if (this.peek() !== 'R') {
      factor = factor.mul(this.scalar(true));
      this.take('*');
    }
    const row = this.row();
    if (this.take('*')) {
      factor = factor.mul(this.scalar(false));
    } else if (this.take('/')) {
      const divisor = this.scalar(false);
      if (divisor.isZero()) {
        throw new CommandError("Can't divide by zero.");
      }
      factor = factor.div(divisor);
    }
    return { row, factor };
  }

  /**
   * A number or a fraction. A bare `a/b` is only read before a row (`1/2R1`);
   * after one it would make `R1/2/3` ambiguous, so brackets are required there.
   */
  private scalar(allowBareFraction: boolean): Fraction {
    const sign = this.sign();
    const bracketed = this.take('(');
    const innerSign = bracketed ? this.sign() : 1;
    let value = this.number();
    if ((bracketed || allowBareFraction) && this.take('/')) {
      const denominator = this.number();
      if (denominator.isZero()) {
        throw new CommandError("Can't divide by zero.");
      }
      value = value.div(denominator);
    }
    if (bracketed && !this.take(')')) {
      throw this.unreadable();
    }
    return sign * innerSign < 0 ? value.neg() : value;
  }

  private number(): Fraction {
    const match = /^(\d+\.\d+|\.\d+|\d+)/.exec(this.text.slice(this.pos));
    if (!match) {
      throw this.unreadable();
    }
    this.pos += match[0].length;
    return Fraction.parse(match[0]);
  }

  private row(): number {
    const match = /^R(\d+)/.exec(this.text.slice(this.pos));
    if (!match) {
      throw this.unreadable();
    }
    this.pos += match[0].length;
    return Number(match[1]) - 1;
  }

  private sign(): number {
    let sign = 1;
    while (this.peek() === '-' || this.peek() === '+') {
      if (this.text[this.pos++] === '-') sign = -sign;
    }
    return sign;
  }

  private peek(): string | undefined {
    return this.text[this.pos];
  }

  private take(char: string): boolean {
    if (this.text[this.pos] !== char) return false;
    this.pos++;
    return true;
  }

  private unreadable(): CommandError {
    return new CommandError(`Couldn't read that. ${COMMAND_EXAMPLES}`);
  }
}
