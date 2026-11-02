import { createClient } from '@supabase/supabase-js';

export const OPERATIONS = ['documentation', 'transcription'];
export class UsageAccessError extends Error {
  constructor(message, status = 503, code = 'usage_unavailable') { super(message); this.status = status; this.code = code; }
}
function boundedInteger(value, fallback, max) {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) throw new UsageAccessError('A configuração de limites precisa ser revisada no servidor.');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > max) throw new UsageAccessError('A configuração de limites precisa ser revisada no servidor.');
  return number;
}
export function usagePolicy(env = process.env) {
  return {
    documentation: boundedInteger(env.AI_DOCUMENTATION_DAILY_LIMIT, 30, 1000),
    transcription: boundedInteger(env.AI_TRANSCRIPTION_DAILY_LIMIT, 40, 1000),
    burstLimit: boundedInteger(env.AI_BURST_LIMIT, 3, 30),
    burstWindowSeconds: 60
  };
}
// Compatibilidade de rollout: as rotas existentes não dependiam da tabela de cotas.
// Habilitar cotas é decisão explícita do servidor após aplicar a migração.
export function legacyUsageEnforced(env = process.env) {
  const flag = env.AI_USAGE_ENFORCEMENT;
  if (flag === undefined || flag === '' || flag === 'false') return false;
  if (flag === 'true') return true;
  throw new UsageAccessError('A configuração de controle de uso precisa ser revisada no servidor.');
}
export function documentationEnabled(env = process.env) {
  const flag = env.GROQ_CLINICAL_ENABLED;
  return flag === undefined ? env.FREE_TRANSCRIPTION_ENABLED === 'true' : flag === 'true';
}
export async function reserveLegacyUsage(account, operation, env = process.env, limiter = reserveUsage) {
  if (!OPERATIONS.includes(operation) || !account) throw new UsageAccessError('Controle de uso indisponível.');
  if (!legacyUsageEnforced(env)) return { allowed: true, enforced: false, enforcementMode: 'legacy-provider-limits' };
  // Não há fallback se a aplicação optou pela fiscalização de cotas.
  return limiter(account, operation, env);
}
export function serverFeatures(env = process.env) {
  const configured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.GROQ_API_KEY);
  const voiceFlag = env.GROQ_TRANSCRIPTION_ENABLED;
  return {
    documentation: configured && documentationEnabled(env),
    transcription: configured && (voiceFlag === undefined ? env.FREE_TRANSCRIPTION_ENABLED === 'true' : voiceFlag === 'true')
  };
}
export async function authenticatedAccount(token, env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new UsageAccessError('Serviço de conta não configurado.');
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) throw new UsageAccessError('Sessão expirada. Entre novamente.', 401, 'unauthorized');
  const { data: profile, error: profileError } = await client.from('profiles').select('enabled,must_change_password,role').eq('user_id', data.user.id).single();
  if (profileError || !profile?.enabled || profile.must_change_password) throw new UsageAccessError('Conta não habilitada.', 403, 'forbidden');
  if (profile.role === 'admin') {
    let claims;
    try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); }
    catch { throw new UsageAccessError('Sessão inválida.', 401, 'unauthorized'); }
    if (claims.sub !== data.user.id || claims.aal !== 'aal2') throw new UsageAccessError('Confirme a autenticação em duas etapas.', 403, 'mfa_required');
  }
  return { userId: data.user.id, client };
}
export async function reserveUsage(account, operation, env = process.env) {
  if (!OPERATIONS.includes(operation) || !account?.userId || !account?.client) throw new UsageAccessError('Controle de uso indisponível.');
  const policy = usagePolicy(env);
  const { data, error } = await account.client.rpc('reserve_ai_usage', {
    p_user: account.userId, p_operation: operation, p_daily_limit: policy[operation], p_burst_limit: policy.burstLimit
  });
  if (error || !data || typeof data.allowed !== 'boolean' || !Number.isInteger(data.used) || data.used < 0 || !Number.isInteger(data.limit) || data.limit < 0 || data.limit > 1000 || (data.allowed && (data.used < 1 || data.used > data.limit))) {
    throw new UsageAccessError('Controle de uso indisponível. Nenhuma solicitação foi enviada à IA.');
  }
  return data;
}
export function usageDenied(result) {
  const retryAfter = Number.isSafeInteger(result?.retryAfter) && result.retryAfter > 0 ? result.retryAfter : 60;
  return {
    body: {
      error: result?.code === 'burst_limit' ? 'Muitas solicitações em sequência. Aguarde antes de tentar novamente.' : 'Limite diário de tentativas de IA atingido. O conteúdo foi preservado.',
      code: result?.code === 'burst_limit' ? 'burst_limit' : 'daily_limit',
      retryAfter
    },
    headers: { 'retry-after': String(retryAfter) }
  };
}
export async function accountUsage(account, env = process.env, now = new Date()) {
  if (!legacyUsageEnforced(env)) {
    return {
      enforced: false,
      enforcementMode: 'legacy-provider-limits',
      accounting: 'provider-limits',
      operations: null,
      features: serverFeatures(env),
      note: 'Cotas do aplicativo ainda não foram ativadas neste ambiente. O acesso continua autenticado; limites e faturamento do provedor são independentes. A nova organização de prontuário continua exigindo seu próprio controle de cotas.'
    };
  }
  const policy = usagePolicy(env);
  const day = now.toISOString().slice(0, 10);
  const { data, error } = await account.client.from('ai_daily_usage').select('operation,attempts').eq('user_id', account.userId).eq('usage_day', day);
  if (error || !Array.isArray(data)) throw new UsageAccessError('O painel de uso está indisponível. Verifique a migração do controle de uso.');
  const operations = Object.fromEntries(OPERATIONS.map(operation => {
    const used = data.find(row => row.operation === operation)?.attempts ?? 0;
    if (!Number.isSafeInteger(used) || used < 0) throw new UsageAccessError('O painel de uso está indisponível.');
    return [operation, { used, limit: policy[operation], remaining: Math.max(0, policy[operation] - used), burstLimit: policy.burstLimit, burstWindowSeconds: 60 }];
  }));
  return {
    period: day,
    resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString(),
    enforced: true, enforcementMode: 'application-quota',
    accounting: 'attempts', operations, features: serverFeatures(env),
    note: 'Tentativas autorizadas são contabilizadas antes do envio à IA, inclusive quando o provedor falha. Pedidos inválidos, negados ou acima do limite não são contabilizados. Limites operacionais não representam plano pago nem saldo financeiro.'
  };
}
