import { test, expect, type Page } from '@playwright/test';

async function fixture(page: Page) {
  // Synthetic UI fixtures only; deterministic engine correctness is tested in pytest.
  const pokemon = Array.from({ length: 6 }, (_, i) => ({
    pokemonId: `pokemon:${i + 1}`,
    speciesId: i + 1,
    nameKo: `테스트${i + 1}`,
    nameEn: `test-${i + 1}`,
    types: i % 2 ? ['fire'] : ['grass'],
    championsEligibilityStatus: 'unknown',
    scope: 'generic',
    abilities: [],
    baseStats: {
      hp: 50,
      attack: 50,
      defense: 50,
      spAttack: 50,
      spDefense: 50,
      speed: 50,
    },
    sourceUrl: 'https://pokeapi.co/api/v2/pokemon/1/',
  }));
  const members = pokemon.map((p) => ({
    pokemonId: p.pokemonId,
    moves: [{ name: '입력한 공격', type: 'fire', category: 'physical' }],
    hpPercent: null,
    ability: null,
    item: null,
  }));
  let teams = [
    { teamId: 'seed', name: '테스트 구성', members, updatedAt: '2026-10-21' },
  ];
  let n = 0;
  const context = {
    scope: 'generic',
    assumptions: ['테스트 시나리오'],
    unknowns: ['Champions 참가 적격성 미확인'],
    citations: [
      {
        title: '테스트 출처',
        sourceUrl: 'https://pokeapi.co/docs/v2',
        collectedAt: '2026-10-21',
        scope: 'generic',
      },
    ],
  };
  await page.route('**/api/**', (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = decodeURIComponent(url.pathname);
    const body =
      req.method() !== 'GET' && req.method() !== 'DELETE'
        ? req.postDataJSON()
        : {};
    const ok = (data: unknown, status = 200) =>
      route.fulfill({ status, json: { data } });
    if (path === '/api/status')
      return ok({
        ready: true,
        missing: [],
        metadataCount: 6,
        modelConfigured: true,
      });
    if (path === '/api/session') return ok({ active: true });
    if (path === '/api/pokemon')
      return ok({
        items: pokemon.filter(
          (p) =>
            !url.searchParams.get('q') ||
            `${p.nameKo} ${p.nameEn}`.includes(url.searchParams.get('q')!),
        ),
        total: 6,
      });
    if (path.startsWith('/api/pokemon/'))
      return ok(pokemon.find((p) => path.endsWith(p.pokemonId)) ?? pokemon[0]);
    if (path === '/api/conversations') return ok({ items: [], total: 0 });
    if (path === '/api/teams' && req.method() === 'GET')
      return ok({ items: teams, total: teams.length });
    if (path === '/api/teams' && req.method() === 'POST') {
      const team = { ...body, teamId: `team-${++n}`, updatedAt: '2026-10-21' };
      teams.push(team);
      return ok(team, 201);
    }
    if (path.startsWith('/api/teams/') && req.method() === 'PUT') {
      const team = {
        ...body,
        teamId: path.split('/').at(-1),
        updatedAt: '2026-10-21',
      };
      teams = teams.map((t) => (t.teamId === team.teamId ? team : t));
      return ok(team);
    }
    if (path.startsWith('/api/teams/') && req.method() === 'DELETE') {
      teams = teams.filter((t) => !path.endsWith(t.teamId));
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/teams/analyze')
      return ok({
        ...context,
        members: members.map((m) => ({
          pokemonId: m.pokemonId,
          coverage: members.map((p) => ({
            pokemonId: p.pokemonId,
            multiplier: 2,
          })),
        })),
        sharedWeaknesses: [
          { attackType: 'water', weakCount: 3, resistCount: 3 },
        ],
        roleGaps: ['역할 판정 유보'],
      });
    if (path === '/api/teams/select') {
      const candidates = [];
      for (let a = 0; a < 4; a++)
        for (let b = a + 1; b < 5; b++)
          for (let c = b + 1; c < 6; c++)
            candidates.push({
              pokemonIds: [a, b, c].map((i) => pokemon[i].pokemonId),
              leadId: pokemon[a].pokemonId,
              score: 5,
              components: {
                coveredOpponents: 2,
                resistedScenarios: 1,
                sharedWeaknessPenalty: 0,
              },
            });
      return ok({ ...context, candidateCount: 20, candidates });
    }
    if (path === '/api/battle/recommend')
      return ok({
        ...context,
        notice: '타입만으로 최선 행동 확정하지 않음',
        options: [
          {
            kind: 'attack',
            label: '입력한 공격',
            pokemonId: members[0].pokemonId,
            multiplier: 2,
            reason: '일반 타입 상성',
            risks: ['실제 피해 미계산'],
            comparisonOrder: 1,
          },
        ],
        mega: {
          status: 'already_used',
          reason: '이미 사용한 상태. 추가 메가 후보 제외',
          typeComparison: null,
        },
      });
    return ok({}, 404);
  });
}

async function openTeams(page: Page) {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '근거와 함께 대화하기' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '팀과 전투 준비', exact: true })
    .click();
}

test('팀 편집·저장·갱신·복원·삭제 및 챗봇 질문 초안 연결', async ({ page }) => {
  await fixture(page);
  await openTeams(page);
  const own = page.getByRole('region', { name: '내 팀', exact: true });
  await own.getByRole('button', { name: '포켓몬 추가' }).click();
  await own.getByRole('button', { name: '테스트1 풀' }).click();
  await page.getByLabel('팀 이름', { exact: true }).fill('개인 구성');
  await page.getByRole('button', { name: '내 팀 저장', exact: true }).click();
  await expect(page.getByText('팀 저장 완료', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: '이 구성으로 챗봇에 질문 준비' })
    .click();
  await expect(page.getByLabel('포켓몬 질문')).toHaveValue(/내 팀\(테스트1\)/);
  await page
    .getByRole('button', { name: '팀과 전투 준비', exact: true })
    .click();
  await expect(own.getByText('테스트1', { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: '팀과 전투 준비', exact: true })
    .click();
  await page
    .getByLabel('저장한 내 팀', { exact: true })
    .selectOption({ label: '개인 구성' });
  await expect(own.getByText('테스트1', { exact: true })).toBeVisible();
  await page.getByLabel('팀 이름', { exact: true }).fill('수정한 구성');
  await page.getByRole('button', { name: '내 팀 저장', exact: true }).click();
  await expect(page.getByLabel('저장한 내 팀', { exact: true })).toContainText(
    '수정한 구성',
  );
  await page
    .getByRole('button', { name: '저장된 팀 삭제', exact: true })
    .click();
  await expect(
    page.getByLabel('저장한 내 팀', { exact: true }),
  ).not.toContainText('수정한 구성');
  await expect(own.getByText('테스트1', { exact: true })).toBeVisible();
});

test('선출 20개·근거·상성 결과 및 입력 변경 시 이전 결과 숨김', async ({
  page,
}) => {
  await fixture(page);
  await openTeams(page);
  await page.getByLabel('저장한 내 팀', { exact: true }).selectOption('seed');
  await page
    .getByLabel('상대 팀 불러오기', { exact: true })
    .selectOption('seed');
  await page.getByRole('button', { name: '타입 상성 분석' }).click();
  await expect(
    page.getByRole('heading', { name: '공격 커버리지 · 일반 타입 배율' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '3마리 선출 비교' }).click();
  await expect(
    page.getByRole('heading', { name: '선출 후보 20개 · 휴리스틱 점수' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: '팀 분석 결과' }).locator('ol > li'),
  ).toHaveCount(20);
  await expect(
    page.getByText('선출 점수는 비교용이며 승률이 아닙니다.', { exact: false }),
  ).toBeVisible();
  const own = page.getByRole('region', { name: '내 팀', exact: true });
  await own.getByRole('button', { name: '1번 멤버 제거', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '선출 후보 20개 · 휴리스틱 점수' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '3마리 선출 비교' }),
  ).toBeDisabled();
});

test('모바일 전투 비교·메가 사용 상태·가로 넘침 없음', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await openTeams(page);
  await page.getByLabel('저장한 내 팀', { exact: true }).selectOption('seed');
  await page
    .getByLabel('상대 팀 불러오기', { exact: true })
    .selectOption('seed');
  await page
    .getByRole('button', { name: '현재 전투 비교', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: '메가 사용 상태', exact: true })
    .selectOption('used');
  await expect(
    page.getByRole('combobox', { name: '전환 후 폼 비교', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '공격·교체 비교', exact: true })
    .click();
  await expect(
    page.getByText('입력한 공격 · 2×', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('이미 사용한 상태. 추가 메가 후보 제외', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('combobox', { name: '현재 내 포켓몬', exact: true })
    .selectOption('1');
  await expect(page.getByText('입력한 공격 · 2×', { exact: true })).toHaveCount(
    0,
  );
});
