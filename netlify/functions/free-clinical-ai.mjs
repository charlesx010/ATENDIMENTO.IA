import {createClient} from '@supabase/supabase-js';
import {
 validateClinicalDraft,formatClinicalBundlePrompt,bundleJsonSchema,validateClinicalBundle
} from '../lib/ai-note.mjs';

const MODEL='openai/gpt-oss-120b';
const MAX_OUTPUT_TOKENS=3200;
const enabled=()=>process.env.FREE_TRANSCRIPTION_ENABLED==='true' && Boolean(process.env.GROQ_API_KEY);
const json=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','x-content-type-options':'nosniff'}
});
export default async function freeClinicalAi(request){
 if(request.method==='GET')return json({available:enabled(),provider:'groq',model:MODEL});
 if(request.method!=='POST')return json({error:'Método não permitido.'},405);
 if(!enabled())return json({error:'IA gratuita não configurada. A OpenAI paga NÃO foi chamada.'},503);
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer [^\s]+$/.test(authorization))return json({error:'Entre na sua conta.'},401);
 const token=authorization.slice(7);
 if(token.length<20||token.length>10000)return json({error:'Sessão inválida.'},401);
 if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))
  return json({error:'Formato de solicitação inválido.'},415);
 if(Number(request.headers.get('content-length')||0)>18000)
  return json({error:'Relato extenso demais.'},413);
 let body;
 try{
  const raw=await request.text();
  if(raw.length>18000)return json({error:'Relato excede o limite de tamanho.'},413);
  body=JSON.parse(raw);
 }catch{return json({error:'Solicitação inválida.'},400);}
 if(body?.consent!=='fictitious_only'||body?.mode!=='bundle'||typeof body.caps!=='boolean')
  return json({error:'Confirme o caso fictício e a geração do documento.'},400);
 const valid=validateClinicalDraft(body.text);
 if(!valid.ok)return json({error:valid.message},400);
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
  return json({error:'Autenticação temporariamente indisponível.'},503);
 try{
  const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
   auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:identity,error}=await supabase.auth.getUser(token);
  if(error||!identity?.user)return json({error:'Sessão expirada. Entre novamente.'},401);
  const {data:profile,error:pe}=await supabase.from('profiles')
   .select('role,enabled,must_change_password').eq('user_id',identity.user.id).single();
  if(pe||!profile?.enabled||profile.must_change_password)
   return json({error:'Conta não habilitada.'},403);
  if(profile.role==='admin'){
   let claims;
   try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}
   catch{return json({error:'Sessão inválida.'},401);}
   if(claims.sub!==identity.user.id||claims.aal!=='aal2')
    return json({error:'Confirme a autenticação em duas etapas.'},403);
  }
 }catch{return json({error:'Falha na autenticação. Nenhuma chamada foi feita.'},503);}
 // Exclusivamente Groq. Em qualquer falha ou cota atingida, NUNCA usa API paga como fallback.
 try{
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
   method:'POST',
   headers:{authorization:'Bearer '+process.env.GROQ_API_KEY,'content-type':'application/json'},
   body:JSON.stringify({
    model:MODEL,
    messages:[
     {role:'system',content:formatClinicalBundlePrompt({caps:body.caps})},
     {role:'user',content:valid.text}
    ],
    response_format:{type:'json_schema',json_schema:{
     name:'prontuario_ficticio',strict:true,schema:bundleJsonSchema()
    }},
    reasoning_effort:'low',
    temperature:0.15,
    max_completion_tokens:MAX_OUTPUT_TOKENS,
    stream:false
   }),
   signal:AbortSignal.timeout(39000)
  });
  if(!response.ok){
   if(response.status===429)return json({error:'Cota grátis de IA Groq atingida. Tente após a renovação da cota; a OpenAI NÃO foi acionada.'},429);
   if(response.status===401||response.status===403)return json({error:'Sua chave Groq não autorizou este modelo. Nenhuma IA paga foi utilizada.'},503);
   if(response.status===400)return json({error:'O modelo gratuito não aceitou o formato solicitado. Nenhuma chamada paga foi feita.'},502);
   return json({error:'A IA gratuita não respondeu. Sua evolução anterior foi preservada.'},502);
  }
  const raw=await response.text();
  if(raw.length>80000)return json({error:'A IA devolveu uma resposta excessiva.'},502);
  let result;
  try{result=JSON.parse(raw);}catch{return json({error:'Resposta inválida da Groq.'},502);}
  const message=result?.choices?.[0]?.message;
  const finish=result?.choices?.[0]?.finish_reason;
  if(finish==='length')return json({error:'A cota de tamanho cortou o texto. Confira o relato e tente apenas se necessário.'},502);
  const validated=validateClinicalBundle({status:'completed',output_text:message?.content},valid.text);
  if(!validated.ok)return json({error:validated.message},502);
  return json({
   text:validated.text,documents:validated.documents,pendencias:validated.pendencias,warnings:validated.warnings,mode:'bundle',
   provider:'groq',model:MODEL,freePlanRequired:true,
   usage:{input_tokens:Number(result?.usage?.prompt_tokens||0),output_tokens:Number(result?.usage?.completion_tokens||0)},
   reservation_usd:0,
   note:'Resposta do plano gratuito sujeita a cotas. Conteúdo fictício: revisar antes de usar.'
  });
 }catch(e){
  return json({error:e?.name==='TimeoutError'
   ?'IA grátis demorou demais. Não houve troca para serviço pago.'
   :'Falha na conexão gratuita. A OpenAI NÃO foi chamada.'},503);
 }
}
