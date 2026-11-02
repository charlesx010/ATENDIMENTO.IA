import test from 'node:test';
import assert from 'node:assert/strict';
import { usagePolicy, reserveUsage, accountUsage, UsageAccessError } from '../netlify/lib/usage-policy.mjs';
import { createDocumentationHandler } from '../netlify/functions/organize-note.mjs';
import { createTranscriptionHandler } from '../netlify/functions/free-transcription.mjs';
import { createAccountUsageHandler } from '../netlify/functions/account-usage.mjs';
import legacyClinical from '../netlify/functions/free-clinical.mjs';
import legacyBundle from '../netlify/functions/free-clinical-ai.mjs';

const identity = { userId: '00000000-0000-4000-8000-000000000001' };
const env = { AI_USAGE_ENFORCEMENT: 'true', GROQ_API_KEY: 'FAKE_TEST_ONLY', GROQ_CLINICAL_ENABLED: 'true', GROQ_TRANSCRIPTION_ENABLED: 'true', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'FAKE_TEST_ONLY' };
const token = 'test-token-more-than-twenty-characters';
const noteRequest = (fields = {}) => new Request('https://test.local/api/organize-note', {
  method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ text: 'Paciente fictício relata dor no joelho direito há três dias.', consent: 'fictitious_only', freePlanAcknowledged: true, ...fields })
});
const audioRequest = (size = 2000, mime = 'audio/wav') => new Request('https://test.local/api/free-transcription', {
  method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': mime, 'x-clinical-consent': 'fictitious_only' }, body: new Uint8Array(size)
});
const queryResult = result => ({ select() { return this; }, eq() { return this; }, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); } });

test('política tem limites explícitos, aceita zero e rejeita configuração fora dos limites', () => {
  assert.deepEqual(usagePolicy({}), { documentation: 30, transcription: 40, burstLimit: 3, burstWindowSeconds: 60 });
  assert.equal(usagePolicy({ AI_DOCUMENTATION_DAILY_LIMIT: '0' }).documentation, 0);
  for (const value of ['-1', '1.5', '1001', 'Infinity', 'abc']) assert.throws(() => usagePolicy({ AI_TRANSCRIPTION_DAILY_LIMIT: value }), UsageAccessError);
  assert.throws(() => usagePolicy({ AI_BURST_LIMIT: '31' }), UsageAccessError);
});

test('reserva usa identidade validada e limites do servidor', async () => {
  let args;
  const result = await reserveUsage({ ...identity, client: { rpc: async (name, input) => { assert.equal(name, 'reserve_ai_usage'); args = input; return { data: { allowed: true, used: 1, limit: 7, remaining: 6 } }; } } }, 'documentation', { AI_DOCUMENTATION_DAILY_LIMIT: '7' });
  assert.equal(result.allowed, true);
  assert.equal(args.p_user, identity.userId);
  assert.equal(args.p_daily_limit, 7);
  assert.equal(args.p_burst_limit, 3);
});

test('reserva falha fechada se RPC/migração estiver ausente ou resposta inválida', async () => {
  for (const response of [{ data: null, error: { message: 'missing function' } }, { data: {} }, { data: { allowed: true, used: '1', limit: 30 } }]) {
    await assert.rejects(() => reserveUsage({ ...identity, client: { rpc: async () => response } }, 'documentation', {}), UsageAccessError);
  }
});

test('documentação autentica antes de reservar; bloqueio impede uso e provedor', async () => {
  let reserves = 0, provider = 0;
  const handler = createDocumentationHandler({ env, authenticate: async () => false, limiter: async () => { reserves++; }, fetcher: async () => { provider++; } });
  assert.equal((await handler(noteRequest())).status, 403);
  assert.equal(reserves, 0); assert.equal(provider, 0);
});

test('consentimento/texto inválido não consome tentativas', async () => {
  let reserves = 0;
  const handler = createDocumentationHandler({ env, authenticate: async () => identity, limiter: async () => { reserves++; } });
  assert.equal((await handler(noteRequest({ consent: false }))).status, 400);
  assert.equal((await handler(noteRequest({ text: 'curto' }))).status, 400);
  assert.equal(reserves, 0);
});

for (const code of ['daily_limit', 'burst_limit']) test(`documentação retorna ${code} e Retry-After sem contatar IA`, async () => {
  let provider = 0;
  const handler = createDocumentationHandler({ env, authenticate: async () => identity, limiter: async () => ({ allowed: false, code, used: 30, limit: 30, retryAfter: 42 }), fetcher: async () => { provider++; } });
  const response = await handler(noteRequest());
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '42');
  assert.equal((await response.json()).code, code); assert.equal(provider, 0);
});

test('falha do controle de uso não envia relato ao provedor nem expõe detalhes do banco', async () => {
  let provider = 0;
  const handler = createDocumentationHandler({ env, authenticate: async () => identity, limiter: async () => { throw new UsageAccessError('Controle de uso indisponível.'); }, fetcher: async () => { provider++; } });
  const response = await handler(noteRequest()); assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'usage_unavailable'); assert.equal(provider, 0);
});

test('tentativa autorizada é reservada uma vez mesmo se o provedor falhar', async () => {
  let reserves = 0, provider = 0;
  const handler = createDocumentationHandler({ env, authenticate: async () => identity, limiter: async () => { reserves++; return { allowed: true }; }, fetcher: async () => { provider++; return new Response('', { status: 502 }); } });
  assert.equal((await handler(noteRequest())).status, 502); assert.equal(reserves, 1); assert.equal(provider, 1);
});

test('transcrição valida áudio antes de contabilizar e quota antes de enviar', async () => {
  let reserves = 0, provider = 0;
  const handler = createTranscriptionHandler({ env, authenticate: async () => identity, limiter: async (_, operation) => { assert.equal(operation, 'transcription'); reserves++; return { allowed: false, code: 'daily_limit', retryAfter: 9 }; }, fetcher: async () => { provider++; } });
  assert.equal((await handler(audioRequest(10))).status, 413); assert.equal(reserves, 0);
  const response = await handler(audioRequest()); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '9'); assert.equal(reserves, 1); assert.equal(provider, 0);
});

test('transcrição autorizada preserva MIME/nome WAV e sinaliza revisão', async () => {
  const handler = createTranscriptionHandler({ env, authenticate: async () => identity, limiter: async () => ({ allowed: true }), fetcher: async (_, options) => {
    const file = options.body.get('file'); assert.equal(file.type, 'audio/wav'); assert.equal(file.name, 'dictation.wav');
    return Response.json({ text: 'Paciente fictício relata dor à direita.', language: 'pt' });
  } });
  const response = await handler(audioRequest()); assert.equal(response.status, 200); assert.equal((await response.json()).requiresReview, true);
});

test('painel consulta somente contagem própria, define reset UTC e não vaza configuração', async () => {
  const account = { ...identity, client: { from: table => { assert.equal(table, 'ai_daily_usage'); return queryResult({ data: [{ operation: 'documentation', attempts: 4 }] }); } } };
  const result = await accountUsage(account, env, new Date('2026-11-02T23:59:00Z'));
  assert.equal(result.resetsAt, '2026-11-03T00:00:00.000Z'); assert.equal(result.operations.documentation.remaining, 26); assert.equal(result.operations.transcription.used, 0);
  assert.equal(result.accounting, 'attempts'); assert.equal(result.features.documentation, true);
  assert.equal(JSON.stringify(result).includes('FAKE_TEST_ONLY'), false); assert.equal(JSON.stringify(result).includes('supabase.co'), false);
});

test('painel sem migração falha sem declarar recursos prontos', async () => {
  const handler = createAccountUsageHandler({ env, authenticate: async () => ({ ...identity, client: { from: () => queryResult({ data: null, error: { message: 'table missing: confidential' } }) } }) });
  const response = await handler(new Request('https://test.local/api/account-usage', { headers: { authorization: `Bearer ${token}` } }));
  assert.equal(response.status, 503); const body = await response.json(); assert.equal(body.code, 'usage_unavailable'); assert.equal(JSON.stringify(body).includes('confidential'), false); assert.equal(body.features, undefined);
});

test('painel nega sessão ausente antes de consultar uso', async () => {
  let calls = 0; const handler = createAccountUsageHandler({ authenticate: async () => { calls++; } });
  assert.equal((await handler(new Request('https://test.local/api/account-usage'))).status, 401); assert.equal(calls, 0);
});

test('endpoints Groq legados compartilham o controle e falham antes do provedor', async () => {
  const savedEnv = Object.fromEntries(['AI_USAGE_ENFORCEMENT', 'FREE_TRANSCRIPTION_ENABLED', 'GROQ_CLINICAL_ENABLED', 'GROQ_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch; let provider = 0, reservations = 0;
  try {
    Object.assign(process.env, env, { FREE_TRANSCRIPTION_ENABLED: 'true' });
    globalThis.fetch = async (url) => {
      const path = String(url);
      if (path.includes('/auth/v1/user')) return Response.json({ id: identity.userId });
      if (path.includes('/rest/v1/profiles')) return Response.json({ enabled: true, must_change_password: false, role: 'medico' });
      if (path.includes('/rest/v1/rpc/reserve_ai_usage')) { reservations++; return Response.json({ allowed: false, code: 'daily_limit', used: 30, limit: 30, retryAfter: 100 }); }
      provider++; throw Error('Provider must not be called');
    };
    for (const handler of [legacyClinical, legacyBundle]) {
      const response = await handler(noteRequest({ mode: 'bundle', caps: false }));
      assert.equal(response.status, 429); assert.equal((await response.json()).code, 'daily_limit');
    }
    assert.equal(reservations, 2); assert.equal(provider, 0);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(savedEnv)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
