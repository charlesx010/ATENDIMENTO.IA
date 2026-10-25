import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/free-transcription.mjs';

test('Transcrição por IA não habilita sem chave e consentimento',async()=>{
 const saved={enable:process.env.FREE_TRANSCRIPTION_ENABLED,key:process.env.GROQ_API_KEY};
 try{
  delete process.env.GROQ_API_KEY;
  process.env.FREE_TRANSCRIPTION_ENABLED='false';
  const get=await handler(new Request('https://teste.local/api/free-transcription'));
  assert.equal(get.status,200);
  assert.equal((await get.json()).available,false);
  const post=await handler(new Request('https://teste.local/api/free-transcription',{
   method:'POST',headers:{'content-type':'audio/webm'},body:'audio fictício'
  }));
  assert.equal(post.status,503);
 }finally{
  for(const [key,val] of Object.entries({FREE_TRANSCRIPTION_ENABLED:saved.enable,GROQ_API_KEY:saved.key})){
   if(val===undefined)delete process.env[key];else process.env[key]=val;
  }
 }
});

test('Transcrição por IA rejeita solicitação sem sessão antes de qualquer upload',async()=>{
 const saved={enable:process.env.FREE_TRANSCRIPTION_ENABLED,key:process.env.GROQ_API_KEY};
 try{
  process.env.FREE_TRANSCRIPTION_ENABLED='true';
  process.env.GROQ_API_KEY='fake-test-key';
  const result=await handler(new Request('https://teste.local/api/free-transcription',{
   method:'POST',
   headers:{'content-type':'audio/webm','x-clinical-consent':'fictitious_only'},
   body:'audio fictício'
  }));
  assert.equal(result.status,401);
 }finally{
  if(saved.enable===undefined)delete process.env.FREE_TRANSCRIPTION_ENABLED;else process.env.FREE_TRANSCRIPTION_ENABLED=saved.enable;
  if(saved.key===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=saved.key;
 }
});
