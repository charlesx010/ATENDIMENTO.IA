import test from 'node:test';
import assert from 'node:assert/strict';
import freeClinicalAi from '../netlify/functions/free-clinical-ai.mjs';

test('Groq desabilitada nunca aciona a OpenAI',async()=>{
 const previous={key:process.env.GROQ_API_KEY,flag:process.env.FREE_TRANSCRIPTION_ENABLED};
 try{
  process.env.FREE_TRANSCRIPTION_ENABLED='false';
  delete process.env.GROQ_API_KEY;
  const status=await freeClinicalAi(new Request('https://test.local/api/free-clinical-ai'));
  assert.equal((await status.json()).available,false);
  const res=await freeClinicalAi(new Request('https://test.local/api/free-clinical-ai',{
   method:'POST',headers:{'content-type':'application/json'},body:'{}'
  }));
  assert.equal(res.status,503);
  assert.match((await res.json()).error,/NÃO foi chamada/i);
 }finally{
  if(previous.key===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=previous.key;
  if(previous.flag===undefined)delete process.env.FREE_TRANSCRIPTION_ENABLED;else process.env.FREE_TRANSCRIPTION_ENABLED=previous.flag;
 }
});

test('Groq ativa exige login e consentimento antes de gerar',async()=>{
 const previous={key:process.env.GROQ_API_KEY,flag:process.env.FREE_TRANSCRIPTION_ENABLED};
 try{
  process.env.FREE_TRANSCRIPTION_ENABLED='true';
  process.env.GROQ_API_KEY='fake-groq-key-for-tests';
  const status=await freeClinicalAi(new Request('https://test.local/api/free-clinical-ai'));
  assert.equal((await status.json()).available,true);
  const res=await freeClinicalAi(new Request('https://test.local/api/free-clinical-ai',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({text:'PACIENTE FICTÍCIO COM DOR NO JOELHO HÁ 3 DIAS',caps:true,mode:'bundle',consent:'fictitious_only'})
  }));
  assert.equal(res.status,401);
 }finally{
  if(previous.key===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=previous.key;
  if(previous.flag===undefined)delete process.env.FREE_TRANSCRIPTION_ENABLED;else process.env.FREE_TRANSCRIPTION_ENABLED=previous.flag;
 }
});
