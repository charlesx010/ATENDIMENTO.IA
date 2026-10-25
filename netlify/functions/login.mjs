import { createClient } from '@supabase/supabase-js';

const reply = (message, status = 401, additional = {}) => new Response(JSON.stringify({ error: message, ...additional }), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});

// A rota /usuario mostra somente o nome; o email verdadeiro fica no provedor de autenticacao.
// O servidor busca o email do usuario e valida a senha atraves do Supabase Auth.
export default async (request) => {
  if (request.method !== 'POST') return reply('Método não permitido', 405);
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) return reply('Formato inválido', 415);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_ANON_KEY)
    return reply('Serviço temporariamente indisponível', 503);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 5120) return reply('Solicitação inválida', 400);
    body = JSON.parse(raw);
  } catch { return reply('Solicitação inválida', 400); }

  const username = typeof body?.username === 'string' ? body.username.toLowerCase().trim() : '';
  const password = body?.password;
  if (!/^[a-z][a-z0-9_-]{2,29}$/.test(username) || typeof password !== 'string' || password.length < 8 || password.length > 1024)
    return reply('Usuário ou senha inválidos');

  try {
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('user_id,enabled').eq('username', username).maybeSingle();
    if (profileError || !profile?.enabled) return reply('Usuário ou senha inválidos');

    const { data: identity, error: identityError } = await admin.auth.admin.getUserById(profile.user_id);
    if (identityError || !identity?.user?.email) return reply('Usuário ou senha inválidos');

    const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: identity.user.email, password
    });
    if (error || !data?.session?.access_token || !data?.session?.refresh_token)
      return reply('Usuário ou senha inválidos');

    return new Response(JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
    });
  } catch {
    return reply('Não foi possível entrar. Tente novamente mais tarde.', 503);
  }
};
