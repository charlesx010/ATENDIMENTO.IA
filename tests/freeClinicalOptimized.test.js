import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/free-clinical.mjs';

test('Modo gratuito: não habilita sem chave privada e configuração explícita',async()=>{
 const beforeKey=process.env.GROQ_API_KEY,beforeEnabled=process.env.FREE_TRANSCRIPTION_ENABLED;
 try{
  delete process.env.GROQ_API_KEY;
  process.env.FREE_TRANSCRIPTION_ENABLED='false';
  const res=await handler(new Request('https://example.test/api/free-clinical'));
  assert.equal(res.status,200);
  assert.equal((await res.json()).available,false);
  const post=await handler(new Request('https://example.test/api/free-clinical',{
   method:'POST',headers:{'content-type':'application/json'},body:'{}'
  }));
  assert.equal(post.status,503);
 }finally{
  if(beforeKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=beforeKey;
  if(beforeEnabled===undefined)delete process.env.FREE_TRANSCRIPTION_ENABLED;else process.env.FREE_TRANSCRIPTION_ENABLED=beforeEnabled;
 }
});

test('IA grátis distingue disponibilidade, exige autenticação antes de processar',async()=>{
 const beforeKey=process.env.GROQ_API_KEY,beforeEnabled=process.env.FREE_TRANSCRIPTION_ENABLED;
 try{
  process.env.GROQ_API_KEY='EXCLUSIVAMENTE-FALSA-CHAVE-DE-TESTE';
  process.env.FREE_TRANSCRIPTION_ENABLED='true';
  const get=await handler(new Request('https://example.test/api/free-clinical'));
  assert.equal((await get.json()).available,true);
  const post=await handler(new Request('https://example.test/api/free-clinical',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({text:'Paciente fictício com trauma de joelho.',consent:'fictitious_only',caps:true,mode:'simple'})
  }));
  assert.equal(post.status,401);
 }finally{
  if(beforeKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=beforeKey;
  if(beforeEnabled===undefined)delete process.env.FREE_TRANSCRIPTION_ENABLED;else process.env.FREE_TRANSCRIPTION_ENABLED=beforeEnabled;
 }
});

test('Sem confirmação do plano Free: rejeita antes de chamar qualquer provedor',async()=>{
 const beforeKey=process.env.GROQ_API_KEY,beforeEnabled=process.env.FREE_TRANSCRIPTION_ENABLED;
 try{
  process.env.GROQ_API_KEY='EXCLUSIVAMENTE-FALSA-CHAVE-DE-TESTE';
  process.env.FREE_TRANSCRIPTION_ENABLED='true';
  const res=await handler(new Request('https://example.test/api/free-clinical',{
   method:'POST',headers:{'content-type':'application/json',authorization:'Bearer TESTE_DE_TOKEN_COM_MAIS_DE_VINTE_CARACTERES'},
   body:JSON.stringify({text:'Paciente fictício com trauma de joelho.',consent:'fictitious_only',caps:true,mode:'simple'})
  }));
  assert.equal(res.status,400);
  assert.match((await res.json()).error,/Free/);
 }finally{
  if(beforeKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=beforeKey;
  if(beforeEnabled===undefined)delete process.env.FREE_TRANSCRIPTION_ENABLED;else process.env.FREE_TRANSCRIPTION_ENABLED=beforeEnabled;
 }
});
