import { test } from "node:test";
import assert from "node:assert/strict";

import { multiply, karatsuba, add, subtract, normalize } from "../src/index.js";

/**
 * Convert a non-negative integer string into a little-endian digit array.
 * @param {string} s
 * @returns {number[]}
 */
function fromString(s) {
  const out = [];
  for (let i = s.length - 1; i >= 0; i -= 1) out.push(Number(s[i]));
  return out;
}

/**
 * Render a little-endian digit array as a decimal string (no leading zeros).
 * @param {number[]} a
 * @returns {string}
 */
function toString(a) {
  if (a.length === 0) return "0";
  let s = "";
  for (let i = a.length - 1; i >= 0; i -= 1) s += String(a[i]);
  return s;
}

/**
 * Multiply via JS BigInt so tests have an independent oracle.
 * @param {string} x
 * @param {string} y
 * @returns {string}
 */
function bigMul(x, y) {
  return (BigInt(x) * BigInt(y)).toString();
}

test("normalize trims high-order zeros", () => {
  assert.deepEqual(normalize([0, 0, 0]), []);
  assert.deepEqual(normalize([0]), []);
  assert.deepEqual(normalize([]), []);
  assert.deepEqual(normalize([1, 0, 0]), [1]);
  assert.deepEqual(normalize([3, 2, 1, 0, 0]), [3, 2, 1]);
});

test("add handles equal and unequal lengths with carry", () => {
  assert.deepEqual(add([9], [1]), [0, 1]);
  assert.deepEqual(add([9, 9], [1]), [0, 0, 1]);
  assert.deepEqual(add([1, 2, 3], [4, 5, 6]), [5, 7, 9]);
  assert.deepEqual(add([], [5]), [5]);
  assert.deepEqual(add([], []), []);
});

test("add does not mutate inputs", () => {
  const a = [9, 9];
  const b = [1];
  const snapshotA = a.slice();
  const snapshotB = b.slice();
  add(a, b);
  assert.deepEqual(a, snapshotA);
  assert.deepEqual(b, snapshotB);
});

test("subtract requires a >= b and returns the difference", () => {
  assert.deepEqual(subtract([0, 1], [9]), [1]);
  assert.deepEqual(subtract([5], [5]), []);
  assert.deepEqual(subtract([6], [5]), [1]);
  // 123 - 54 = 69; result is normalized (no trailing zero).
  assert.deepEqual(subtract([3, 2, 1], [4, 5]), [9, 6]);
});

test("multiply by zero", () => {
  assert.deepEqual(multiply([], [1, 2, 3]), []);
  assert.deepEqual(multiply([1, 2, 3], []), []);
  assert.deepEqual(multiply([0], [0]), []);
});

test("multiply by one", () => {
  assert.deepEqual(multiply([1], [7, 8, 9]), [7, 8, 9]);
  assert.deepEqual(multiply([7, 8, 9], [1]), [7, 8, 9]);
});

test("single-digit times multi-digit equals scalar product", () => {
  assert.deepEqual(multiply([3], [7]), [1, 2]); // 21
  assert.deepEqual(multiply([7], [3]), [1, 2]);
  assert.deepEqual(multiply([2], [5, 0, 1]), [0, 1, 2]); // 2 * 105 = 210
});

test("recursion split path: two-digit times two-digit", () => {
  // 12 * 34 = 408. Forces the recursive branch since both operands have
  // length > 1 and neither is a single digit.
  assert.deepEqual(multiply([2, 1], [4, 3]), [8, 0, 4]);
});

test("unequal-length operands that need padding in the split", () => {
  // 123 (3 digits) * 4567 (4 digits) = 561741. The 4-digit operand forces
  // m = 2, so the 3-digit operand is split into a 2-digit low and 1-digit high.
  assert.equal(toString(multiply(fromString("123"), fromString("4567"))), "561741");
});

test("recursive product matches BigInt for medium inputs", () => {
  const x = "123456789";
  const y = "987654321";
  assert.equal(toString(multiply(fromString(x), fromString(y))), bigMul(x, y));
});

test("matches BigInt for a large asymmetric product", () => {
  const x = "11111111111111111111111111111111111111111111111111111111";
  const y = "99999999999999999999";
  assert.equal(toString(multiply(fromString(x), fromString(y))), bigMul(x, y));
});

test("matches BigInt for a large balanced product", () => {
  const x = "123456789012345678901234567890123456789012345678901234567890";
  const y = "987654321098765432109876543210987654321098765432109876543210";
  assert.equal(toString(multiply(fromString(x), fromString(y))), bigMul(x, y));
});

test("karatsuba is the same function object as multiply", () => {
  // Documents and locks the alias relationship promised by the README.
  assert.equal(karatsuba, multiply);
});
