import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePublicConfiguration,resolveRuntimeConfiguration} from '../shared/public-configuration.js';
import {createPublicConfigHandler} from '../netlify/functions/public-config.mjs';
const jwt=role=>[Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify({role})).toString('base64url'),'fake-signature'].join('.');
const publicConfig={url:'https://existing-project.supabase.co',anonKey:jwt('anon')};
test('configuração pública em runtime restaura inicialização sem variáveis de build',async()=>{
 let calls=0;
 const result=await resolveRuntimeConfiguration({fetcher:async(url,options)=>{calls++;assert.equal(url,'/api/public-config');assert.equal(options.cache,'no-store');return Response.json({supabase:publicConfig})}});
 assert.deepEqual(result,publicConfig);assert.equal(calls,1);
});
test('build configurado continua prioritário e não depende da rota nova',async()=>{
 const result=await resolveRuntimeConfiguration({existing:publicConfig,fetcher:async()=>{throw Error('não chamar servidor')}});
 assert.deepEqual(result,publicConfig);
});
test('configuração malformada e respostas HTML não causam crash do aplicativo',async()=>{
 for(const body of [null,{}, {url:'URL inválida',anonKey:jwt('anon')},{url:'https://SEU-PROJETO.supabase.co',anonKey:'SUA_CHAVE_PUBLICAVEL'},{url:'https://user:pass@project.supabase.co',anonKey:jwt('anon')}])assert.equal(validatePublicConfiguration(body),null);
 assert.equal(await resolveRuntimeConfiguration({fetcher:async()=>new Response('<html>SPA</html>')}),null);
});
test('chave de servidor não pode ser usada como chave pública nem aparecer na resposta',async()=>{
 for(const secret of [jwt('service_role'),'sb_secret_PRIVATE_TEST_SENTINEL']){
  const h=createPublicConfigHandler({env:{SUPABASE_URL:publicConfig.url,SUPABASE_ANON_KEY:secret,SUPABASE_SERVICE_ROLE_KEY:'private-service-sentinel',GROQ_API_KEY:'private-groq-sentinel'}});
  const r=await h(new Request('https://app.test/api/public-config'));assert.equal(r.status,503);const text=await r.text();assert.equal(text.includes(secret),false);assert.equal(text.includes('private-service-sentinel'),false);assert.equal(text.includes('private-groq-sentinel'),false);
 }
});
test('endpoint público retorna apenas projeção pública e readiness sem segredos',async()=>{
 const h=createPublicConfigHandler({env:{SUPABASE_URL:publicConfig.url,SUPABASE_ANON_KEY:publicConfig.anonKey,SUPABASE_SERVICE_ROLE_KEY:'PRIVATE_SENTINEL',GROQ_API_KEY:'GROQ_SENTINEL'}});
 const r=await h(new Request('https://app.test/api/public-config'));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');const body=await r.json();assert.equal(body.configured,true);assert.equal(body.loginReady,true);assert.deepEqual(body.supabase,publicConfig);assert.equal(JSON.stringify(body).includes('SENTINEL'),false);
});
test('chave publicável nova é aceita e configuração ausente continua indisponível',async()=>{
 assert.ok(validatePublicConfiguration({url:publicConfig.url,anonKey:'sb_publishable_public_test_value_only'}));
 const r=await createPublicConfigHandler({env:{}})(new Request('https://app.test/api/public-config'));assert.equal(r.status,503);assert.equal((await r.json()).configured,false);
});
