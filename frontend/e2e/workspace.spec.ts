import { test, expect, type Page } from '@playwright/test';

async function fixture(page: Page, missing: string[] = [], abstain = false, wiki = false, curated = false, coach = false) {
  const pokemon = [
    {
      pokemonId: 'pokemon:25',
      nameKo: '피카츄',
      nameEn: 'pikachu',
      types: ['electric'],
      scope: 'generic',
      championsEligibilityStatus: 'unknown',
    },
    {
      pokemonId: 'pokemon:1',
      nameKo: '이상해씨',
      nameEn: 'bulbasaur',
      types: ['grass', 'poison'],
      scope: 'generic',
      championsEligibilityStatus: 'unknown',
    },
  ];
  const conversations: Record<
    string,
    {
      conversationId: string;
      pokemonId: string;
      title: string;
      messageCount: number;
    }[]
  > = {};
  const messages: Record<string, unknown[]> = {};
  const jobs: Record<
    string,
    { polls: number; question: string; kind: string; conversationId: string }
  > = {};
  let number = 0,
    failNext = false;
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = decodeURIComponent(url.pathname),
      body = request.method() === 'POST' ? request.postDataJSON() : {};
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        json: { data, warnings: [], requestId: 'test' },
      });
    if (path === '/api/status')
      return ok({
        ready: !missing.length,
        modelConfigured: !missing.includes('MODEL_KEY_MISSING'),
        metadataCount: missing.includes('INDEX_NOT_READY') ? 0 : 100,
        documentChunkCount: 100,
        missing,
      });
    if (path === '/api/session') return ok({ active: true });
    if (path === '/api/pokemon' && request.method() === 'GET') {
      const items = pokemon.filter(
        (p) =>
          !url.searchParams.get('q') ||
          p.nameKo.includes(url.searchParams.get('q')!),
      );
      return ok({ items, total: items.length });
    }
    if (path === '/api/pokemon/search') {
      const clarify = body.query.includes('빠른'),
        empty = body.query.includes('999');
      return ok({
        status: clarify
          ? 'needs_clarification'
          : empty
            ? 'no_results'
            : 'matched',
        items: clarify || empty ? [] : [pokemon[0]],
        total: clarify || empty ? 0 : 1,
        interpretation: clarify
          ? '스피드 종족값 기준을 알려 주세요.'
          : body.query,
        unknownConditions: clarify ? ['빠르다는 기준이 필요해요.'] : [],
        excludedUnknownCount: 0,
        interpretedFilters: [],
      });
    }
    if (/^\/api\/pokemon\/pokemon:\d+$/.test(path)) {
      const p = pokemon.find((p) => path.endsWith(p.pokemonId))!;
      return ok({
        ...p,
        speciesId: Number(p.pokemonId.split(':')[1]),
        baseStats: {
          hp: 35,
          attack: 55,
          defense: 40,
          spAttack: 50,
          spDefense: 50,
          speed: 90,
        },
        abilities: ['static', 'lightning-rod'],
        description: `${p.nameKo} 도감 설명`,
        descriptionVersion: 'shield',
        learnset: { versionGroup: 'champions', moves: [{ name: '10만볼트', method: 'train', level: 0, type: 'electric', category: 'special', power: 90, accuracy: 100 }, { name: '울음소리', method: 'level-up', level: 1, type: 'normal', category: 'status', power: null, accuracy: 100 }] },
        sourceUrl: 'https://pokeapi.co/api/v2/pokemon/25/',
      });
    }
    if (path === '/api/conversations' && request.method() === 'GET') {
      const items = conversations[url.searchParams.get('pokemonId')!] ?? [];
      return ok({ items, total: items.length });
    }
    if (/^\/api\/conversations\/[^/]+\/messages$/.test(path)) {
      const items = messages[path.split('/')[3]] ?? [];
      return ok({ items, total: items.length });
    }
    if (path === '/api/conversations' && request.method() === 'POST') {
      const conversationId = `conversation-${++number}`;
      (conversations[body.pokemonId] ??= []).unshift({
        conversationId,
        pokemonId: body.pokemonId,
        title: '새 대화',
        messageCount: 0,
      });
      return ok({ conversationId }, 201);
    }
    if (path === '/api/chat' || path.endsWith('/guide')) {
      if (failNext) {
        failNext = false;
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: 'MODEL_TIMEOUT',
              message: '응답이 지연되었습니다.',
              retryable: true,
            },
          },
        });
      }
      const pokemonId = body.pokemonId ?? path.split('/')[3];
      const conversationId = body.conversationId ?? `conversation-${++number}`;
      const question = body.question ?? '근거 기반 운용 가이드';
      if (
        !conversations[pokemonId]?.some(
          (c) => c.conversationId === conversationId,
        )
      )
        (conversations[pokemonId] ??= []).unshift({
          conversationId,
          pokemonId,
          title: question,
          messageCount: 0,
        });
      const jobId = `job-${++number}`;
      jobs[jobId] = {
        polls: 0,
        question,
        kind: path.endsWith('/guide') ? 'pokemon_guide' : 'chat',
        conversationId,
      };
      return ok({ jobId }, 202);
    }
    if (path.startsWith('/api/jobs/')) {
      const jobId = path.split('/')[3],
        j = jobs[jobId];
      if (j.polls++ < 2)
        return ok({
          jobId,
          status: 'running',
          stage: j.polls === 1 ? 'collecting' : 'generating',
        });
      const result = {
        answerStatus: abstain ? 'abstained' : curated ? 'partial' : 'answered',
        answer: `${j.question}에 대한 확인된 도감 설명입니다. [근거 1]`,
        citations: [
          {
            number: 1,
            evidenceId: 'metadata-25',
            title: wiki ? 'Pikachu — English Wikipedia' : '피카츄 일반 도감',
            sourceType: curated ? 'curated' : wiki ? 'wiki' : 'metadata',
            sourceUrl: wiki
              ? 'https://en.wikipedia.org/w/index.php?title=Pikachu&oldid=123'
              : 'https://pokeapi.co/api/v2/pokemon/25/',
            ...(curated ? { licence: 'PokeTact original conditional analysis · CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/' } : {}),
            ...(wiki ? {
              licence: 'Wikipedia contributors · CC BY-SA 4.0 · original extract unchanged',
              licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
            } : {}),
          },
        ],
        assumptions: [],
        unknowns: curated ? [{ field: 'team', reason: '현재 HP와 네 기술을 알려주세요.' }] : [],
        feature: j.kind,
        conversationId: j.conversationId,
        ...(coach ? { battleContext: {
          ownName: '이상해꽃', opponentName: '리자몽', scope: 'generic_type_scenario',
          state: { ownHpPercent: 40, requestedDefensiveType: 'water' },
          recommendation: 'consider_switch_first',
          switches: [{ pokemonId: 'pokemon:9', name: '거북왕', worstMultiplier: 0.5, comparisonOrder: 1, hpPercent: 80, defense: [{type: 'fire', multiplier: 0.5}] }],
        } } : {}),
      };
      if (abstain) {
        result.answer = '수집된 문서에서 확인되지 않습니다.';
        result.citations = [];
      }
      if (
        !messages[j.conversationId]?.some((m: any) => m.messageId === jobId)
      ) {
        (messages[j.conversationId] ??= []).push(
          { messageId: `${jobId}-user`, role: 'user', content: j.question },
          { messageId: jobId, role: 'assistant', content: result },
        );
      }
      return ok({ jobId, status: 'completed', stage: 'done', result });
    }
    return route.fulfill({
      status: 404,
      json: { error: { message: '찾을 수 없습니다.' } },
    });
  });
  return {
    failNext: () => {
      failNext = true;
    },
  };
}

test('위키 인용의 원문 버전·기여자·라이선스 표시와 기록 복원', async ({ page }) => {
  await fixture(page, [], false, true);
  await page.goto('/');
  await page.getByLabel('포켓몬 질문').fill('피카츄 배경 설명');
  await page.getByRole('button', { name: '질문 보내기' }).click();
  const source = page.getByTestId('evidence-card');
  await expect(source).toHaveAttribute('href', /oldid=123/);
  await expect(source).toContainText('위키 백과 자료');
  const licence = page.getByRole('link', { name: /Wikipedia contributors · CC BY-SA 4.0/ });
  await expect(licence).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0/');
  await page.reload();
  await expect(source).toBeVisible();
  await expect(licence).toBeVisible();
});

test('대화 중심 화면, 항목별 기록, 새로고침과 실제 인용 링크', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '근거와 함께 대화하기' }),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="profile-details"]'),
  ).toBeVisible();
  await page.getByLabel('포켓몬 질문').fill('피카츄 타입');
  await page.getByRole('button', { name: '질문 보내기' }).click();
  await expect(page.getByText('원문 자료를 확인하고 있어요')).toBeVisible();
  await expect(
    page.getByRole('link', { name: '근거 1 원문 열기' }),
  ).toHaveAttribute('href', 'https://pokeapi.co/api/v2/pokemon/25/');
  await page.getByRole('button', { name: '이상해씨 선택' }).click();
  await expect(page.locator('[data-testid="user-message"] p')).toHaveText('피카츄 타입');
  await expect(page.locator('[data-testid="answer-body"]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-testid="user-message"] p')).toHaveText('피카츄 타입');
  await page.getByRole('button', { name: '이 포켓몬으로 대화하기', exact: true }).click();
  await expect(page.locator('[data-testid="answer-body"]')).toHaveCount(0);
  await page.getByLabel('포켓몬 질문').fill('이상해씨 설명');
  await page.getByRole('button', { name: '질문 보내기' }).click();
  await expect(page.locator('[data-testid="answer-body"]')).toHaveCount(1);
  await page.getByRole('button', { name: '피카츄 선택' }).click();
  await expect(page.locator('[data-testid="user-message"] p')).toHaveText('이상해씨 설명');
  await page.getByRole('button', { name: '이 포켓몬으로 대화하기', exact: true }).click();
  await expect(page.locator('[data-testid="user-message"] p')).toHaveText(
    '피카츄 타입',
  );
  await page.reload();
  await expect(page.locator('[data-testid="user-message"] p')).toHaveText(
    '피카츄 타입',
  );
  await page.getByRole('button', { name: '새 대화 만들기' }).click();
  await expect(page.locator('[data-testid="answer-body"]')).toHaveCount(0);
  await page
    .getByLabel('대화 기록 선택')
    .selectOption({ label: '피카츄 타입' });
  await expect(page.locator('[data-testid="answer-body"]')).toHaveCount(1);
  expect(
    await page.evaluate(() => sessionStorage.getItem('pokecoach-pending')),
  ).not.toContain('피카츄 타입');
});

test('가이드도 대화에 표시하고 자연어 검색은 명확화·빈 결과를 구분', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/');
  await page.getByRole('button', { name: '근거 운용 가이드' }).click();
  await expect(
    page.getByText('근거 기반 운용 가이드', { exact: true }).last(),
  ).toBeVisible();
  await expect(page.locator('[data-testid="answer-label"]')).toContainText(
    '근거 기반 운용 가이드',
  );
  await page
    .getByRole('button', { name: '조건으로 찾기', exact: true })
    .click();
  const input = page.getByLabel('자연어 검색 조건'),
    search = page.getByRole('button', { name: '조건에 맞는 포켓몬 찾기' });
  await input.fill('빠른 포켓몬');
  await search.click();
  await expect(
    page.getByText('조건을 조금 더 알려 주세요.', { exact: true }),
  ).toBeVisible();
  await input.fill('스피드 999 이상');
  await search.click();
  await expect(
    page.getByText('일치하는 포켓몬이 없어요.', { exact: true }),
  ).toBeVisible();
  await input.fill('전기 타입 스피드 90 이상');
  await search.click();
  await expect(page.getByRole('button', { name: '피카츄 선택' })).toBeVisible();
  await expect(page.getByRole('button', { name: '이상해씨 선택' })).toHaveCount(
    0,
  );
});

test('네트워크 재시도, 진행 중 새로고침, HTML은 텍스트로 표시', async ({
  page,
}) => {
  const control = await fixture(page);
  await page.goto('/');
  control.failNext();
  await page.getByLabel('포켓몬 질문').fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: '질문 보내기' }).click();
  await expect(page.getByRole('alert')).toContainText('응답이 지연되었습니다.');
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('원문 자료를 확인하고 있어요')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-testid="answer-body"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="answer-text"] img')).toHaveCount(0);
  await expect(page.locator('[data-testid="answer-text"]')).toContainText(
    '<img src=x onerror=alert(1)>',
  );
});

for (const missing of ['MODEL_KEY_MISSING', 'INDEX_NOT_READY'])
  test(`${missing} 안내와 도감 질문 전송 허용`, async ({ page }) => {
    await fixture(page, [missing]);
    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText(
      missing === 'INDEX_NOT_READY' ? '색인이 준비되지' : '모델 연결 설정',
    );
    await page.getByLabel('포켓몬 질문').fill('타입 알려줘');
    await expect(
      page.getByRole('button', { name: '질문 보내기' }),
    ).toBeEnabled();
    await expect(page.getByRole('button', { name: '근거 운용 가이드', exact: true })).toBeDisabled();
  });

test('모바일 화면에 가로 넘침 없음', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '근거와 함께 대화하기' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('이름 검색 빈 결과와 근거 없는 답변 안내', async ({ page }) => {
  await fixture(page, [], true);
  await page.goto('/');
  await page.getByLabel('포켓몬 이름 검색').fill('없는이름');
  await expect(
    page.getByText('일치하는 포켓몬이 없어요.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('포켓몬 질문').fill('확인되지 않은 승률을 알려줘');
  await page.getByRole('button', { name: '질문 보내기' }).click();
  await expect(
    page.getByText('이 답변에 인용된 근거가 없습니다.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-testid="evidence-card"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="answer-state"]')).toHaveText(
    '확인되지 않음',
  );
});

test('모바일 검색은 접고 챗봇을 먼저 표시', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto('/');
  await expect(page.getByLabel('포켓몬 이름 검색')).toBeHidden();
  const composer = page.getByRole('heading', { name: '근거와 함께 대화하기' });
  await expect(composer).toBeInViewport();
  await page.getByRole('button', { name: '선택·검색 열기' }).click();
  await expect(page.getByLabel('포켓몬 이름 검색')).toBeVisible();
  await page.getByRole('button', { name: '이상해씨 선택' }).click();
  await expect(
    page.getByRole('heading', { name: '이상해씨', exact: true }),
  ).toBeVisible();
});

test('100개 이후 목록과 조건 검색 결과도 불러와 대화 연결', async ({
  page,
}) => {
  await fixture(page);
  const all = Array.from({ length: 205 }, (_, i) => ({
    pokemonId: `pokemon:${i + 1}`,
    speciesId: i + 1,
    isDefault: true,
    nameKo: `전체테스트${i + 1}`,
    nameEn: `test-${i + 1}`,
    types: ['electric'],
    championsEligibilityStatus: 'unknown',
    scope: 'generic',
  }));
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = decodeURIComponent(url.pathname);
    const ok = (data: unknown) => route.fulfill({ json: { data } });
    if (path === '/api/pokemon') {
      const offset = Number(url.searchParams.get('offset') ?? 0),
        q = url.searchParams.get('q');
      const filtered = all.filter((p) => !q || p.nameKo.includes(q));
      return ok({
        items: filtered.slice(offset, offset + 100),
        offset,
        limit: 100,
        total: filtered.length,
      });
    }
    if (path === '/api/pokemon/search') {
      const offset = request.postDataJSON().offset ?? 0;
      return ok({
        items: all.slice(offset, offset + 100),
        offset,
        limit: 100,
        total: 205,
        status: 'matched',
        interpretation: '전기 타입',
        unknownConditions: [],
        excludedUnknownCount: 0,
        interpretedFilters: [],
      });
    }
    if (path === '/api/pokemon/pokemon:205')
      return ok({
        ...all[204],
        baseStats: {
          hp: 35,
          attack: 55,
          defense: 40,
          spAttack: 50,
          spDefense: 50,
          speed: 90,
        },
        abilities: ['test-ability'],
        sourceUrl: 'https://pokeapi.co/api/v2/pokemon/205/',
      });
    return route.fallback();
  });
  await page.goto('/');
  await page.getByRole('button', { name: '더 보기 (100 / 205)' }).click();
  await expect(
    page.getByRole('button', { name: '전체테스트200 선택', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '더 보기 (200 / 205)' }).click();
  await page
    .getByRole('button', { name: '전체테스트205 선택', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '전체테스트205', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '조건으로 찾기', exact: true })
    .click();
  await page.getByLabel('자연어 검색 조건').fill('전기 타입');
  await page.getByRole('button', { name: '조건에 맞는 포켓몬 찾기' }).click();
  await page.getByRole('button', { name: '더 보기 (100 / 205)' }).click();
  await page.getByRole('button', { name: '더 보기 (200 / 205)' }).click();
  await expect(
    page.getByRole('button', { name: '전체테스트205 선택', exact: true }),
  ).toBeVisible();
});

for (const missingSprite of [false, true])
  test(`이미지 실패 대체 처리: sprite missing=${missingSprite}`, async ({
    page,
  }) => {
    await fixture(page);
    const root =
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
    await page.route('**/api/pokemon/pokemon%3A25', (route) =>
      route.fulfill({
        json: {
          data: {
            pokemonId: 'pokemon:25',
            speciesId: 25,
            nameKo: '피카츄',
            nameEn: 'pikachu',
            types: ['electric'],
            abilities: ['static'],
            baseStats: {
              hp: 35,
              attack: 55,
              defense: 40,
              spAttack: 50,
              spDefense: 50,
              speed: 90,
            },
            sourceUrl: 'https://pokeapi.co/api/v2/pokemon/25/',
            images: {
              artworkUrl: `${root}/other/official-artwork/25.png`,
              spriteUrl: `${root}/25.png`,
              sourceUrl: 'https://github.com/PokeAPI/sprites',
            },
          },
        },
      }),
    );
    await page.route('**/PokeAPI/sprites/**', (route) => {
      if (route.request().url().includes('official-artwork') || missingSprite)
        return route.fulfill({ status: 404 });
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XkAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    });
    await page.goto('/');
    if (missingSprite)
      await expect(
        page.getByRole('img', { name: '피카츄 이미지 없음' }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole('img', { name: '피카츄 이미지', exact: true }),
      ).toHaveAttribute('src', `${root}/25.png`);
    await expect(page.getByRole('heading', { name: '종족값', exact: true })).toBeVisible();
    await expect(
      page.getByRole('link', { name: '이미지 출처: PokéAPI sprites' }),
    ).toHaveAttribute('href', 'https://github.com/PokeAPI/sprites');
  });

test('기존 반응형 경계와 높은 화면의 대화 영역 유지', async ({ page }) => {
  await fixture(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '피카츄', exact: true }),
  ).toBeVisible();
  for (const [width, height, railWidth, headingSize, feedHeight] of [
    [390, 844, 54, 22, 420],
    [480, 844, 54, 22, 420],
    [481, 900, 54, 25, 420],
    [780, 1100, 54, 25, 420],
    [781, 1100, 72, 26, 510],
    [1150, 900, 72, 26, 410],
    [1151, 900, 72, 28, 410],
    [1440, 1100, 72, 28, 510],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(
      page.getByRole('complementary', { name: '주 메뉴' }),
    ).toHaveCSS('width', `${railWidth}px`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS(
      'font-size',
      `${headingSize}px`,
    );
    await expect(page.getByRole('log')).toHaveCSS('height', `${feedHeight}px`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width <= 780) {
      await expect(page.getByLabel('포켓몬 이름 검색')).toBeHidden();
    } else {
      await expect(page.getByLabel('포켓몬 이름 검색')).toBeVisible();
    }
  }
});

test('선택·호버·키보드 포커스와 모션 감소 스타일 유지', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/jobs/**', (route) =>
    route.fulfill({
      json: {
        data: { jobId: 'test', status: 'running', stage: 'collecting' },
      },
    }),
  );
  await page.goto('/');
  const selected = page.getByRole('button', { name: '피카츄 선택' });
  const other = page.getByRole('button', { name: '이상해씨 선택' });
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await selected.hover();
  await expect(selected).toHaveCSS(
    'background-color',
    'rgba(167, 239, 197, 0.043)',
  );
  await other.hover();
  await expect(other).toHaveCSS('background-color', 'rgb(32, 43, 56)');
  const input = page.getByLabel('포켓몬 이름 검색');
  await input.focus();
  await expect(input).toHaveCSS('outline-color', 'rgb(167, 239, 197)');
  await expect(input).toHaveCSS('outline-width', '2px');
  await page.getByLabel('포켓몬 질문').fill('타입 질문');
  await page.getByRole('button', { name: '질문 보내기' }).click();
  const spinner = page.getByRole('status').locator('svg').first();
  await expect(spinner).toHaveCSS('animation-duration', '1.1s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(spinner).toHaveCSS('animation-name', 'none');
});


test('조건부 전략 출처·라이선스와 추가 질문을 기본 표시', async ({ page }) => {
  await fixture(page, [], false, false, true);
  await page.goto('/');
  await page.getByLabel('포켓몬 질문').fill('육성 방향을 알려줘');
  await page.getByRole('button', { name: '질문 보내기' }).click();
  await expect(page.getByTestId('evidence-card')).toContainText('직접 작성한 조건부 전략 · 가정 포함');
  await expect(page.getByRole('link', { name: /PokeTact original conditional analysis/ })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
  await expect(page.getByText('현재 HP와 네 기술을 알려주세요.')).toBeVisible();
  await expect(page.getByTestId('answer-state')).toHaveText('일부 확인');
});


test('대화 응답의 전투 상태·타입 변경 가정 표시와 기록 복원', async ({ page }) => {
  await fixture(page, [], false, false, false, true);
  await page.goto('/');
  await page.getByLabel('포켓몬 질문').fill('내 선봉 이상해꽃 상대 리자몽');
  await page.getByRole('button', { name: '질문 보내기' }).click();
  const context = page.getByLabel('현재 전투 입력');
  await expect(context).toContainText('이상해꽃 / 상대 리자몽');
  await expect(context).toContainText('내 남은 HP: 40%');
  await expect(context).toContainText('가정 비교, 실제 사용 확정 아님');
  await expect(context).not.toContainText('입력한 기술:');
  await expect(page.getByLabel('교체 후보 비교')).toContainText('거북왕');
  await expect(page.getByLabel('교체 후보 비교')).toContainText('최대 피격 배율 0.5배');
  await page.reload();
  await expect(context).toContainText('내 남은 HP: 40%');
});

 test('포켓몬 선택만으로 기본 정보와 습득 기술 표시', async ({ page }) => {
  await fixture(page, ['model', 'index']);
  await page.goto('/');
  await expect(page.getByText('피카츄 도감 설명', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '종족값', exact: true })).toBeVisible();
  await expect(page.getByText('static / lightning-rod', { exact: true })).toBeVisible();
  await expect(page.getByTestId('pokemon-learnset')).toContainText('10만볼트');
  await expect(page.getByTestId('pokemon-learnset')).toContainText('트레이닝');
  await page.getByRole('button', { name: '이상해씨 선택' }).click();
  await expect(page.getByText('이상해씨 도감 설명', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="user-message"]')).toHaveCount(0);
});

test('습득 기술을 타입별 카드로 표시하고 습득 방법으로 필터', async ({ page }) => {
  await fixture(page);
  await page.goto('/');
  const electric = page.getByRole('region', { name: '전기 타입 기술' });
  const normal = page.getByRole('region', { name: '노말 타입 기술' });
  await expect(electric).toContainText('10만볼트');
  await expect(electric).toContainText('위력 90');
  await expect(electric).toContainText('명중 100%');
  await expect(electric).toContainText('특수');
  await expect(normal).toContainText('울음소리');
  await page.getByLabel('기술 타입 필터').selectOption('electric');
  await expect(normal).toHaveCount(0);
  await expect(electric).toContainText('10만볼트');
  await page.getByLabel('기술 타입 필터').selectOption('all');
  await page.getByRole('button', { name: '트레이닝', exact: true }).click();
  await expect(normal).toHaveCount(0);
  await expect(electric).toContainText('10만볼트');
  await page.getByRole('button', { name: '전체', exact: true }).click();
  await expect(normal).toBeVisible();
});
