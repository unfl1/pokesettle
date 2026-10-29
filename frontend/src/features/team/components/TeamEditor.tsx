import { useI18n } from '../../../i18n/I18nProvider';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { pokemonApi } from '../../pokemon/api';
import type { TeamMember, MoveInput } from '../types';
import { TypeBadge } from '../../pokemon/components/TypeBadge';
import { useTypeLabels } from '../../pokemon/typeLabels';
import PokemonImage from '../../pokemon/components/PokemonImage';

export const control =
  'rounded-[6px] border border-line bg-canvas px-3 py-2 text-[14px] text-ink min-w-0';
export const action =
  'rounded-[6px] border border-accent/25 px-3 py-2 text-[14px] text-accent disabled:opacity-40';

function MemberCard({
  member,
  index,
  onChange,
  onRemove,
}: {
  member: TeamMember;
  index: number;
  onChange: (value: TeamMember) => void;
  onRemove: () => void;
}) {
  const typeLabels = useTypeLabels();
  const { t: translate } = useI18n();
  const detail = useQuery({
    queryKey: ['team-pokemon', member.pokemonId],
    queryFn: () => pokemonApi.detail(member.pokemonId),
    staleTime: 60000,
  });
  const p = detail.data;
  return (
    <li className="rounded-[8px] border border-line p-3">
      <div className="flex items-center gap-2">
        <span className="text-[14px] text-muted">{index + 1}</span>
        {p && <PokemonImage pokemon={p} size="small" />}
        <strong className="min-w-0 flex-1 text-[14px] font-medium wrap-anywhere">
          {p?.nameKo ?? p?.nameEn ?? member.pokemonId}
        </strong>
        {p?.types.map((t) => (
          <TypeBadge type={t} key={t} />
        ))}
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] text-muted hover:bg-canvas"
          onClick={onRemove}
          aria-label={translate('{number}번 멤버 제거', { number: index + 1 })}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {detail.error && (
        <p role="alert" className="mt-2 text-[14px] text-warning">
          {detail.error.message}
        </p>
      )}
      <details className="mt-2 text-[14px] text-muted">
        <summary className="cursor-pointer">{translate("기술·HP·알려진 정보 입력")}</summary>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
             {translate("남은 HP (%)")} <input
              className={control}
              aria-label={translate('{number}번 HP', { number: index + 1 })}
              type="number"
              min="0"
              max="100"
              value={member.hpPercent ?? ''}
              placeholder={translate("미확인")}
              onChange={(e) =>
                onChange({
                  ...member,
                  hpPercent:
                    e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
             {translate("특성")} <input
              className={control}
              maxLength={80}
              value={member.ability ?? ''}
              placeholder={translate("미확인")}
              onChange={(e) =>
                onChange({ ...member, ability: e.target.value || null })
              }
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1">
             {translate("도구")} <input
              className={control}
              maxLength={80}
              value={member.item ?? ''}
              placeholder={translate("미확인 · 효과 계산 제외")}
              onChange={(e) =>
                onChange({ ...member, item: e.target.value || null })
              }
            />
          </label>
        </div>
        <p className="my-2 leading-[1.8]">
           {translate("기술은 직접 입력한 시나리오입니다. 실제 습득·사용 가능 여부는 미확인입니다.")} </p>
        {member.moves.map((move, slot) => (
          <div
            className="mb-2 grid grid-cols-[minmax(0,1fr)_72px_72px_24px] gap-1"
            key={slot}
          >
            <input
              className={control}
              aria-label={translate('{number}번 기술 {slot} 이름', { number: index + 1, slot: slot + 1 })}
              value={move.name}
              maxLength={80}
              placeholder={translate("기술 이름")}
              onChange={(e) =>
                onChange({
                  ...member,
                  moves: member.moves.map((m, n) =>
                    n === slot ? { ...m, name: e.target.value } : m,
                  ),
                })
              }
            />
            <select
              className={control}
              aria-label={translate('{number}번 기술 {slot} 타입', { number: index + 1, slot: slot + 1 })}
              value={move.type}
              onChange={(e) =>
                onChange({
                  ...member,
                  moves: member.moves.map((m, n) =>
                    n === slot ? { ...m, type: e.target.value } : m,
                  ),
                })
              }
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className={control}
              aria-label={translate('{number}번 기술 {slot} 분류', { number: index + 1, slot: slot + 1 })}
              value={move.category}
              onChange={(e) =>
                onChange({
                  ...member,
                  moves: member.moves.map((m, n) =>
                    n === slot
                      ? {
                          ...m,
                          category: e.target.value as MoveInput['category'],
                        }
                      : m,
                  ),
                })
              }
            >
              <option value="physical">{translate("물리")}</option>
              <option value="special">{translate("특수")}</option>
              <option value="status">{translate("변화")}</option>
            </select>
            <button
              aria-label={translate('기술 {slot} 제거', { slot: slot + 1 })}
              onClick={() =>
                onChange({
                  ...member,
                  moves: member.moves.filter((_, n) => n !== slot),
                })
              }
            >
              ×
            </button>
          </div>
        ))}
        {member.moves.length < 4 && (
          <button
            className={action}
            onClick={() =>
              onChange({
                ...member,
                moves: [
                  ...member.moves,
                  {
                    name: '',
                    type: p?.types[0] ?? 'normal',
                    category: 'physical',
                  },
                ],
              })
            }
          >
             {translate("기술 추가")} </button>
        )}
      </details>
    </li>
  );
}

export default function TeamEditor({
  title,
  members,
  onChange,
  children,
}: {
  children?: ReactNode;
  title: string;
  members: TeamMember[];
  onChange: (value: TeamMember[]) => void;
}) {
  const { t: translate } = useI18n();
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const found = useQuery({
    queryKey: ['team-search', query, offset],
    queryFn: () => pokemonApi.pokemon(query, offset),
    enabled: open,
  });
  return (
    <section
      className="min-w-0 rounded-[12px] border border-line bg-surface p-4"
      aria-label={title}
    >
      <h2 className="mb-3 text-[14px] font-semibold">
        {title}{' '}
        <span className="text-[14px] font-normal text-muted">
          {members.length} / 6
        </span>
      </h2>
      {children && <div className="mb-4 flex flex-wrap items-end gap-2 border-b border-line pb-4">{children}</div>}
      <ul className="flex flex-col gap-2">
        {members.map((m, index) => (
          <MemberCard
            key={m.pokemonId}
            member={m}
            index={index}
            onRemove={() => onChange(members.filter((_, i) => i !== index))}
            onChange={(value) =>
              onChange(members.map((old, i) => (i === index ? value : old)))
            }
          />
        ))}
      </ul>
      {members.length < 6 && <div className="mt-3 flex gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index < members.length ? 'bg-accent' : 'bg-line'}`} />)}
      </div>}
      {!members.length && (
        <p className="py-6 text-center text-[14px] text-muted">{translate("포켓몬을 추가해 팀을 구성하세요.")}</p>
      )}
      {members.length < 6 && (
        <button
          className={`${action} mt-3 flex w-full items-center justify-center gap-2`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Plus size={14} />
           {translate("포켓몬 추가")} </button>
      )}
      {open && members.length < 6 && (
        <div className="mt-3">
          <input
            className={`${control} w-full`}
            aria-label={translate('{title} 포켓몬 검색', { title })}
            maxLength={200}
            placeholder={translate("포켓몬 이름 검색")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
          />
          {found.isFetching && (
            <p role="status" className="py-2 text-[14px] text-accent">
               {translate("검색 중…")} </p>
          )}
          {found.error && (
            <p role="alert" className="py-2 text-[14px] text-warning">
              {found.error.message}
              <button className={action} onClick={() => void found.refetch()}>
                 {translate("다시 시도")} </button>
            </p>
          )}
          {!found.isPending && !found.error && !found.data?.items.length && (
            <p className="py-3 text-[14px]">{translate("검색 결과가 없습니다.")}</p>
          )}
          <div className="my-2 max-h-55 overflow-auto">
            {found.data?.items.map((p) => (
              <button
                className="flex w-full items-center gap-2 rounded-[6px] p-2 text-left text-[14px] hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
                key={p.pokemonId}
                disabled={members.some(
                  (m) =>
                    m.pokemonId === p.pokemonId ||
                    (p.speciesId !== undefined &&
                      String(p.speciesId) === m.pokemonId.split(':')[1]),
                )}
                onClick={() => {
                  onChange([
                    ...members,
                    {
                      pokemonId: p.pokemonId,
                      moves: [],
                      hpPercent: null,
                      item: null,
                      ability: null,
                    },
                  ]);
                  setOpen(false);
                }}
              >
                <PokemonImage pokemon={p} size="small" />
                {p.nameKo ?? p.nameEn}
                <span className="ml-auto flex gap-1">
                  {p.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <button
              className={action}
              disabled={offset === 0 || found.isFetching}
              onClick={() => setOffset(Math.max(0, offset - 100))}
            >
               {translate("이전")} </button>
            <span className="text-[14px] text-muted">
              {offset + 1}–{offset + (found.data?.items.length ?? 0)} /{' '}
              {found.data?.total ?? 0}
            </span>
            <button
              className={action}
              disabled={
                found.isFetching || offset + 100 >= (found.data?.total ?? 0)
              }
              onClick={() => setOffset(offset + 100)}
            >
               {translate("다음")} </button>
          </div>
        </div>
      )}
    </section>
  );
}
