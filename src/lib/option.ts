/**
 * Innovation Option pricing: a trinomial lattice (up / flat / down) in the
 * style of a financial call option, with spot fixed at the strike.
 */

export type ValueTree = Record<number, Record<number, number>>;

export interface OptionParams {
  rate: number;
  strike: number;
  term: number;
  iterations: number;
  sigma: number;
}

export interface OptionResult extends OptionParams {
  premium: number;
  valueTree: ValueTree;
}

export interface CompoundParams extends OptionParams {
  tranches: number;
}

export interface Tranche extends OptionResult {
  /** 1 is the final (smallest, shortest) tranche; `tranches` is the first. */
  number: number;
}

export function getOption({
  rate = 0.05,
  strike = 20_000_000,
  term = 1,
  iterations = 4,
  sigma = 0.75,
}: Partial<OptionParams> = {}): OptionResult {
  const deltaT = term / iterations;
  const upFactor = Math.exp(sigma * Math.sqrt(2 * deltaT));

  const halfRoot = Math.sqrt(deltaT / 2);
  const denominator = Math.exp(sigma * halfRoot) - Math.exp(-sigma * halfRoot);
  const upProb = ((Math.exp((rate * deltaT) / 2) - Math.exp(-sigma * halfRoot)) / denominator) ** 2;
  const downProb = ((Math.exp(sigma * halfRoot) - Math.exp((rate * deltaT) / 2)) / denominator) ** 2;
  const flatProb = 1 - (upProb + downProb);

  // Option value at the terminus: max(spot - strike, 0) for each node.
  const terminal: Record<number, number> = {};
  for (let i = -iterations; i <= iterations; i++) {
    terminal[i] = Math.max(strike * upFactor ** i - strike, 0);
  }

  // Work backwards, discounting the probability-weighted value of the next step.
  const discount = Math.exp(-rate * deltaT);
  const valueTree: ValueTree = { [iterations]: terminal };
  for (let j = iterations - 1; j >= 0; j--) {
    const next = valueTree[j + 1];
    const level: Record<number, number> = {};
    for (let i = -j; i <= j; i++) {
      level[i] = discount * (upProb * next[i + 1] + downProb * next[i - 1] + flatProb * next[i]);
    }
    valueTree[j] = level;
  }

  return { rate, strike, term, iterations, sigma, premium: valueTree[0][0], valueTree };
}

/**
 * Each tranche is priced with the previous tranche's premium as its strike
 * and half its term.
 */
export function getCompound({
  rate = 0.05,
  strike = 20_000_000,
  term = 1,
  iterations = 4,
  sigma = 0.75,
  tranches = 4,
}: Partial<CompoundParams> = {}): Tranche[] {
  const result: Tranche[] = [];
  for (let number = tranches; number >= 1; number--) {
    const option = getOption({ rate, strike, term, iterations, sigma });
    result.push({ ...option, number });
    strike = option.premium;
    term /= 2;
  }
  return result.reverse();
}
