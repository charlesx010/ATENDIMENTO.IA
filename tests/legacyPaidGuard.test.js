import test from 'node:test';
import assert from 'node:assert/strict';
import transcribe from '../netlify/functions/transcribe.mjs';
import evolution from '../netlify/functions/ai-evolution.mjs';
test('chaves e flags antigas não reativam chamadas pagas sem autorização global explícita',async()=>{
 const names=['LEGACY_PAID_AI_ENABLED','OPENAI_API_KEY','TEXT_AI_ENABLED'];const previous=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 const original=globalThis.fetch;let calls=0;
 try{
  delete process.env.LEGACY_PAID_AI_ENABLED;process.env.OPENAI_API_KEY='not-a-real-test-key';process.env.TEXT_AI_ENABLED='true';
  globalThis.fetch=async()=>{calls++;throw Error('nenhuma chamada externa deveria ocorrer')};
  for(const handler of [transcribe,evolution]){
   const response=await handler(new Request('https://example.test/function',{method:'POST',body:'{}'}));
   assert.equal(response.status,503);assert.match((await response.json()).error,/legad[oa].*desativad[oa]/i);
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;for(const key of names){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}}
});
