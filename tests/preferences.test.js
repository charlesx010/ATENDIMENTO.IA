import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreferencesHandler} from '../netlify/functions/preferences.mjs';
const preferences={specialty:'Clínica Geral',caps:false,format:'Narrativo'};
const req=(body=preferences,auth=true)=>new Request('https://app.test/api/preferences',{method:'PUT',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer fake-token-more-than-twenty-characters'}:{})},body:JSON.stringify(body)});
function fixture({previous={},writeError=null,removed=false,readError=null}={}){
 let written,owner;
 const query={from:table=>{assert.equal(table,'profiles');return{
  select:columns=>{assert.equal(columns,'preferences');return{eq:(key,id)=>{assert.equal(key,'user_id');assert.equal(id,'own-user');return{maybeSingle:async()=>({data:{preferences:previous},error:readError})}}}},
  update:data=>{written=data;return{eq:(key,id)=>{owner=id;assert.equal(key,'user_id');return{select:columns=>{assert.equal(columns,'user_id');return{maybeSingle:async()=>({data:removed?null:{user_id:id},error:writeError})}}}}}}
 }}};
 return {handler:createPreferencesHandler({authenticate:async()=>({userId:'own-user',client:query})}),get written(){return written},get owner(){return owner}};
}
test('salva somente preferências do proprietário pelo servidor, sem UPDATE público no navegador',async()=>{
 const f=fixture();const r=await f.handler(req());assert.equal(r.status,200);assert.equal(f.owner,'own-user');assert.deepEqual(f.written,{preferences});
});
test('sem sessão ou com campos de elevação/consulta não salva preferências',async()=>{
 let calls=0;const h=createPreferencesHandler({authenticate:async()=>{calls++;throw Error('não chamar')}});
 assert.equal((await h(req(preferences,false))).status,401);
 for(const extra of [{role:'admin'},{enabled:true},{source:'relato de consulta'},{user_id:'outro'}])assert.equal((await h(req({...preferences,...extra}))).status,400);
 assert.equal(calls,0);
});
test('falha de banco não é informada como gravação bem sucedida',async()=>{
 const f=fixture({writeError:{message:'não expor'}});const r=await f.handler(req());assert.equal(r.status,503);assert.equal((await r.text()).includes('não expor'),false);
});
test('salvar campos permitidos preserva outras configurações existentes e remove só região obsoleta',async()=>{
 const f=fixture({previous:{theme:'dark',shortcuts:{enabled:true},region:'antiga',caps:true}});const r=await f.handler(req());assert.equal(r.status,200);assert.deepEqual(f.written.preferences,{theme:'dark',shortcuts:{enabled:true},...preferences});assert.deepEqual((await r.json()).preferences,preferences);
});
test('não escreve ao falhar leitura e não informa sucesso se o perfil sumiu durante gravação',async()=>{
 const unreadable=fixture({readError:{message:'sem acesso'}});assert.equal((await unreadable.handler(req())).status,503);assert.equal(unreadable.written,undefined);
 const gone=fixture({removed:true});assert.equal((await gone.handler(req())).status,503);
});
