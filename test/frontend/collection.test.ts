import { test, expect } from 'vitest';
import {
  catchCooldownMs,
  parseCollection,
  parseNextCatchAt,
  pickUncaught,
} from '../../frontend/src/features/collection/storage';

test('수집 데이터는 1세대 정수만 허용하며 중복과 범위 밖 ID 제외', () => {
  expect(parseCollection('[151,1,1,0,152,10025,"25",2.5,null]')).toEqual([1, 151]);
  expect(parseCollection(null)).toEqual([]);
  expect(() => parseCollection('{')).toThrow();
  expect(() => parseCollection('{}')).toThrow();
  const all = Array.from({ length: 151 }, (_, index) => index + 1);
  expect(pickUncaught(all)).toBeNull();
  expect(pickUncaught(all.filter((id) => id !== 25))).toBe(25);
  expect(catchCooldownMs).toBe(600_000);
  for (const raw of [null, 'bad', '-1', 'Infinity', '1.5']) expect(parseNextCatchAt(raw)).toBe(0);
  expect(parseNextCatchAt('1800000000000')).toBe(1800000000000);
});
