import { test, expect } from 'vitest';
import { axes, calculateType, profiles, questions } from '../../frontend/src/features/pobti/model';

test('all answer combinations map deterministically to all sixteen types', () => {
  const counts = new Map<string, number>();
  for (let bits = 0; bits < 2 ** questions.length; bits++) {
    const answers = questions.map((_, index) => (bits >> index) & 1);
    const result = calculateType(answers);
    const expected = axes
      .map((axis, axisIndex) => {
        const votes = questions.flatMap((q, index) => (q.axis === axisIndex ? [answers[index]] : []));
        expect(votes).toHaveLength(3);
        return axis.letters[votes.filter((value) => value === 1).length >= 2 ? 1 : 0];
      })
      .join('');
    expect(result).toBe(expected);
    counts.set(result, (counts.get(result) ?? 0) + 1);
  }
  expect([...counts.keys()].sort()).toEqual(Object.keys(profiles).sort());
  expect([...counts.values()].every((count) => count === 256)).toBe(true);
  expect(() => calculateType([])).toThrow();
  expect(() => calculateType(Array(12).fill(2))).toThrow();
});
