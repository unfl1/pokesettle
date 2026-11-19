import type { Pokemon as CalcPokemon, StatID, StatsTable } from '@smogon/calc';

type InputStat = 'hp' | 'attack' | 'defense' | 'sp_attack' | 'sp_defense' | 'speed';
interface MemberInput { name: string; alignment: string; stat_points: Record<InputStat, number> }
interface CalculationInput { attacker: MemberInput; defender: MemberInput; move: string; neutral_conditions: boolean }

// No HTTP listener, user code, arbitrary move options, or automatic dependency installation.
const {Generations, Pokemon, Move, Field, calculate, toID}: typeof import('@smogon/calc') = require('@smogon/calc');
const {version}: {version: string} = require('@smogon/calc/package.json');
const fs: typeof import('node:fs') = require('node:fs');

const id = (value: string): ReturnType<typeof toID> => value.toLowerCase().replace(/[^a-z0-9]/g, '') as ReturnType<typeof toID>;
const supportedMoves = new Set((require('./supported_moves.json') as string[]).map(id));
const statKeys: Record<InputStat, StatID> = {hp: 'hp', attack: 'atk', defense: 'def', sp_attack: 'spa', sp_defense: 'spd', speed: 'spe'};

function run(input: CalculationInput) {
  if (version !== '0.12.0') return {ok: false, code: 'ENGINE_VERSION_MISMATCH'};
  const gen = Generations.get(0);
  if (input.neutral_conditions !== true) return {ok: false, code: 'UNSUPPORTED_CONDITIONS'};
  if (!supportedMoves.has(id(input.move))) return {ok: false, code: 'UNSUPPORTED_MOVE'};
  function pokemon(member: MemberInput) {
    const species = gen.species.get(id(member.name));
    if (!species) throw new Error('UNSUPPORTED_SPECIES');
    const points = Object.values(member.stat_points);
    if (points.length !== 6 || points.some(p => !Number.isInteger(p) || p < 0 || p > 32) ||
        points.reduce((a, b) => a + b, 0) > 66) throw new Error('INVALID_STAT_POINTS');
    if (!gen.natures.get(id(member.alignment))) throw new Error('UNSUPPORTED_ALIGNMENT');
    const evs = Object.fromEntries(Object.entries(statKeys).map(([key, engineKey]) => [engineKey, member.stat_points[key as InputStat]])) as Partial<StatsTable>;
    // Explicitly neutralize abilities instead of accidentally using the species default.
    return new Pokemon(gen, species.name, {evs, nature: member.alignment, ability: 'No Ability', item: ''});
  }
  const attacker = pokemon(input.attacker);
  const defender = pokemon(input.defender);
  const move = new Move(gen, input.move);
  const result = calculate(gen, attacker, defender, move, new Field({gameType: 'Singles'}));
  const rolls = result.damage;
  if (!Array.isArray(rolls) || rolls.length !== 16 ||
      rolls.some(n => typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0)) {
    // The library represents immunity as scalar 0, not a sixteen-entry distribution.
    if (rolls !== 0) return {ok: false, code: 'UNSUPPORTED_DAMAGE_SHAPE'};
  }
  const values: number[] = rolls === 0 ? Array<number>(16).fill(0) : rolls as number[];
  const stats = (p: CalcPokemon) => Object.fromEntries(Object.entries(statKeys).map(([key, engineKey]) => [key, p.rawStats[engineKey]]));
  return {ok: true, result: {
    rolls: values, minimum: Math.min(...values), maximum: Math.max(...values),
    attacker_stats: stats(attacker), defender_stats: stats(defender),
    move: {name: move.name, type: move.type, category: move.category, power: move.bp},
  }};
}

try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8')) as CalculationInput;
  process.stdout.write(JSON.stringify(run(input)));
} catch (error) {
  const known = new Set(['UNSUPPORTED_SPECIES', 'INVALID_STAT_POINTS', 'UNSUPPORTED_ALIGNMENT']);
  process.stdout.write(JSON.stringify({ok: false, code: error instanceof Error && known.has(error.message) ? error.message : 'ENGINE_FAILURE'}));
}
