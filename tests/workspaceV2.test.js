import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyConsultation,parseConsultation,canExport,sourceChanged} from '../src/workspace/model.js';
import {ConsultationSync} from '../src/workspace/sync.js';
import {createDocumentationHandler} from '../netlify/functions/organize-note.mjs';
const row=(version,payload=emptyConsultation())=>({version,payload,expires_at:'2030-01-01T00:00:00Z'});
function fixture(initial=null){
 let remote=initial,local=emptyConsultation(),state,saveCount=0;
 const c=new ConsultationSync({store:{read:async()=>remote,save:async(expected,payload)=>{saveCount++;if((remote?.version??null)!==expected)return {status:'conflict',row:remote};remote=row('v'+saveCount,payload);return{status:'saved',row:remote}}},getLocal:()=>local,applyRemote:v=>{local=v},onState:s=>{state=s}});
 return{c,get local(){return local},set local(v){local=v},get state(){return state},set remote(v){remote=v},get remote(){return remote},get saveCount(){return saveCount}};
}
test('revisão é invalidada ao mudar o relato e campos inválidos não entram na sessão',()=>{
 const doc={...emptyConsultation(),source:'Relato original.',generatedFrom:'Relato original.',summary:'Resumo',reviewed:true};
 assert.equal(canExport(doc),true);
 assert.equal(canExport(sourceChanged(doc,'Relato alterado.')),false);
 assert.throws(()=>parseConsultation({...doc,source:'a'.repeat(6001)}));
 assert.throws(()=>parseConsultation({...doc,soap:null}));
 assert.throws(()=>parseConsultation({...doc,reviewed:'true'}));
});
test('primeiro aparelho salva e segundo retoma sem criar escrita desnecessária',async()=>{
 const f=fixture(); f.local={...emptyConsultation(),source:'Paciente fictício relata dor no joelho.'};
 await f.c.connect(); await f.c.tick();assert.equal(f.state.phase,'synced');assert.equal(f.saveCount,1);
 await f.c.tick();assert.equal(f.saveCount,1);
 const g=fixture(f.remote);await g.c.connect();assert.equal(g.local.source,f.local.source);assert.equal(g.state.phase,'synced');
});
test('alteração concorrente gera conflito e preserva conteúdo local',async()=>{
 const f=fixture(row('old'));await f.c.connect();f.local={...f.local,source:'Anotação do celular'};f.c.changed();
 f.remote=row('other',{...emptyConsultation(),source:'Anotação do PC'});await f.c.tick();
 assert.equal(f.state.phase,'conflict');assert.equal(f.local.source,'Anotação do celular');assert.equal(f.saveCount,0);
 await f.c.tick();assert.equal(f.saveCount,0);
 await f.c.useRemote();assert.equal(f.local.source,'Anotação do PC');
});
test('aparelho sem edição recebe atualização da nuvem',async()=>{
 const f=fixture(row('one'));await f.c.connect();f.remote=row('two',{...emptyConsultation(),source:'Nova anotação'});await f.c.tick();assert.equal(f.local.source,'Nova anotação');assert.equal(f.saveCount,0);
});
test('conectar com conteúdo local e remoto não destrói nenhum deles',async()=>{
 const f=fixture(row('remote'));f.local={...emptyConsultation(),source:'Rascunho local'};await f.c.connect();assert.equal(f.state.phase,'conflict');assert.equal(f.local.source,'Rascunho local');
});
test('edição durante gravação de rede mantém uma nova gravação pendente',async()=>{
 let local=emptyConsultation(),state,release;
 const c=new ConsultationSync({store:{read:async()=>null,save:()=>new Promise(r=>{release=r})},getLocal:()=>local,applyRemote:v=>{local=v},onState:s=>{state=s}});
 await c.connect();const pending=c.tick();await new Promise(r=>setTimeout(r,0));
 local={...local,source:'Edição durante rede'};c.changed();release({status:'saved',row:row('new')});await pending;
 assert.equal(state.phase,'pending');assert.equal(c.dirty,true);
});
test('alteração local durante leitura remota não é apagada',async()=>{
 let local=emptyConsultation(),state,release,reads=0;
 const c=new ConsultationSync({store:{read:()=>++reads===1?Promise.resolve(row('initial')):new Promise(r=>{release=r}),save:async()=>{throw Error('não deveria salvar')}},getLocal:()=>local,applyRemote:v=>{local=v},onState:s=>{state=s}});
 await c.connect();const pending=c.tick();local={...local,source:'digitado durante leitura'};release(row('changed'));await pending;
 assert.equal(state.phase,'conflict');assert.equal(local.source,'digitado durante leitura');
});
test('erro de conexão preserva rascunho e não informa sincronizado',async()=>{
 let local={...emptyConsultation(),source:'Manter este texto'},state;
 const c=new ConsultationSync({store:{read:async()=>{throw Error('offline')}},getLocal:()=>local,applyRemote:()=>{throw Error('não aplicar')},onState:s=>{state=s}});
 await c.connect();assert.equal(state.phase,'error');assert.equal(local.source,'Manter este texto');
});
test('sessão expirada não é restaurada como consulta válida',async()=>{
 const f=fixture({...row('expired'),expires_at:'2000-01-01T00:00:00Z'});await f.c.connect();assert.equal(f.state.phase,'pending');assert.equal(f.c.version,null);
});
const env={GROQ_API_KEY:'test-only-not-a-real-secret',GROQ_CLINICAL_ENABLED:'true',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-only'};
const note={summary:'Paciente refere dor à direita.',subjective:'Dor à direita há 3 dias.',objective:'',assessment:'',plan:'',pending:'Exame físico não informado.'};
const request=(body={},auth=true)=>new Request('https://example.test/api/organize-note',{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer test-token-with-more-than-twenty-characters'}:{})},body:JSON.stringify({text:'Paciente fictício relata dor no joelho direito há três dias.',consent:'fictitious_only',freePlanAcknowledged:true,...body})});
test('IA exige sessão e consentimento antes de contatar provedor',async()=>{
 let calls=0;const h=createDocumentationHandler({env,limiter:async()=>({allowed:true}),authenticate:async()=>true,fetcher:async()=>{calls++}});
 assert.equal((await h(request({},false))).status,401);assert.equal((await h(request({consent:false}))).status,400);assert.equal(calls,0);
});
test('conta sem permissão não aciona o provedor',async()=>{
 let calls=0;const h=createDocumentationHandler({env,limiter:async()=>({allowed:true}),authenticate:async()=>false,fetcher:async()=>{calls++}});
 assert.equal((await h(request())).status,403);assert.equal(calls,0);
});
test('JSON válido de documentação é devolvido como rascunho não revisado',async()=>{
 const h=createDocumentationHandler({env,limiter:async()=>({allowed:true}),authenticate:async()=>true,fetcher:async(url,options)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
  const body=JSON.parse(options.body);assert.match(body.messages[0].content,/Não invente/);
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(note)}}]});
 }});
 const r=await h(request());assert.equal(r.status,200);const body=await r.json();assert.equal(body.requiresReview,true);assert.equal(body.note.objective,'');
});
test('JSON inválido e geração truncada são rejeitados',async()=>{
 for(const choice of [{finish_reason:'length',message:{content:JSON.stringify(note)}},{finish_reason:'stop',message:{content:'não é JSON'}},{finish_reason:'stop',message:{content:JSON.stringify({...note,plan:12})}}]){
  const h=createDocumentationHandler({env,limiter:async()=>({allowed:true}),authenticate:async()=>true,fetcher:async()=>Response.json({choices:[choice]})});assert.equal((await h(request())).status,502);
 }
});
test('cota excedida é informada sem fallback pago',async()=>{
 let calls=0;const h=createDocumentationHandler({env,limiter:async()=>({allowed:true}),authenticate:async()=>true,fetcher:async()=>{calls++;return new Response('',{status:429})}});
 assert.equal((await h(request())).status,429);assert.equal(calls,1);
});

test('exclusão da nuvem requer versão atual e desativa novas gravações',async()=>{
 let local=emptyConsultation(),state,deletedVersion;
 const c=new ConsultationSync({store:{read:async()=>row('current'),remove:async v=>{deletedVersion=v;return true}},getLocal:()=>local,applyRemote:v=>{local=v},onState:s=>{state=s}});
 await c.connect();assert.equal(await c.clear(),true);assert.equal(deletedVersion,'current');assert.equal(state.phase,'disabled');assert.equal(c.active,false);
});
test('exclusão recusada por conflito mantém o rascunho',async()=>{
 let local=emptyConsultation(),state;
 const c=new ConsultationSync({store:{read:async()=>row('old'),remove:async()=>false},getLocal:()=>local,applyRemote:v=>{local=v},onState:s=>{state=s}});
 await c.connect();local={...local,source:'Não perder'};assert.equal(await c.clear(),false);assert.equal(local.source,'Não perder');assert.equal(state.phase,'conflict');
});

test('falha inicial de rede seguida de retry salva o conteúdo local',async()=>{
 let local={...emptyConsultation(),source:'Rascunho antes de conectar'},state,reads=0,saved=false;
 const c=new ConsultationSync({store:{read:async()=>{if(++reads===1)throw Error('offline');return null},save:async(v,payload)=>{saved=true;return{status:'saved',row:row('new',payload)}}},getLocal:()=>local,applyRemote:v=>{local=v},onState:s=>{state=s}});
 await c.connect();assert.equal(state.phase,'error');await c.tick();assert.equal(saved,true);assert.equal(state.phase,'synced');
});
