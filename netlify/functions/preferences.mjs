import {authenticatedAccount,UsageAccessError} from '../lib/usage-policy.mjs';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export function createPreferencesHandler({env=process.env,authenticate=authenticatedAccount}={}){
 return async request=>{
  if(request.method!=='PUT')return json({error:'Método não permitido.'},405);
  const header=request.headers.get('authorization')||'';
  if(!/^Bearer \S{20,10000}$/.test(header))return json({error:'Entre novamente para salvar as preferências.'},401);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido.'},415);
  let body;
  try{const raw=await request.text();if(raw.length>1000)return json({error:'Preferências excessivas.'},413);body=JSON.parse(raw);}catch{return json({error:'Preferências inválidas.'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['specialty','caps','format'].includes(k))||typeof body.specialty!=='string'||!body.specialty.trim()||body.specialty.length>100||typeof body.caps!=='boolean'||body.format!=='Narrativo')return json({error:'Campos de preferências inválidos.'},400);
  try{
   const account=await authenticate(header.slice(7),env);if(!account?.userId||!account.client)return json({error:'Conta indisponível.'},403);
   // Só preferences do próprio usuário. Não altera papel, bloqueio, cobrança ou consulta.
   const preferences={specialty:body.specialty.trim(),caps:body.caps,format:'Narrativo'};
   const {error}=await account.client.from('profiles').update({preferences}).eq('user_id',account.userId);
   if(error)return json({error:'Não foi possível salvar suas preferências. O conteúdo desta aba foi preservado.'},503);
   return json({preferences});
  }catch(e){return json({error:e instanceof UsageAccessError?e.message:'Não foi possível confirmar o acesso.'},e instanceof UsageAccessError?e.status:503);}
 };
}
export default createPreferencesHandler();
