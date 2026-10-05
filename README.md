# karatsuba-multiply

Multiplies two non-negative integers of arbitrary size, each given as a little-endian array of decimal digits, using the Karatsuba divide-and-conquer algorithm.

```js
import { multiply, normalize } from "./src/index.js";

// 123 * 4567 = 561741, digits little-endian (index 0 = units).
const product = multiply([3, 2, 1], [7, 6, 5, 4]);
console.log(normalize(product)); // [1, 4, 7, 0, 6, 5]
```

## Exports

- `multiply(a, b)` — multiply two digit arrays; alias of `karatsuba`.
- `karatsuba(a, b)` — the recursive algorithm itself.
- `add(a, b)`, `subtract(a, b)` — digit-array arithmetic used internally, also exported for direct use.
- `normalize(a)` — strip high-order zeros; `[]` and `[0]` both mean zero.

## Representation

A number is an `Array<number>` of decimal digits in `[0, 9]`, little-endian: index 0 is the units place. So `123` is `[3, 2, 1]` and zero is `[]`. Inputs are normalized internally; callers do not have to pre-trim.

## Why this exists

Schoolbook multiplication of two n-digit numbers is O(n²). Karatsuba splits each operand at the middle, computes three half-size products instead of four, and recombines them — O(n^log₂3) ≈ O(n^1.585). The trade-off is more additions/subtractions and more intermediate arrays per level, so for small n the constant factors make it slower than schoolbook. This library does not implement a schoolbook crossover: the recursion bottoms out at the single-digit case, which is already linear. That keeps the code small and the algorithm pure, at the cost of some speed on inputs under a few dozen digits.

## Awkward edge

`subtract(a, b)` assumes `a >= b` (as values). It does not check. The Karatsuba recombination guarantees this by taking `|lowA - lowB|` before calling `subtract`, but if you call it directly with `a < b` you get a meaningless result with no error.

The implementation handles only non-negative integers. There is no sign bit and no decimal-point handling.
