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
      return ok({ ...context, candidateCount: 20, candidates, recommendation: {
        pokemonIds: candidates[0].pokemonIds, leadId: candidates[0].leadId,
        leadReason: '타입 커버와 반감 대응 비교',
        members: candidates[0].pokemonIds.map(pokemonId => ({pokemonId, attackAssumed: true, attackTargets: ['pokemon:2'], resistTargets: ['pokemon:1']})),
        matchups: pokemon.map(p => ({opponentId: p.pokemonId, attackerId: 'pokemon:1', attackType: 'fire', attackMultiplier: 2, attackAssumed: true, incomingTypes: ['grass'], incomingAssumed: true, pivotId: 'pokemon:2', pivotMultiplier: 0.5, leadAction: 'attack', leadAttackType: 'fire', leadAttackMultiplier: 2, leadIncomingMultiplier: 1})),
        uncoveredOpponentIds: [], noResistOpponentIds: ['pokemon:2'],
      } });
    }
    if (path.startsWith('/api/battle/damage/moves/')) return ok({
      pokemonId: path.split('/').at(-1), versionGroup: 'synthetic-reference', championsLearnsetVerified: false,
      items: path.endsWith('pokemon:2') ? [] : [
        {name: 'thunderbolt', nameKo: '10만볼트', type: 'electric', category: 'special', power: 90, accuracy: 100, supported: true, unsupportedReason: null, methods: ['machine']},
        {name: 'volt-tackle', nameKo: '볼트태클', type: 'electric', category: 'physical', power: 120, accuracy: 100, supported: true, unsupportedReason: null, methods: ['egg']},
        {name: 'double-slap', nameKo: '연속뺨치기', type: 'normal', category: 'physical', power: 15, accuracy: 85, supported: false, unsupportedReason: '연속 공격 미지원', methods: ['level-up']},
        {name: 'surf', nameKo: '파도타기', type: 'water', category: 'special', power: 90, accuracy: 100, supported: true, unsupportedReason: null, methods: ['machine']},
      ],
    });
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
  await page.goto('/chat');
  await expect(
    page.getByRole('heading', { name: '전략 챗봇' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: '6:6 시나리오', exact: true })
    .click();
}

test('팀 편집·저장·갱신·복원·삭제 및 챗봇 질문 초안 연결', async ({ page }) => {
  await fixture(page);
  await openTeams(page);
  const own = page.getByRole('region', { name: '내 팀', exact: true });
  await own.getByRole('button', { name: '포켓몬 추가' }).click();
  await own.getByRole('button', { name: '테스트1 풀' }).click();
  await page.getByRole('textbox', { name: '팀 이름', exact: true }).fill('개인 구성');
  await page.getByRole('button', { name: '내 팀 저장', exact: true }).click();
  await expect(page.getByText('팀 저장 완료', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: '이 구성으로 챗봇에 질문 준비' })
    .click();
  await expect(page.getByRole('textbox', { name: '포켓몬 질문', exact: true })).toHaveValue(/내 팀\(테스트1\)/);
  await page
    .getByRole('link', { name: '6:6 시나리오', exact: true })
    .click();
  await expect(own.getByText('테스트1', { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole('link', { name: '6:6 시나리오', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: '저장한 내 팀', exact: true })
    .selectOption({ label: '개인 구성' });
  await expect(own.getByText('테스트1', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '팀 이름', exact: true }).fill('수정한 구성');
  await page.getByRole('button', { name: '내 팀 저장', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '저장한 내 팀', exact: true })).toContainText(
    '수정한 구성',
  );
  await page
    .getByRole('button', { name: '저장된 팀 삭제', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: '저장한 내 팀', exact: true }),
  ).not.toContainText('수정한 구성');
  await expect(own.getByText('테스트1', { exact: true })).toBeVisible();
});

test('선출 20개·근거·상성 결과 및 입력 변경 시 이전 결과 숨김', async ({
  page,
}) => {
  await fixture(page);
  await openTeams(page);
  await page.getByRole('combobox', { name: '저장한 내 팀', exact: true }).selectOption('seed');
  await page
    .getByRole('combobox', { name: '상대 팀 불러오기', exact: true })
    .selectOption('seed');
  await page.getByRole('button', { name: '타입 상성 분석' }).click();
  await expect(
    page.getByRole('heading', { name: '공격 커버리지 · 일반 타입 배율' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '3마리·선봉 추천' }).click();
  const recommendation = page.getByRole('region', { name: '추천 선출과 운영' });
  await expect(recommendation.getByRole('heading', { name: '추천 3마리와 선봉' })).toBeVisible();
  await expect(recommendation.locator('article')).toHaveCount(6);
  await expect(page.getByText('다른 조합과 점수 비교', { exact: true })).toBeVisible();
  await page.getByText('다른 조합과 점수 비교', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '선출 후보 20개 · 휴리스틱 점수' }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: '팀 분석 결과' }).locator('ol > li'),
  ).toHaveCount(20);
  await page.getByText('타입 상성 기반 참고용 · 승률과 실제 피해를 보장하지 않아요', { exact: true }).click();
  await expect(
    page.getByText('선출 점수는 비교용이며 승률이 아닙니다.', { exact: false }),
  ).toBeVisible();
  const own = page.getByRole('region', { name: '내 팀', exact: true });
  await own.getByRole('button', { name: '1번 멤버 제거', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '선출 후보 20개 · 휴리스틱 점수' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '3마리·선봉 추천' }),
  ).toBeDisabled();
});

test('모바일 전투 비교·메가 사용 상태·가로 넘침 없음', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await openTeams(page);
  await page.getByRole('combobox', { name: '저장한 내 팀', exact: true }).selectOption('seed');
  await page
    .getByRole('combobox', { name: '상대 팀 불러오기', exact: true })
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

test('참조 피해 검증·재시도·입력 변경 및 멤버 제거 시 결과 숨김', async ({ page }) => {
  await fixture(page);
  let calls = 0;
  await page.route('**/api/battle/damage', async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    expect(body.attacker.pokemonId).toBe('pokemon:1');
    expect(body.defender.pokemonId).toBe('pokemon:2');
    expect(body.attacker.statPoints.spAttack).toBe(32);
    expect(body.attacker.alignment).toBe('Modest');
    expect(body.neutralConditions).toBe(true);
    expect(body.move).toBe('thunderbolt');
    expect(body.defenderCurrentHp).toBeNull();
    expect(body.attacker).not.toHaveProperty('ability');
    if (calls === 1) return route.fulfill({ status: 503, json: {
      error: { code: 'DAMAGE_ENGINE_NOT_READY', message: '계산기 연결 확인' },
    } });
    // Synthetic UI fixture only; not an in-game measurement.
    return route.fulfill({ json: { data: {
      engine: { name: '@smogon/calc', version: '0.12.0', level: 50 },
      calculation: { conditionalKo: { currentHp: 150, maximumHp: 150, hpBasis: 'full_hp_assumed', qualifyingRolls: 0, totalRolls: 16, outcome: 'none' }, damage: { minimum: 10, maximum: 20, rolls: Array(16).fill(10),
        defenderStats: { hp: 150 }, move: { name: 'Thunderbolt', power: 90 } } },
      assumptions: ['테스트 조건'], unknowns: ['실측 미검증'],
      citations: [{ title: 'Smogon', sourceUrl: 'https://github.com/smogon/damage-calc', version: '0.12.0' }],
    } } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await openTeams(page);
  await page.getByRole('combobox', { name: '저장한 내 팀', exact: true }).selectOption('seed');
  await page.getByRole('combobox', { name: '상대 팀 불러오기', exact: true }).selectOption('seed');
  await page.getByRole('button', { name: '피해 계산', exact: true }).click();
  const panel = page.getByRole('region', { name: '참조 데미지 계산', exact: true });
  const submit = panel.getByRole('button', { name: '참조 피해 계산', exact: true });
  await expect(submit).toBeDisabled();
  await panel.getByLabel('공격자 포켓몬').selectOption('pokemon:1');
  await panel.getByLabel('계산 기술', { exact: true }).selectOption('thunderbolt');
  await panel.getByLabel('방어자 포켓몬').selectOption('pokemon:2');
  await panel.getByLabel('공격자 성향').selectOption('Modest');
  await panel.getByLabel('공격자 특수공격', { exact: true }).fill('32');
  await expect(submit).toBeDisabled();
  await panel.getByRole('checkbox').check();
  await panel.getByLabel('방어자 남은 HP (실수치)', { exact: true }).fill('0');
  await expect(submit).toBeDisabled();
  await panel.getByLabel('방어자 남은 HP (실수치)', { exact: true }).fill('1.5');
  await expect(submit).toBeDisabled();
  await panel.getByLabel('방어자 남은 HP (실수치)', { exact: true }).fill('');
  await panel.getByLabel('공격자 HP', { exact: true }).fill('33');
  await expect(submit).toBeDisabled();
  await panel.getByLabel('공격자 HP', { exact: true }).fill('32');
  await panel.getByLabel('공격자 공격', { exact: true }).fill('3');
  await expect(submit).toBeDisabled();
  await panel.getByLabel('공격자 공격', { exact: true }).fill('');
  await expect(submit).toBeDisabled();
  await panel.getByLabel('공격자 공격', { exact: true }).fill('0');
  await submit.click();
  await expect(panel.getByRole('alert')).toContainText('계산기 연결 확인');
  await submit.click();
  await expect(panel.getByRole('heading', { name: '참조 피해 범위: 10–20 HP' })).toBeVisible();
  await expect(panel.getByText('KO 확률·승률 미제공 · 실제 게임 대조 미검증')).toBeVisible();
  await panel.getByText('피해 후보 16개·계산 가정·출처').click();
  await expect(panel.getByRole('link', { name: 'Smogon' })).toHaveAttribute('href', 'https://github.com/smogon/damage-calc');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.getByLabel('방어자 성향').selectOption('Bold');
  await expect(panel.getByText('참조 피해 범위:', { exact: false })).toHaveCount(0);
  await panel.getByLabel('방어자 성향').selectOption('Hardy');
  await expect(panel.getByText('참조 피해 범위:', { exact: false })).toBeVisible();
  await page.getByRole('region', { name: '내 팀', exact: true }).getByRole('button', { name: '1번 멤버 제거', exact: true }).click();
  await expect(submit).toBeDisabled();
  await expect(panel.getByText('참조 피해 범위:', { exact: false })).toHaveCount(0);
});


test('메뉴 왕복 시 편집 중인 팀과 전투 입력 유지', async ({ page }) => {
  await fixture(page);
  await page.goto('/scenario');
  await page.getByRole('combobox', { name: '저장한 내 팀', exact: true }).selectOption('seed');
  await page.getByRole('combobox', { name: '상대 팀 불러오기', exact: true }).selectOption('seed');
  await page.getByRole('textbox', { name: '팀 이름', exact: true }).fill('편집 중인 팀');
  await page.getByRole('button', { name: '현재 전투 비교', exact: true }).click();
  await page.getByRole('combobox', { name: '메가 사용 상태', exact: true }).selectOption('used');
  await page.getByRole('link', { name: '챗봇', exact: true }).click();
  await expect(page.getByRole('region', { name: '내 팀', exact: true })).toBeHidden();
  await page.getByRole('textbox', { name: '포켓몬 질문', exact: true }).fill('메뉴를 오가도 유지할 질문');
  await page.getByRole('link', { name: '6:6 시나리오', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '팀 이름', exact: true })).toHaveValue('편집 중인 팀');
  await expect(page.getByRole('combobox', { name: '메가 사용 상태', exact: true })).toHaveValue('used');
  await page.getByRole('link', { name: '챗봇', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '포켓몬 질문', exact: true })).toHaveValue('메뉴를 오가도 유지할 질문');
  await page.getByRole('link', { name: 'PokeSettle 홈', exact: true }).click();
  await page.getByRole('navigation', { name: '시작할 메뉴 선택' }).getByRole('link', { name: /챗봇/ }).click();
  await expect(page.getByRole('textbox', { name: '포켓몬 질문', exact: true })).toHaveValue('메뉴를 오가도 유지할 질문');
  await page.getByRole('link', { name: '6:6 시나리오', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '팀 이름', exact: true })).toHaveValue('편집 중인 팀');
  await expect(page.getByRole('combobox', { name: '저장한 내 팀', exact: true })).toHaveValue('seed');
  await expect(page.getByRole('combobox', { name: '메가 사용 상태', exact: true })).toHaveValue('used');
  expect(await page.evaluate(() => sessionStorage.getItem('poketact-navigation-draft'))).toBeNull();
});


test('추천 선봉 적용과 전략 근거 질문 연결', async ({ page }) => {
  await fixture(page);
  await openTeams(page);
  await page.getByRole('combobox', { name: '저장한 내 팀', exact: true }).selectOption('seed');
  await page.getByRole('combobox', { name: '상대 팀 불러오기', exact: true }).selectOption('seed');
  await page.getByRole('button', { name: '3마리·선봉 추천', exact: true }).click();
  await page.getByRole('button', { name: '추천 선봉으로 전투 비교', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '현재 내 포켓몬', exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: '팀·선출 비교', exact: true }).click();
  await page.getByRole('button', { name: '이 선출의 전략 근거 질문하기', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '포켓몬 질문', exact: true })).toHaveValue(/추천 선출은 테스트1, 테스트2, 테스트3이고 선봉은 테스트1/);
  await expect(page.getByRole('textbox', { name: '포켓몬 질문', exact: true })).toHaveValue(/입력한 공격/);
});


test('피해 계산 기술의 타입·습득 필터 및 공격자 변경 초기화', async ({ page }) => {
  await fixture(page);
  await openTeams(page);
  await page.getByRole('combobox', { name: '저장한 내 팀', exact: true }).selectOption('seed');
  await page.getByRole('combobox', { name: '상대 팀 불러오기', exact: true }).selectOption('seed');
  await page.getByRole('button', { name: '피해 계산', exact: true }).click();
  const panel = page.getByRole('region', { name: '참조 데미지 계산', exact: true });
  await panel.getByLabel('공격자 포켓몬').selectOption('pokemon:1');
  const moves = panel.getByLabel('계산 기술', { exact: true });
  await expect(moves.locator('option[value="double-slap"]')).toHaveAttribute('disabled', '');
  await panel.getByLabel('계산 기술 타입', { exact: true }).selectOption('electric');
  await expect(moves.locator('option[value="surf"]')).toHaveCount(0);
  await panel.getByLabel('계산 기술 습득 방법', { exact: true }).selectOption('machine');
  await expect(moves.locator('option[value="volt-tackle"]')).toHaveCount(0);
  await moves.selectOption('thunderbolt');
  await expect(panel.getByText(/Champions 육성 기준/)).toHaveCount(2);
  await panel.getByLabel('공격자 포켓몬').selectOption('pokemon:2');
  await expect(moves).toHaveValue('');
  await expect(panel.getByRole('button', { name: '참조 피해 계산', exact: true })).toBeDisabled();
});

test('구성 진행 안내와 목적별 분석 전환 및 계산 입력 유지', async ({ page }) => {
  await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openTeams(page);
  await expect(page.getByText('선출 추천까지 내 팀 6마리, 상대 팀 6마리를 더 추가하세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '3마리·선봉 추천', exact: true })).toBeDisabled();
  const damage = page.getByRole('region', { name: '참조 데미지 계산', exact: true });
  await expect(damage).toBeHidden();
  await page.getByLabel('저장한 내 팀', { exact: true }).selectOption('seed');
  await expect(page.getByText('선출 추천까지 내 팀 0마리, 상대 팀 6마리를 더 추가하세요.')).toBeVisible();
  await page.getByLabel('상대 팀 불러오기', { exact: true }).selectOption('seed');
  await expect(page.getByText('준비 완료! 선출 추천을 눌러 조합을 확인하세요.')).toBeVisible();
  await expect(page.getByRole('button', { name: '3마리·선봉 추천', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '피해 계산', exact: true }).click();
  await expect(page.getByRole('region', { name: '팀 분석 결과', exact: true })).toHaveCount(0);
  await damage.getByLabel('공격자 포켓몬').selectOption('pokemon:1');
  await page.getByRole('button', { name: '현재 전투 비교', exact: true }).click();
  await expect(damage).toBeHidden();
  await expect(page.getByRole('region', { name: '전투 분석', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '피해 계산', exact: true }).click();
  await expect(damage.getByLabel('공격자 포켓몬')).toHaveValue('pokemon:1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
