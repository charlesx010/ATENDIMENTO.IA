import { authenticatedAccount, accountUsage, UsageAccessError } from '../lib/usage-policy.mjs';
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
export function createAccountUsageHandler({ env = process.env, authenticate = authenticatedAccount, readUsage = accountUsage } = {}) {
  return async request => {
    if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
    const auth = request.headers.get('authorization') || '';
    if (!/^Bearer \S{20,10000}$/.test(auth)) return json({ error: 'Entre na sua conta para consultar o uso.', code: 'unauthorized' }, 401);
    try {
      const account = await authenticate(auth.slice(7), env);
      if (!account?.userId) throw new UsageAccessError('Conta não habilitada.', 403, 'forbidden');
      return json(await readUsage(account, env));
    } catch (error) {
      return json({ error: error instanceof UsageAccessError ? error.message : 'Não foi possível consultar o uso agora.', code: error instanceof UsageAccessError ? error.code : 'usage_unavailable' }, error instanceof UsageAccessError ? error.status : 503);
    }
  };
}
export default createAccountUsageHandler();
