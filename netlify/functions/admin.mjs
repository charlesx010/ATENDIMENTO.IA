import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { accountChanges, provisionAccountProfile } from '../lib/admin-accounts.mjs';

const json = (obj,status=200) => new Response(JSON.stringify(obj), { status, headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'} });
function readBody(req) { return req.text().then(s => { if (s.length > 12000) throw Error('Requisição muito grande'); return JSON.parse(s || '{}'); }); }
function isUsername(s) { return typeof s === 'string' && /^[a-z][a-z0-9_-]{2,29}$/.test(s); }
function password() { return randomBytes(20).toString('base64url'); }

export default async (request) => {
  if (request.method !== 'POST') return json({error:'Método inválido'},405);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return json({error:'Backend não configurado'},503);
  const bearer = request.headers.get('authorization') || '';
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  if (!token || token.length > 10000) return json({error:'Não autorizado'},401);
  const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: authError } = await service.auth.getUser(token);
  if (authError || !identity?.user) return json({error:'Sessão inválida'},401);
  // JWT já foi validado pelo servidor Auth; AAL2 exigido em cada operação administrativa.
  let claims;
  try { claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { return json({error:'Token inválido'},401); }
  if (claims.sub !== identity.user.id || claims.aal !== 'aal2') return json({error:'Confirme o segundo fator do administrador'},403);
  const { data: role, error: roleError } = await service.from('profiles').select('role,enabled').eq('user_id',identity.user.id).single();
  if (roleError || role?.role !== 'admin' || !role.enabled) return json({error:'Acesso negado'},403);
  try {
    const body = await readBody(request);
    if (body.action === 'my_ai') {
      const {data:my,error}=await service.from('profiles')
        .select('ai_enabled,monthly_limit_usd')
        .eq('user_id',identity.user.id).single();
      if(error)throw error;
      return json({aiEnabled:my.ai_enabled,monthlyLimit:Number(my.monthly_limit_usd)});
    }
    if (body.action === 'update_self_ai') {
      if(typeof body.aiEnabled!=='boolean'||typeof body.monthlyLimit!=='number'||
         !Number.isFinite(body.monthlyLimit)||body.monthlyLimit<0||body.monthlyLimit>2)
        return json({error:'Limite deve estar entre US$ 0 e US$ 2 mensais.'},400);
      if(body.aiEnabled && body.monthlyLimit<0.1)
        return json({error:'Para ativar a IA, estabeleça limite entre US$ 0,10 e US$ 2.'},400);
      const {error}=await service.from('profiles').update({
        ai_enabled:body.aiEnabled && body.monthlyLimit>0,
        monthly_limit_usd:body.monthlyLimit
      }).eq('user_id',identity.user.id);
      if(error)throw error;
      return json({success:true});
    }
    if (body.action === 'list') {
      const { data,error } = await service.from('profiles').select('user_id,username,display_name,role,enabled,consultation_enabled,ai_enabled,monthly_limit_usd,created_at').order('created_at',{ascending:true});
      if (error) throw error;
      return json({ users:data });
    }
    if (body.action === 'create') {
      const username = String(body.username||'').trim().toLowerCase();
      const displayName = String(body.displayName||'').trim();
      if (!isUsername(username) || displayName.length < 2 || displayName.length > 90) return json({error:'Nome ou usuário inválido (3–30 caracteres)'},400);
      if (username === 'admin') return json({error:'Nome reservado'},400);
      const tempPassword = password();
      const { data:created,error: createError } = await service.auth.admin.createUser({email:`${username}@login.prontuario.invalid`, password:tempPassword,email_confirm:true});
      if (createError) return json({error:'Não foi possível criar: usuário possivelmente existente'},409);
      const profileError = await provisionAccountProfile(service, {userId:created.user.id, username, displayName});
      if (profileError) { await service.auth.admin.deleteUser(created.user.id); throw profileError; }
      return json({success:true, username, temporaryPassword:tempPassword});
    }
    if (body.action === 'update') {
      if (!/^[0-9a-f-]{36}$/.test(String(body.userId||''))) return json({error:'Conta inválida'},400);
      const {data:target} = await service.from('profiles').select('role').eq('user_id',body.userId).single();
      if (!target || target.role === 'admin') return json({error:'Não é permitido modificar administradores'},403);
      const allowed = accountChanges(body);
      if (!Object.keys(allowed).length) return json({error:'Nenhuma alteração válida'},400);
      const {error} = await service.from('profiles').update(allowed).eq('user_id',body.userId);
      if (error) throw error;
      return json({success:true});
    }
    if (body.action === 'reset_password') {
      if (!/^[0-9a-f-]{36}$/.test(String(body.userId||''))) return json({error:'Conta inválida'},400);
      const {data:target} = await service.from('profiles').select('role').eq('user_id',body.userId).single();
      if (!target || target.role === 'admin') return json({error:'Não permitido'},403);
      const tempPassword=password();
      const {error} = await service.auth.admin.updateUserById(body.userId,{password:tempPassword});
      if (error) throw error;
      await service.from('profiles').update({must_change_password:true}).eq('user_id',body.userId);
      return json({temporaryPassword:tempPassword});
    }
    return json({error:'Ação não encontrada'},400);
  } catch(e) {
    console.error('Admin error', e?.message || 'unknown');
    return json({error:'Operação não concluída. Verifique as configurações do servidor.'},500);
  }
};
