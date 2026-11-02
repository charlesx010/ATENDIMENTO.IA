import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreferencesHandler} from '../netlify/functions/preferences.mjs';
const preferences={specialty:'Clínica Geral',caps:false,format:'Narrativo'};
const req=(body=preferences,auth=true)=>new Request('https://app.test/api/preferences',{method:'PUT',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer fake-token-more-than-twenty-characters'}:{})},body:JSON.stringify(body)});
test('salva somente preferências do proprietário pelo servidor, sem UPDATE público no navegador',async()=>{
 let written,owner;const h=createPreferencesHandler({authenticate:async()=>({userId:'own-user',client:{from:table=>{assert.equal(table,'profiles');return{update:data=>{written=data;return{eq:async(key,id)=>{owner=id;assert.equal(key,'user_id');return{error:null}}}}}}}})});
 const r=await h(req());assert.equal(r.status,200);assert.equal(owner,'own-user');assert.deepEqual(written,{preferences});
});
test('sem sessão ou com campos de elevação/consulta não salva preferências',async()=>{
 let calls=0;const h=createPreferencesHandler({authenticate:async()=>{calls++;throw Error('não chamar')}});
 assert.equal((await h(req(preferences,false))).status,401);
 for(const extra of [{role:'admin'},{enabled:true},{source:'relato de consulta'},{user_id:'outro'}])assert.equal((await h(req({...preferences,...extra}))).status,400);
 assert.equal(calls,0);
});
test('falha de banco não é informada como gravação bem sucedida',async()=>{
 const h=createPreferencesHandler({authenticate:async()=>({userId:'own-user',client:{from:()=>({update:()=>({eq:async()=>({error:{message:'não expor'}})})})}})});
 const r=await h(req());assert.equal(r.status,503);assert.equal((await r.text()).includes('não expor'),false);
});
