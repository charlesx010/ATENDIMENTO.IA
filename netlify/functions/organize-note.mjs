import { createClient } from '@supabase/supabase-js';
import { documentationSchema, documentationPrompt, validateDocumentation } from '../lib/documentation.mjs';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' } });
export function createDocumentationHandler({ env = process.env, fetcher = fetch, authenticate } = {}) {
  return async request => {
    const available = env.GROQ_CLINICAL_ENABLED === 'true' && Boolean(env.GROQ_API_KEY) && Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
    if (request.method === 'GET') return json({ available });
    if (request.method !== 'POST') return json({ error:'Método não permitido.' },405);
    if (!available) return json({ error:'Organização por IA não configurada. O modo literal continua disponível.' },503);
    const auth = request.headers.get('authorization') || '';
    if (!/^Bearer \S{20,10000}$/.test(auth)) return json({ error:'Entre na sua conta para usar IA.' },401);
    if (!request.headers.get('content-type')?.includes('application/json')) return json({ error:'Formato inválido.' },415);
    let body;
    try { const raw = await request.text(); if (raw.length > 14000) return json({error:'Texto muito extenso.'},413); body = JSON.parse(raw); }
    catch { return json({ error:'Solicitação inválida.' },400); }
    if (body?.consent !== 'fictitious_only' || body?.freePlanAcknowledged !== true) return json({error:'Autorize dados fictícios e confirme o plano gratuito.'},400);
    if (typeof body?.text !== 'string' || body.text.trim().length < 20 || body.text.length > 6000) return json({error:'Informe de 20 a 6.000 caracteres.'},400);
    try {
      let permitted;
      if (authenticate) permitted = await authenticate(auth.slice(7));
      else {
        const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false,autoRefreshToken:false} });
        const {data,error} = await client.auth.getUser(auth.slice(7));
        if (error || !data?.user) return json({error:'Sessão expirada.'},401);
        const {data:profile,error:pe} = await client.from('profiles').select('enabled,must_change_password,role').eq('user_id',data.user.id).single();
        permitted = !pe && profile?.enabled && !profile.must_change_password;
        if (permitted && profile.role === 'admin') {
          const claims = JSON.parse(Buffer.from(auth.slice(7).split('.')[1],'base64url').toString('utf8'));
          permitted = claims.sub === data.user.id && claims.aal === 'aal2';
        }
      }
      if (!permitted) return json({error:'Conta não habilitada ou segundo fator pendente.'},403);
      const response = await fetcher('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST', headers:{'content-type':'application/json',authorization:`Bearer ${env.GROQ_API_KEY}`},
        body:JSON.stringify({ model:env.GROQ_NOTE_MODEL || 'openai/gpt-oss-120b',temperature:0,max_completion_tokens:2400,
          response_format:{type:'json_schema',json_schema:{name:'documentation_only',strict:true,schema:documentationSchema}},
          messages:[{role:'system',content:documentationPrompt},{role:'user',content:body.text}] }), signal:AbortSignal.timeout(35000)
      });
      if (!response.ok) return json({error:response.status===429?'Cota do provedor atingida. Seu relato foi preservado.':'Provedor indisponível. Seu relato foi preservado.'},response.status===429?429:502);
      const result = await response.json();
      if (result?.choices?.[0]?.finish_reason !== 'stop') return json({error:'Resposta interrompida; nenhum rascunho foi substituído.'},502);
      const raw = result?.choices?.[0]?.message?.content;
      if (typeof raw !== 'string' || raw.length > 24000) return json({error:'Resposta inválida.'},502);
      let note; try { note=JSON.parse(raw); } catch { return json({error:'Resposta fora do formato esperado.'},502); }
      if (!validateDocumentation(note)) return json({error:'Campos da resposta inválidos.'},502);
      return json({note,requiresReview:true,provider:'groq'});
    } catch { return json({error:'Não foi possível concluir. Relato e rascunho anteriores preservados.'},503); }
  };
}
export default createDocumentationHandler();
