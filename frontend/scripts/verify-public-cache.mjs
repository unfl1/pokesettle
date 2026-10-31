// Run after a production build.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { request } from '@playwright/test';

async function availablePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await exited;
}

const client = await request.newContext();
const fixturePort = await availablePort();
const port = await availablePort();
const fixtureUrl = `http://127.0.0.1:${fixturePort}/__fixture`;
const origin = `http://127.0.0.1:${port}`;
const fixture = spawn(process.execPath, ['e2e/fixture-api.mjs'], {
  env: { ...process.env, FIXTURE_API_PORT: String(fixturePort) }, stdio: 'ignore',
});
const frontend = spawn(process.execPath, ['.next/standalone/server.js'], {
  env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: String(port), API_ORIGIN: `http://127.0.0.1:${fixturePort}`, PUBLIC_DATA_CACHE_SECONDS: '', GA_ID: 'G-NAVTEST123' }, stdio: 'ignore',
});
async function waitFor(url) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await client.get(url)).ok()) return; } catch { /* Starting up. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Test server did not start: ${url}`);
}

try {
  await Promise.all([waitFor(fixtureUrl), waitFor(`${origin}/analytics/config`)]);
  assert.deepEqual(await (await client.get(`${origin}/analytics/config`)).json(), { gaId: 'G-NAVTEST123' });
  await client.post(fixtureUrl, { data: { ready: true } });
  for (let i = 0; i < 2; i++) {
    assert.match(await (await client.get(`${origin}/ko/pokedex`)).text(), /피카츄/);
    assert.match(await (await client.get(`${origin}/ko/meta`)).text(), /Synthetic SSR fixture/);
  }
  const { data: { calls } } = await (await client.get(fixtureUrl)).json();
  for (const path of ['/api/pokemon?limit=100&offset=0', '/api/pokemon/pokemon%3A25', '/api/meta/singles']) assert.equal(calls[path], 1, path);

  await client.post(fixtureUrl, { data: { ready: true, failedIds: ['pokemon:205'] } });
  assert.match(await (await client.get(`${origin}/ko/pokedex/test-205`)).text(), /포켓몬 정보를 불러오지 못했어요/);
  await client.post(fixtureUrl, { data: { ready: true } });
  assert.match(await (await client.get(`${origin}/ko/pokedex/test-205`)).text(), /전체테스트205/);
  assert.equal((await (await client.get(fixtureUrl)).json()).data.calls['/api/pokemon/pokemon%3A205'], 1);
  console.log('PASS: public GET cache reuse, failed response recovery, runtime GA configuration');
} finally {
  await client.dispose();
  await Promise.all([stop(frontend), stop(fixture)]);
}
