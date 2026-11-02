import test from 'node:test';
import assert from 'node:assert/strict';
import legacyClinical from '../netlify/functions/free-clinical.mjs';
import legacyBundle from '../netlify/functions/free-clinical-ai.mjs';
import {createTranscriptionHandler} from '../netlify/functions/free-transcription.mjs';
import {createDocumentationHandler} from '../netlify/functions/organize-note.mjs';
import {createAccountUsageHandler} from '../netlify/functions/account-usage.mjs';
import {documentationEnabled,legacyUsageEnforced,reserveLegacyUsage,UsageAccessError} from '../netlify/lib/usage-policy.mjs';

const identity={userId:'00000000-0000-4000-8000-000000000021'};
const oldEnv={FREE_TRANSCRIPTION_ENABLED:'true',GROQ_API_KEY:'FAKE_COMPATIBILITY_TEST_KEY',SUPABASE_URL:'https://compatibility-test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'FAKE_COMPATIBILITY_SERVICE_KEY'};
const token='compatibility-test-token-longer-than-twenty-characters';
const noteRequest=fields=>new Request('https://test.invalid/api/free-clinical',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({text:'Paciente fictício relata dor no joelho direito há três dias.',caps:false,mode:'bundle',consent:'fictitious_only',freePlanAcknowledged:true,...fields})});
const audioRequest=()=>new Request('https://test.invalid/api/free-transcription',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'audio/wav','x-clinical-consent':'fictitious_only'},body:new Uint8Array(2000)});
async function withExistingInstallation(extra,work){
 const keys=['AI_USAGE_ENFORCEMENT','FREE_TRANSCRIPTION_ENABLED','GROQ_CLINICAL_ENABLED','GROQ_TRANSCRIPTION_ENABLED','GROQ_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
 const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));const original=globalThis.fetch;
 const calls={auth:0,quota:0,provider:0};
 try{
  for(const key of keys)delete process.env[key];Object.assign(process.env,oldEnv,extra);
  globalThis.fetch=async url=>{
   const destination=String(url);
   if(destination.includes('/auth/v1/user')){calls.auth++;return Response.json({id:identity.userId});}
   if(destination.includes('/rest/v1/profiles'))return Response.json({enabled:true,must_change_password:false,role:'medico'});
   if(destination.includes('/rest/v1/rpc/reserve_ai_usage')){calls.quota++;return Response.json({code:'PGRST202',message:'Quota migration not installed'},{status:404});}
   if(destination.startsWith('https://api.groq.com/')){calls.provider++;return new Response('',{status:502});}
   throw Error('Unexpected network destination in compatibility test');
  };
  await work(calls);
 }finally{
  globalThis.fetch=original;
  for(const [key,value]of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
}

test('instalação anterior usa os endpoints Groq originais sem depender de tabela nova',async()=>{
 await withExistingInstallation({},async calls=>{
  for(const handler of [legacyClinical,legacyBundle])assert.equal((await handler(noteRequest())).status,502);
  const voice=createTranscriptionHandler();assert.equal((await voice(audioRequest())).status,502);
  assert.equal(calls.quota,0);assert.equal(calls.provider,3);assert.equal(calls.auth,3);
 });
});

test('cotas ativadas explicitamente falham fechadas se migração não existe',async()=>{
 await withExistingInstallation({AI_USAGE_ENFORCEMENT:'true'},async calls=>{
  for(const handler of [legacyClinical,legacyBundle]){
   const response=await handler(noteRequest());assert.equal(response.status,503);assert.equal((await response.json()).code,'usage_unavailable');
  }
  const response=await createTranscriptionHandler()(audioRequest());assert.equal(response.status,503);
  assert.equal(calls.quota,3);assert.equal(calls.provider,0);assert.equal(calls.auth,3);
 });
});

test('compatibilidade não pula autenticação nem consentimento dos endpoints anteriores',async()=>{
 await withExistingInstallation({},async calls=>{
  for(const handler of [legacyClinical,legacyBundle]){
   assert.equal((await handler(new Request('https://test.invalid/api/free-clinical',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}))).status,401);
   assert.equal((await handler(noteRequest({consent:'not-authorized'}))).status,400);
  }
  const voice=createTranscriptionHandler();
  assert.equal((await voice(new Request('https://test.invalid/api/free-transcription',{method:'POST',body:new Uint8Array(2000)}))).status,401);
  assert.equal(calls.provider,0);assert.equal(calls.auth,0);assert.equal(calls.quota,0);
 });
});

test('flag histórica habilita documentação nova, mas false explícito prevalece',async()=>{
 assert.equal(documentationEnabled(oldEnv),true);
 assert.equal(documentationEnabled({...oldEnv,GROQ_CLINICAL_ENABLED:'false'}),false);
 const get=env=>createDocumentationHandler({env})(new Request('https://test.invalid/api/organize-note'));
 assert.equal((await (await get(oldEnv)).json()).available,true);
 assert.equal((await (await get({...oldEnv,GROQ_CLINICAL_ENABLED:'false'})).json()).available,false);
});

test('organização nova continua exigindo cotas mesmo em modo de compatibilidade',async()=>{
 let provider=0,reservations=0;
 const handler=createDocumentationHandler({env:oldEnv,authenticate:async()=>identity,limiter:async()=>{reservations++;throw new UsageAccessError('Controle de uso indisponível.');},fetcher:async()=>{provider++;}});
 const response=await handler(noteRequest());assert.equal(response.status,503);assert.equal(reservations,1);assert.equal(provider,0);
});

test('painel informa modo anterior sem fabricar contagem ou consultar tabela ausente',async()=>{
 let queries=0;
 const handler=createAccountUsageHandler({env:oldEnv,authenticate:async()=>({...identity,client:{from:()=>{queries++;throw Error('Do not query absent table');}}})});
 const response=await handler(new Request('https://test.invalid/api/account-usage',{headers:{authorization:`Bearer ${token}`}}));
 assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.enforced,false);assert.equal(body.enforcementMode,'legacy-provider-limits');assert.equal(body.accounting,'provider-limits');assert.equal(body.operations,null);assert.equal(queries,0);
 assert.equal(body.features.documentation,true);assert.equal(JSON.stringify(body).includes('FAKE_COMPATIBILITY'),false);
});

test('rollout inválido não é interpretado como autorização para desativar cotas',async()=>{
 assert.equal(legacyUsageEnforced({}),false);assert.equal(legacyUsageEnforced({AI_USAGE_ENFORCEMENT:'false'}),false);
 assert.equal(legacyUsageEnforced({AI_USAGE_ENFORCEMENT:'true'}),true);
 assert.throws(()=>legacyUsageEnforced({AI_USAGE_ENFORCEMENT:'typo'}),UsageAccessError);
 let reserves=0;await assert.rejects(()=>reserveLegacyUsage(identity,'transcription',{AI_USAGE_ENFORCEMENT:'typo'},async()=>{reserves++;}),UsageAccessError);
 assert.equal(reserves,0);
});

test('flags novas false bloqueiam rotas antigas mesmo com FREE_TRANSCRIPTION_ENABLED=true',async()=>{
 await withExistingInstallation({GROQ_CLINICAL_ENABLED:'false',GROQ_TRANSCRIPTION_ENABLED:'false'},async calls=>{
  for(const handler of [legacyClinical,legacyBundle])assert.equal((await handler(noteRequest())).status,503);
  assert.equal((await createTranscriptionHandler()(audioRequest())).status,503);
  assert.equal(calls.provider,0);assert.equal(calls.auth,0);assert.equal(calls.quota,0);
 });
});
