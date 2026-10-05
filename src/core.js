/**
 * Core implementation of Karatsuba multiplication over decimal digit arrays.
 *
 * Representation contract (stated plainly so tests and callers agree):
 *   - A number is an Array<number> of decimal digits, little-endian
 *     (index 0 is the units place).
 *   - Each element MUST be an integer in [0, 9].
 *   - The value zero is `[]` (the empty array) OR `[0]`; `normalize` collapses
 *     `[0]` to `[]` and trims high-order zeros from any input.
 *
 * This little-endian convention is used because it makes length-based splits
 * (low half = first m digits, high half = the rest) and carry-free addition
 * trivial — we never have to reverse or shift the array to align powers of ten.
 */

/**
 * Remove leading (high-order) zeros so two equal values have equal length.
 * `[]` and `[0]` both normalize to `[]`.
 *
 * @param {number[]} a
 * @returns {number[]}
 */
export function normalize(a) {
  let i = a.length;
  while (i > 0 && a[i - 1] === 0) i -= 1;
  return a.slice(0, i);
}

/**
 * Add two digit arrays, returning a fresh normalized array.
 *
 * Little-endian addition: we walk from index 0 upward, propagating the carry
 * into higher indices exactly where it belongs. No reversal or realignment is
 * needed because equal powers of ten already sit at equal indices.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
export function add(a, b) {
  const n = Math.max(a.length, b.length);
  const out = new Array(n + 1);
  let carry = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i < a.length ? a[i] : 0;
    const y = i < b.length ? b[i] : 0;
    const s = x + y + carry;
    out[i] = s % 10;
    carry = (s / 10) | 0;
  }
  out[n] = carry;
  return normalize(out);
}

/**
 * Subtract `b` from `a`. Requires a >= b (as values); otherwise the result is
 * meaningless. Used internally by Karatsuba where `a >= b` is guaranteed by
 * the algebra `|lowA - lowB|`.
 *
 * We compute digit-by-digit with a borrow. Because a >= b, the final borrow is
 * zero, and `normalize` strips any remaining high-order zeros.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
export function subtract(a, b) {
  const out = new Array(a.length);
  let borrow = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] - borrow;
    const y = i < b.length ? b[i] : 0;
    let d = x - y;
    if (d < 0) {
      d += 10;
      borrow = 1;
    } else {
      borrow = 0;
    }
    out[i] = d;
  }
  return normalize(out);
}

/**
 * Schoolbook multiplication of `a` by a single decimal digit `d` in [0, 9].
 *
 * Avoids the full O(n^2) product when one factor is tiny. We inline this
 * rather than calling `karatsuba([], [d])` because the latter would pay
 * recursion overhead and intermediate-array churn for a linear-time job.
 *
 * @param {number[]} a
 * @param {number} d
 * @returns {number[]}
 */
function mulDigit(a, d) {
  if (d === 0) return [];
  const out = new Array(a.length + 1);
  let carry = 0;
  for (let i = 0; i < a.length; i += 1) {
    const p = a[i] * d + carry;
    out[i] = p % 10;
    carry = (p / 10) | 0;
  }
  out[a.length] = carry;
  return normalize(out);
}

/**
 * Multiply `a` by 10^k by prepending `k` zero digits (little-endian shift).
 *
 * @param {number[]} a
 * @param {number} k
 * @returns {number[]}
 */
function shiftLeft(a, k) {
  if (a.length === 0) return [];
  const out = new Array(a.length + k);
  for (let i = 0; i < k; i += 1) out[i] = 0;
  for (let i = 0; i < a.length; i += 1) out[i + k] = a[i];
  return out;
}

/**
 * Split `a` into `[low, high]` where `low` has length `m` (padded with zeros if
 * `a` is shorter) and `high` is the remaining high-order digits. Returns `high`
 * as `[]` when `a` fits entirely in the low half, which the caller relies on so
 * that `mulDigit(high, ...)` and `karatsuba(high, ...)` short-circuit to zero.
 *
 * @param {number[]} a
 * @param {number} m
 * @returns {[number[], number[]]}
 */
function splitAt(a, m) {
  if (a.length <= m) {
    return [a.slice(), []];
  }
  return [a.slice(0, m), a.slice(m)];
}

/**
 * Karatsuba multiplication of two non-negative decimal digit arrays.
 *
 * Recurrence: for a = a1*10^m + a0 and b = b1*10^m + b0,
 *   a*b = z2*10^(2m) + z1*10^m + z0
 * where
 *   z0 = a0 * b0,
 *   z2 = a1 * b1,
 *   z1 = (a0 + a1) * (b0 + b1) - z0 - z2.
 *
 * The `z1` term uses ONE recursive multiplication instead of two, which is the
 * whole point of Karatsuba: it trades extra additions/subtractions for fewer
 * multiplications, giving O(n^log2 3) ≈ O(n^1.585) instead of O(n^2).
 *
 * Base cases: either operand is zero (length 0) → `[]`; either is a single
 * digit → `mulDigit`. Below we could fall back to schoolbook for tiny inputs,
 * but `mulDigit` already handles the 1×n case in linear time, and the recursion
 * naturally bottoms out there, so no separate schoolbook routine is needed.
 *
 * Inputs are normalized internally so callers don't have to.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
export function karatsuba(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (x.length === 0 || y.length === 0) return [];
  if (x.length === 1) return mulDigit(y, x[0]);
  if (y.length === 1) return mulDigit(x, y[0]);

  const m = Math.floor(Math.max(x.length, y.length) / 2);
  const [x0, x1] = splitAt(x, m);
  const [y0, y1] = splitAt(y, m);

  const z0 = karatsuba(x0, y0);
  const z2 = karatsuba(x1, y1);
  // z1 = (x0 + x1)(y0 + y1) - z0 - z2. The sum (x0 + x1)(y0 + y1) equals
  // z0 + z1 + z2, so it is >= z0 and (z0 + z1 + z2) - z0 = z1 + z2 >= z2;
 // both `subtract` calls below therefore satisfy their a >= b precondition.
  const z1raw = karatsuba(add(x0, x1), add(y0, y1));
  const z1 = subtract(subtract(z1raw, z0), z2);

  // Combine z2*10^(2m) + z1*10^m + z0. Adding z0 first lets `add` see the
  // shorter operand early, keeping intermediate arrays small.
  return add(add(shiftLeft(z2, 2 * m), shiftLeft(z1, m)), z0);
}

/**
 * Public entry point. `multiply` is an alias for `karatsuba` — exported under a
 * friendlier name for callers who don't care about the algorithm and just want
 * a correct product of two big integers represented as digit arrays.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number[]}
 */
export const multiply = karatsuba;
