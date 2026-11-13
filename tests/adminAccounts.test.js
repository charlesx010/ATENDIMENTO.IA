import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newAccountProfile, provisionAccountProfile, accountChanges} from '../netlify/lib/admin-accounts.mjs';

const account = {userId: '00000000-0000-4000-8000-000000000031', username: 'maria', displayName: 'Dra. Maria Fictícia'};

// Simula a tabela profiles com o gatilho do banco, que já insere um perfil
// automático (nome de usuário gerado) assim que a conta de acesso é criada.
function profilesWithTrigger(userId) {
  const rows = new Map([[userId, {user_id: userId, username: 'usuario_000000000000', role: 'medico', consultation_enabled: false, must_change_password: false}]]);
  const calls = [];
  return {
    rows, calls,
    from(table) {
      assert.equal(table, 'profiles');
      return {
        async insert(row) { calls.push('insert'); return rows.has(row.user_id) ? {error: {code: '23505'}} : (rows.set(row.user_id, row), {error: null}); },
        async upsert(row, options) { calls.push('upsert'); assert.deepEqual(options, {onConflict: 'user_id'}); rows.set(row.user_id, {...rows.get(row.user_id), ...row}); return {error: null}; }
      };
    }
  };
}

test('conta criada pelo administrador substitui o perfil automático do banco sem conflito', async () => {
  const service = profilesWithTrigger(account.userId);
  assert.equal(await provisionAccountProfile(service, account), null);
  assert.deepEqual(service.calls, ['upsert']);
  const saved = service.rows.get(account.userId);
  assert.equal(saved.username, 'maria');
  assert.equal(saved.display_name, 'Dra. Maria Fictícia');
  assert.equal(saved.role, 'medico');
  assert.equal(saved.must_change_password, true);
  assert.equal(saved.consultation_enabled, true);
  assert.equal(saved.ai_enabled, false);
});

test('falha do banco ao gravar o perfil é devolvida para a conta ser desfeita', async () => {
  const failure = {code: '23505', message: 'duplicate username'};
  const service = {from: () => ({upsert: async () => ({error: failure})})};
  assert.equal(await provisionAccountProfile(service, account), failure);
});

test('perfil novo nunca nasce administrador nem com IA paga habilitada', () => {
  const profile = newAccountProfile(account);
  assert.equal(profile.role, 'medico');
  assert.equal(profile.ai_enabled, false);
  assert.equal(profile.monthly_limit_usd, 0);
});

test('alterações administrativas aceitam somente campos e tipos previstos', () => {
  assert.deepEqual(accountChanges({consultationEnabled: true}), {consultation_enabled: true});
  assert.deepEqual(accountChanges({enabled: false, consultationEnabled: false}), {enabled: false, consultation_enabled: false});
  assert.deepEqual(accountChanges({consultationEnabled: 'true', role: 'admin', username: 'x', monthlyLimit: -1}), {});
  assert.deepEqual(accountChanges(null), {});
});

test('Function administrativa usa as regras compartilhadas e lista a liberação de consulta', async () => {
  const source = await readFile(new URL('../netlify/functions/admin.mjs', import.meta.url), 'utf8');
  assert.match(source, /provisionAccountProfile\(service/);
  assert.match(source, /accountChanges\(body\)/);
  assert.match(source, /consultation_enabled/);
  assert.doesNotMatch(source, /from\('profiles'\)\.insert\(/);
});

test('área nova fica restrita à demonstração enquanto as tabelas não existem no banco', async () => {
  const router = await readFile(new URL('../src/workspace/WorkspaceRouter.jsx', import.meta.url), 'utf8');
  assert.match(router, /const pilot = demo && /);
  assert.match(router, /\{demo&&<nav className=\{'workspace-version-switcher'/);
});
