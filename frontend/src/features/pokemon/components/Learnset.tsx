import 'server-only';
import type { Locale } from '../../../i18n/config';
import { createTranslator, type Dictionary } from '../../../i18n/translate';
import { referenceName } from '../routing';
import { typeLabels } from '../typeNames';
import type { PokemonDetail } from '../types';
import LearnsetFilters, { type LearnsetGroup } from './LearnsetFilters';

export default function Learnset({ pokemon, locale, dictionary }: { pokemon: Pick<PokemonDetail, 'learnset'>; locale: Locale; dictionary: Dictionary }) {
  const t = createTranslator(dictionary);
  const learnset = pokemon.learnset;
  if (!learnset) return <div id="pokemon-learnset" className="scroll-mt-28 mt-4 mb-4 text-[14px]" data-testid="pokemon-learnset"><h3 className="font-medium mb-2">{t('배울 수 있는 기술')}</h3><p className="text-muted">{t('이 포켓몬의 버전별 기술 습득 자료가 아직 등록되지 않았습니다.')}</p></div>;
  const methodLabels: Record<string, string> = { 'level-up': t('레벨업'), machine: t('기술머신·비전머신'), egg: t('알 기술'), tutor: t('기술 가르침'), train: t('트레이닝') };
  const types = [...Object.keys(typeLabels), 'unknown', ...new Set(learnset.moves.map(move => move.type).filter((type): type is string => !!type && !(type in typeLabels)))];
  const statLabels: Record<string, string> = { attack: t('공격'), defense: t('방어'), 'special-attack': t('특공'), 'special-defense': t('특방'), speed: t('스피드'), accuracy: t('명중률'), evasion: t('회피율') };
  function effectFor(move: NonNullable<PokemonDetail['learnset']>['moves'][number]) {
    const source = move.effectTexts?.[locale] ?? move.effectTexts?.en;
    const language = move.effectTexts?.[locale] ? locale : 'en';
    const meta = move.effectMeta;
    const parts: string[] = [];
    const changes = move.statTarget && move.statChanges?.length && move.statChanges.every(change => statLabels[change.stat])
      ? move.statChanges.map(change => `${statLabels[change.stat]} ${change.change > 0 ? '+' : ''}${change.change}`).join(' · ') : null;
    if (changes) parts.push(`${move.statTarget === 'user' ? t('자신') : t('대상')} ${changes}${move.statChance != null && move.statChance > 0 && move.statChance < 100 ? ` (${move.statChance}%)` : ''}`);
    const ailments: Record<string, string> = { paralysis: '마비', sleep: '수면', freeze: '얼음 상태', burn: '화상', poison: '독 상태', confusion: '혼란', infatuation: '헤롱헤롱', trap: '교체 제한', nightmare: '악몽', torment: '연속 기술 제한', disable: '기술 봉인', yawn: '다음 턴 수면', 'heal-block': '회복 봉인', 'leech-seed': '씨뿌리기', embargo: '도구 사용 봉인', 'perish-song': '멸망의노래', ingrain: '뿌리박기', silence: '소리 기술 봉인', 'tar-shot': '불꽃 약점 부여' };
    if (meta?.ailment && ailments[meta.ailment]) {
      const chance = meta.ailmentChance;
      const label = t(ailments[meta.ailment]);
      parts.push(chance != null && chance > 0 ? `${label} ${chance}%` : meta.category === 'damage-ailment' ? t('일정 확률 {effect}', { effect: label }) : label);
    }
    if (meta?.flinchChance && meta.flinchChance > 0) parts.push(`${t('풀죽음')} ${meta.flinchChance}%`);
    if (meta?.healing && meta.healing > 0) parts.push(t('HP {percent}% 회복', { percent: meta.healing }));
    if (meta?.drain && meta.drain > 0) parts.push(t('피해량 {percent}% 흡수', { percent: meta.drain }));
    if (meta?.drain && meta.drain < 0) parts.push(t('피해량 {percent}% 반동', { percent: -meta.drain }));
    if (meta?.critRate && meta.critRate > 0) parts.push(t('급소율 증가'));
    if (meta?.minHits && meta.maxHits) parts.push(meta.minHits === meta.maxHits ? t('{count}회 공격', { count: meta.minHits }) : t('{min}~{max}회 공격', { min: meta.minHits, max: meta.maxHits }));
    if (meta?.category === 'ohko') parts.push(t('일격기'));
    if (meta?.category === 'force-switch') parts.push(t('대상 강제 교체'));
    if (meta?.priority) parts.push(`${t('우선도')} ${meta.priority > 0 ? '+' : ''}${meta.priority}`);
    const tags: Record<string, string> = { 'reset-stages': '능력 변화 초기화', 'special-screen': '특수 피해 감소', 'physical-screen': '물리 피해 감소', substitute: 'HP ¼ 소모 · 대타 생성', encore: '직전 기술 반복', protect: '자신 보호', spikes: '압정 설치', 'remove-hazards': '구속·설치물 제거', 'first-turn-only': '등장 첫 턴 한정', taunt: '변화기 봉인', 'remove-item': '도구 제거', tailwind: '아군 스피드 2배', 'switch-user': '공격 후 자신 교체', 'toxic-spikes': '독압정 설치', 'trick-room': '스피드 역순 행동', 'stealth-rock': '교체 시 바위 피해', 'sticky-web': '교체 시 스피드 -1' };
    for (const tag of meta?.tags ?? []) if (tags[tag]) parts.push(t(tags[tag]));
    const summary = parts.length ? parts.join(' · ') : source?.text ? t('기타 효과') : null;
    return summary ? { summary, description: source?.text ?? null, language, version: source?.versionGroup ?? null } : null;
  }
  const groups: LearnsetGroup[] = types.flatMap(type => {
    const moves = learnset.moves.filter(move => (move.type ?? 'unknown') === type);
    if (!moves.length) return [];
    return [{ type, label: t(typeLabels[type] ?? (type === 'unknown' ? '타입 미확인' : type)),
      moves: [...new Set(moves.map(move => move.name))].map(name => {
        const entries = moves.filter(move => move.name === name);
        const move = entries[0];
        return { name, label: referenceName(move, locale), category: move.category ?? null, power: move.power ?? null, accuracy: move.accuracy ?? null, pp: move.pp ?? null, effect: effectFor(move),
          methods: entries.map(entry => ({ method: entry.method, label: entry.method === 'level-up' ? t('레벨업 Lv.{level}', { level: entry.level ?? '—' }) : methodLabels[entry.method] ?? entry.method })),
        };
      }),
    }];
  });
  const methods = Object.entries(methodLabels).filter(([method]) => learnset.moves.some(move => move.method === method));
  return <LearnsetFilters groups={groups} methods={methods} />;
}
