import test from 'node:test';
import assert from 'node:assert/strict';
import { createPersonalTemplatesHandler } from '../netlify/functions/personal-templates.mjs';
import { UsageAccessError } from '../netlify/lib/usage-policy.mjs';
const userId = '00000000-0000-4000-8000-000000000001';
const version = '11111111-1111-4111-8111-111111111111';
const otherVersion = '22222222-2222-4222-8222-222222222222';
const token = 'test-token-more-than-twenty-characters';
const library = { schema: 1, kind: 'documentation-checklists', templates: [{ id: 'guide-first', title: 'Primeira consulta', category: 'Geral', body: 'Registrar apenas o que foi informado.', kind: 'documentation-checklist' }] };
const row = (currentVersion = version) => ({ version: currentVersion, library, updated_at: '2026-11-02T12:00:00Z' });
const request = (method, body, authenticated = true) => new Request('https://test.local/api/personal-templates', {
  method, headers: { 'content-type': 'application/json', ...(authenticated ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) })
});
const authenticate = async () => ({ userId });

test('biblioteca requer sessão antes de qualquer leitura/escrita', async () => {
  let calls = 0;
  const handler = createPersonalTemplatesHandler({ authenticate: async () => { calls++; }, read: async () => { calls++; } });
  assert.equal((await handler(request('GET', undefined, false))).status, 401); assert.equal(calls, 0);
});
test('biblioteca preserva bloqueio de conta e MFA do autenticador comum', async () => {
  for (const code of ['forbidden', 'mfa_required']) {
    const handler = createPersonalTemplatesHandler({ authenticate: async () => { throw new UsageAccessError('Acesso negado.', 403, code); } });
    const response = await handler(request('GET')); assert.equal(response.status, 403); assert.equal((await response.json()).code, code);
  }
});
test('GET inicial informa ausência sem criar nem sobrescrever biblioteca', async () => {
  const handler = createPersonalTemplatesHandler({ authenticate, read: async account => { assert.equal(account.userId, userId); return null; } });
  const response = await handler(request('GET')); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { version: null, library: null, updatedAt: null });
});
test('GET ignora proprietário arbitrário da URL e consulta identidade autenticada', async () => {
  const client = { from: table => { assert.equal(table, 'personal_template_libraries'); return { select() { return this; }, eq(key, value) { assert.equal(key, 'user_id'); assert.equal(value, userId); return this; }, async maybeSingle() { return { data: row() }; } }; } };
  const handler = createPersonalTemplatesHandler({ authenticate: async () => ({ userId, client }) });
  const response = await handler(new Request('https://test.local/api/personal-templates?user_id=other', { headers: { authorization: `Bearer ${token}` } }));
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).library, library);
});
test('PUT valida schema completo e usa CAS sem aceitar proprietário enviado', async () => {
  let calls = 0;
  const handler = createPersonalTemplatesHandler({ authenticate, save: async () => { calls++; return { status: 'saved', row: row() }; } });
  for (const body of [
    { expectedVersion: null, library, user_id: 'other' },
    { expectedVersion: null, library: { schema: 2, source: 'consulta', soap: {} } },
    { expectedVersion: null, library: { ...library, source: 'consulta' } },
    { expectedVersion: null, library: { ...library, templates: [{ ...library.templates[0], kind: 'clinical-note' }] } },
    { expectedVersion: null, library: { ...library, templates: [library.templates[0], library.templates[0]] } },
    { expectedVersion: 'not-a-uuid', library },
    { expectedVersion: null, library: { ...library, templates: Array.from({ length: 41 }, (_, i) => ({ ...library.templates[0], id: 'id-' + i })) } }
  ]) assert.equal((await handler(request('PUT', body))).status, 400);
  assert.equal(calls, 0);
});
test('PUT rejeita JSON inválido e corpo excessivo antes de gravar', async () => {
  let calls = 0; const handler = createPersonalTemplatesHandler({ authenticate, save: async () => { calls++; } });
  assert.equal((await handler(request('PUT', '{invalido'))).status, 400);
  assert.equal((await handler(request('PUT', 'a'.repeat(200257)))).status, 413);
  assert.equal(calls, 0);
});
test('PUT inicial normaliza guias e retorna versão do servidor', async () => {
  const handler = createPersonalTemplatesHandler({ authenticate, save: async (account, expected, incoming) => {
    assert.equal(account.userId, userId); assert.equal(expected, null); assert.deepEqual(incoming, library); return { status: 'saved', row: row() };
  } });
  const response = await handler(request('PUT', { expectedVersion: null, library })); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { version, library, updatedAt: row().updated_at });
});
test('PUT obsoleto retorna conflito com versão remota sem gravar novamente', async () => {
  let calls = 0;
  const handler = createPersonalTemplatesHandler({ authenticate, save: async (_, expected, incoming) => { calls++; assert.equal(expected, version); assert.deepEqual(incoming, library); return { status: 'conflict', row: row(otherVersion) }; } });
  const response = await handler(request('PUT', { expectedVersion: version, library }));
  assert.equal(response.status, 409); const body = await response.json(); assert.equal(body.code, 'template_conflict'); assert.equal(body.remote.version, otherVersion); assert.equal(calls, 1);
});
test('DELETE exige versão e não permite excluir atualização recente', async () => {
  let calls = 0; const handler = createPersonalTemplatesHandler({ authenticate, remove: async (_, expected) => { calls++; assert.equal(expected, version); return { status: 'conflict', row: row(otherVersion) }; } });
  assert.equal((await handler(request('DELETE', { expectedVersion: null }))).status, 400);
  assert.equal((await handler(request('DELETE', { expectedVersion: version }))).status, 409); assert.equal(calls, 1);
});
test('DELETE confirmado retorna 204 sem corpo; exclusão anterior retorna conflito', async () => {
  const handler = createPersonalTemplatesHandler({ authenticate, remove: async account => { assert.equal(account.userId, userId); return { status: 'deleted' }; } });
  const response = await handler(request('DELETE', { expectedVersion: version })); assert.equal(response.status, 204); assert.equal(await response.text(), '');
  const stale = createPersonalTemplatesHandler({ authenticate, remove: async () => ({ status: 'conflict', row: null }) });
  const conflict = await stale(request('DELETE', { expectedVersion: version })); assert.equal(conflict.status, 409); assert.equal((await conflict.json()).remote.version, null);
});
test('migração ausente e dados remotos inválidos falham sem vazar detalhes ou retornar biblioteca falsa', async () => {
  const missing = createPersonalTemplatesHandler({ authenticate: async () => ({ userId, client: { from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ error: { message: 'SQL sensitive secret' } }) }) } }) });
  const response = await missing(request('GET')); assert.equal(response.status, 503); const body = await response.json(); assert.equal(body.code, 'templates_unavailable'); assert.equal(JSON.stringify(body).includes('sensitive'), false);
  const corrupted = createPersonalTemplatesHandler({ authenticate, read: async () => ({ ...row(), library: { schema: 2, source: 'sensitive clinical text' } }) });
  const invalid = await corrupted(request('GET')); assert.equal(invalid.status, 503); assert.equal((await invalid.text()).includes('sensitive clinical'), false);
});
test('métodos não previstos não gravam e informam métodos permitidos', async () => {
  const handler = createPersonalTemplatesHandler(); const response = await handler(request('POST', {})); assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET, PUT, DELETE');
});
