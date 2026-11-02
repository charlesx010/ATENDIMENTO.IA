import { createClient } from '@supabase/supabase-js';
import {
 MAX_INPUT_CHARS, MODEL_NAME, MAX_OUTPUT_TOKENS, RESERVED_ESTIMATE_USD,
 validateClinicalDraft, formatClinicalPrompt, validateModelDraft,
 BUNDLE_MAX_OUTPUT_TOKENS, bundleJsonSchema, formatClinicalBundlePrompt, validateClinicalBundle
} from '../lib/ai-note.mjs';
import {deepJsonSchema,DEEP_OUTPUT_TOKENS,brazilianClinicalPrompt,validateDeepOpenAiResponse,normalizeBrazilianText} from '../lib/deep-clinical.mjs';
import {lookupEvidence,evidenceInstructions} from '../lib/clinical-evidence.mjs';

const json=(payload,status=200)=>new Response(JSON.stringify(payload),{
 status,
 headers:{
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store, no-cache, must-revalidate',
  'pragma':'no-cache',
  'x-content-type-options':'nosniff'
 }
});
const readBearer=request=>{
 const header=request.headers.get('authorization')||'';
 return /^Bearer [^\s]+$/.test(header)?header.slice(7):'';
};

export default async (request)=>{
 if(request.method!=='POST')return json({error:'Método não permitido.'},405);
 if(process.env.LEGACY_PAID_AI_ENABLED!=='true')return json({error:'IA paga legada desativada por segurança.'},503);
 // O recurso é DESATIVADO por padrão. Só habilitar após rodar chave NOVA,
 // ajustar orçamento explícito e concluir validação de uso fictício.
 if(process.env.TEXT_AI_ENABLED!=='true')
   return json({error:'IA ainda desativada por segurança. Aguarde ativação da chave nova e do limite financeiro.'},503);
 if(!process.env.OPENAI_API_KEY||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
   return json({error:'Serviço de IA ainda não configurado no servidor.'},503);
 if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))
   return json({error:'Formato de solicitação inválido.'},415);
 const contentLength=Number(request.headers.get('content-length')||0);
 if(contentLength>18000)return json({error:'Texto excede o limite de segurança.'},413);
 const token=readBearer(request);
 if(token.length<20||token.length>10000)return json({error:'Faça login para gerar a evolução com IA.'},401);
 let body;
 try{
  const raw=await request.text();
  if(raw.length>18000)return json({error:'Texto excede o limite de segurança.'},413);
  body=JSON.parse(raw);
 }catch{return json({error:'Solicitação inválida.'},400);}
 if(body?.consent!=='fictitious_only')
   return json({error:'Confirme que o texto é fictício e pode ser enviado à OpenAI.'},400);
 if(typeof body?.caps!=='boolean')return json({error:'Formato inválido.'},400);
 if(body?.mode!==undefined && !['bundle','deep'].includes(body.mode))return json({error:'Modo de IA inválido.'},400);
 const isBundle=body?.mode==='bundle';
 const isDeep=body?.mode==='deep';
 const valid=validateClinicalDraft(body?.text);
 if(!valid.ok)return json({error:valid.message},400);
 // Não permitir que o cliente escolha modelo, URL, instruções ou limites de tokens.
 let service;
 try{
  service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
   auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:identity,error:authError}=await service.auth.getUser(token);
  if(authError||!identity?.user)return json({error:'Sessão expirada. Entre novamente.'},401);
  const {data:profile,error:profileError}=await service.from('profiles')
   .select('role,enabled,must_change_password,ai_enabled,monthly_limit_usd')
   .eq('user_id',identity.user.id).single();
  if(profileError||!profile?.enabled||profile.must_change_password)
   return json({error:'Conta indisponível para uso de IA.'},403);
  if(!profile.ai_enabled||Number(profile.monthly_limit_usd)<=0)
   return json({error:'IA desativada para sua conta. Um administrador precisa autorizar e definir um limite mensal.'},403);
  if(profile.role==='admin'){
   let claims;
   try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}
   catch{return json({error:'Sessão inválida.'},401);}
   if(claims.sub!==identity.user.id||claims.aal!=='aal2')
    return json({error:'Confirme o segundo fator de autenticação antes de usar a IA.'},403);
  }
  // Aproveita a reserva mensal ATÔMICA já existente (US$0.02 por ação).
  // É uma estimativa conservadora, não corresponde à fatura real.
  // Mantém um teto compartilhado com a transcrição avançada.
  const {data:reserved,error:reservationError}=await service.rpc('reserve_transcription_budget',{
   p_user_id:identity.user.id
  });
  if(reservationError||reserved!==true)
   return json({error:'Limite financeiro de IA esgotado ou reserva não autorizada. Nenhuma chamada enviada.'},429);
 }catch{
  return json({error:'Não foi possível validar o acesso ou reservar orçamento.'},503);
 }

 const research=body?.webEvidence===true?await lookupEvidence(valid.text):{status:'disabled',sources:[],context:''};
 try{
  const response=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',
   headers:{
    'authorization':'Bearer '+process.env.OPENAI_API_KEY,
    'content-type':'application/json'
   },
   body:JSON.stringify({
    model:MODEL_NAME,
    store:false,
    max_output_tokens:isDeep?DEEP_OUTPUT_TOKENS:isBundle?BUNDLE_MAX_OUTPUT_TOKENS:MAX_OUTPUT_TOKENS,
    ...((isBundle||isDeep)?{reasoning:{effort:isDeep?'medium':'low'}}:{}),
    instructions:(isDeep?brazilianClinicalPrompt({caps:body.caps}):isBundle?formatClinicalBundlePrompt({caps:body.caps}):formatClinicalPrompt({caps:body.caps}))+'\nResponda estritamente em português brasileiro (pt-BR).\n'+evidenceInstructions(research),
    input:valid.text,
    ...((isBundle||isDeep)?{text:{format:{type:'json_schema',name:isDeep?'clinical_deep':'clinical_draft_bundle',strict:true,schema:isDeep?deepJsonSchema():bundleJsonSchema()}}}:{})
   }),
   signal:AbortSignal.timeout(isDeep?44000:isBundle?39000:22000)
  });
  if(!response.ok){
   const message=response.status===401?'Chave da OpenAI inválida ou revogada. Verifique a configuração privada do Netlify.'
     :response.status===429?'Limite ou saldo de API insuficiente.'
     :'Não foi possível gerar a evolução com IA. A evolução anterior foi preservada.';
   return json({error:message},502);
  }
  const raw=await response.text();
  if(raw.length>60000)return json({error:'Resposta excessiva da IA.'},502);
  let result;
  try{result=JSON.parse(raw);}catch{return json({error:'Resposta inválida do provedor de IA.'},502);}
  const checked=isDeep?validateDeepOpenAiResponse(result,valid.text):isBundle?validateClinicalBundle(result,valid.text):validateModelDraft(result);
  if(!checked.ok)return json({error:checked.message},502);
  return json({
   text:normalizeBrazilianText(checked.text),
   ...((isBundle||isDeep)?{documents:Object.fromEntries(Object.entries(checked.documents).map(([k,v])=>[k,normalizeBrazilianText(v)])),pendencias:normalizeBrazilianText(checked.pendencias),warnings:checked.warnings,mode:'bundle'}:{}),
   references:research.sources,evidence_status:research.status,
   model:MODEL_NAME,
   usage:{
    input_tokens:Number(result?.usage?.input_tokens||0),
    output_tokens:Number(result?.usage?.output_tokens||0)
   },
   reservation_usd:RESERVED_ESTIMATE_USD,
   note:isBundle?'Uma única chamada gerou propostas não validadas. Revise, selecione e edite antes de utilizar qualquer documento.':'Rascunho gerado a partir de dados fictícios. Revise antes de aplicar.'
  });
 }catch(error){
  return json({error:error?.name==='TimeoutError'?'A IA demorou demais. Texto original preservado.':
   'Erro de conexão com a IA. Texto original preservado.'},503);
 }
};
