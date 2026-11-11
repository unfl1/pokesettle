import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const base = __ENV.LOAD_BASE_URL || 'http://127.0.0.1:8010';
const users = Number(__ENV.LOAD_USERS || 100);
const timeout = Number(__ENV.LOAD_TIMEOUT || 180);
const production = __ENV.LOAD_PRODUCTION === '1';
const sessionInterval = Number(__ENV.LOAD_SESSION_INTERVAL || (production ? 2.2 : 0));
const started = new Counter('chat_started');
const finished = new Counter('chat_finished');
const answerStatuses = new Counter('chat_answer_status');
const accepted = new Rate('chat_accepted');
const completed = new Rate('chat_completed');
const rejected = new Counter('chat_rejected');
const failed = new Counter('chat_failed');
const admission = new Trend('chat_admission_ms', true);
const completion = new Trend('chat_completion_ms', true);
const launch = new Trend('chat_launch_skew_ms', true);
const species = [
  [25, '피카츄'], [6, '리자몽'], [9, '거북왕'], [3, '이상해꽃'], [94, '팬텀'],
  [130, '갸라도스'], [149, '망나뇽'], [445, '한카리아스'], [448, '루카리오'], [700, '님피아'],
];

export const options = {
  setupTimeout: `${Math.ceil(users * sessionInterval + 60)}s`,
  scenarios: {
    simultaneous_questions: {
      executor: 'per-vu-iterations',
      vus: users,
      iterations: 1,
      maxDuration: `${timeout + 30}s`,
    },
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    checks: ['rate==1'],
    chat_completed: ['rate==1'],
    chat_started: [`count==${users}`],
    chat_finished: [`count==${users}`],
  },
};

function params(index, name, cookie) {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(!production ? { 'X-Poketact-Viewer-IP': __ENV.LOAD_SHARED_IP === '1'
        ? '198.18.0.1' : `198.18.0.${index + 1}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    tags: { name },
    timeout: '30s',
  };
}

export function setup() {
  if (!Number.isInteger(users) || users < 1 || users > 100
      || !Number.isFinite(timeout) || timeout <= 0
      || !Number.isFinite(sessionInterval) || sessionInterval < 0) {
    throw new Error('Expected 1–100 users and positive timeout');
  }
  if (production ? base !== 'https://pokesettle.com' || __ENV.LOAD_SHARED_IP === '1'
      : !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) {
    throw new Error('Use isolated loopback or explicit production mode at https://pokesettle.com');
  }
  const ready = http.get(`${base}/api/status`, { timeout: '15s', tags: { name: 'readiness' } });
  if (ready.status !== 200 || !ready.json().data.ready) {
    throw new Error('API/worker not ready');
  }
  const sessions = [];
  // Provision before the burst: measure simultaneous questions independently of login.
  for (let i = 0; i < users; i++) {
    const response = http.post(`${base}/api/session`, null, params(i, 'session'));
    if (response.status !== 200) throw new Error(`Session setup failed: ${response.status}`);
    sessions.push(`pokecoach_session=${response.cookies.pokecoach_session[0].value}`);
    http.cookieJar().clear(base);
    if (sessionInterval) sleep(sessionInterval);
  }
  return { sessions, start: Date.now() + 1500 };
}

export default function (data) {
  const index = __VU - 1;
  const cookie = data.sessions[index];
  const delay = (data.start - Date.now()) / 1000;
  if (delay > 0) sleep(delay);
  const start = Date.now();
  started.add(1);
  launch.add(start - data.start);
  const selected = species[index % species.length];
  const mixed = __ENV.LOAD_MIXED === '1';
  const response = http.post(`${base}/api/chat`, JSON.stringify({
    pokemonId: mixed ? `pokemon:${selected[0]}` : 'pokemon:25',
    question: mixed
      ? `${selected[1]} ${Math.floor(index / species.length) % 2 ? '육성 방법' : '운영 전략'}을 근거와 함께 설명해줘`
      : __ENV.LOAD_QUESTION || '피카츄의 특징과 활용할 때 주의할 점을 근거를 들어 설명해 줘.',
    clientRequestId: `00000000-0000-4000-8000-${String(__VU).padStart(12, '0')}`,
  }), params(index, 'chat', cookie));
  admission.add(Date.now() - start, { status: String(response.status) });
  const isAccepted = response.status === 202;
  accepted.add(isAccepted);
  check(response, { 'chat returns a defined admission response': (r) => [202, 429].includes(r.status) });
  if (!isAccepted) {
    let code = response.status === 0 ? 'TRANSPORT_ERROR' : `HTTP_${response.status}_NON_JSON`;
    try { code = response.json().error.code; } catch (_) { /* counted below */ }
    rejected.add(1, { code, status: String(response.status) });
    completed.add(false);
    finished.add(1);
    console.log(JSON.stringify({ vu: __VU, status: response.status, code }));
    return;
  }
  const url = response.json().data.statusUrl;
  const deadline = start + timeout * 1000;
  while (Date.now() < deadline) {
    const poll = http.get(`${base}${url}`, params(index, 'job_poll', cookie));
    if (!check(poll, { 'job poll succeeds': (r) => r.status === 200 })) {
      failed.add(1, { code: 'POLL_HTTP_ERROR' });
      completed.add(false);
      finished.add(1);
      return;
    }
    const job = poll.json().data;
    if (['completed', 'failed', 'interrupted'].includes(job.status)) {
      const ok = job.status === 'completed';
      completed.add(ok);
      finished.add(1);
      answerStatuses.add(1, { status: job.result ? job.result.answerStatus || 'missing' : 'missing' });
      if (ok) completion.add(Date.now() - start);
      else failed.add(1, { code: job.error ? job.error.code : job.status });
      console.log(JSON.stringify({
        vu: __VU, status: job.status, elapsedMs: Date.now() - start,
        code: job.error ? job.error.code : null,
        answerStatus: job.result ? job.result.answerStatus : null,
      }));
      return;
    }
    sleep(job.status === 'queued' ? 2 : 1);
  }
  completed.add(false);
  finished.add(1);
  failed.add(1, { code: 'CLIENT_DEADLINE' });
}

export function handleSummary(data) {
  delete data.setup_data;
  return { [__ENV.LOAD_SUMMARY || 'runtime/load-test/k6-summary.json']: JSON.stringify(data, null, 2) };
}
