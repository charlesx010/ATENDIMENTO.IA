import {test,expect} from '@playwright/test';

// Instalação simulada anterior: apenas profiles + clinical_sessions.
// Nenhum token, banco ou provedor real é acessado por estas fixtures.
const origin='https://runtime-example.supabase.co';
const userId='11111111-1111-4111-8111-111111111111';
const jwt=payload=>`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.c2lnbmF0dXJl`;
const anonKey=jwt({role:'anon',iss:'supabase-test-only'});
const accessToken=()=>jwt({sub:userId,role:'authenticated',aal:'aal1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]});
const user={id:userId,aud:'authenticated',role:'authenticated',email:'fictitious@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],factors:[],created_at:'2026-01-01T00:00:00Z'};
const profile={user_id:userId,username:'josiane',display_name:'Josiane de teste',role:'medico',enabled:true,must_change_password:false,preferences:{specialty:'Clínica Geral',caps:false}};
async function existingInstallation(page,{seedSession=true}={}){
 const events={publicConfig:0,profileSelect:[],directProfileWrites:[],unknownTables:[],sessionWrites:[],preferenceWrites:[],login:[]};
 let row=null;
 if(seedSession){
  await page.addInitScript(({session})=>localStorage.setItem('sb-runtime-example-auth-token',JSON.stringify(session)),{session:{access_token:accessToken(),refresh_token:'test-refresh-token-only',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user}});
 }
 await page.route('**/api/public-config',route=>{events.publicConfig++;return route.fulfill({json:{configured:true,supabase:{url:origin,anonKey},loginReady:true,error:null}})});
 await page.route(origin+'/auth/v1/**',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname==='/auth/v1/user')return route.fulfill({json:user});
  return route.fulfill({status:404,json:{error:'Not configured in this test'}});
 });
 await page.route(origin+'/rest/v1/**',route=>{
  const request=route.request(),url=new URL(request.url()),table=url.pathname.split('/').at(-1);
  if(table==='profiles'){
   if(request.method()!=='GET'){events.directProfileWrites.push(request.method());return route.fulfill({status:403,json:{message:'direct profile update denied'}})}
   events.profileSelect.push(url.searchParams.get('select'));
   return route.fulfill({json:[profile]});
  }
  if(table==='clinical_sessions'){
   if(request.method()==='GET')return route.fulfill({json:row?[row]:[]});
   if(['POST','PATCH'].includes(request.method())){
    const body=request.postDataJSON();events.sessionWrites.push({method:request.method(),body});
    row={...row,...body,user_id:userId,updated_at:new Date().toISOString()};
    return route.fulfill({json:row});
   }
   if(request.method()==='DELETE'){row=null;return route.fulfill({status:204,body:''})}
  }
  events.unknownTables.push(table);
  return route.fulfill({status:404,json:{code:'PGRST205',message:'This installation only has profiles and clinical_sessions'}});
 });
 await page.route('**/api/preferences',route=>{
  const request=route.request();events.preferenceWrites.push(request.postDataJSON());
  return route.fulfill({json:{preferences:request.postDataJSON()}});
 });
 await page.route('**/api/login',route=>{
  events.login.push(route.request().postDataJSON());
  return route.fulfill({json:{access_token:accessToken(),refresh_token:'test-refresh-token-only'}});
 });
 await page.route('**/api/free-clinical',route=>route.fulfill({json:{available:false}}));
 await page.route('**/api/free-transcription',route=>route.fulfill({json:{available:false}}));
 return {events,get row(){return row}};
}

test('instalação existente conecta por configuração pública e mantém clinical_sessions e preferências',async({page})=>{
 const fixture=await existingInstallation(page);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/josiane');
 await expect(page.getByRole('heading',{name:'Atendimento simplificado'})).toBeVisible();
 expect(fixture.events.publicConfig).toBeGreaterThan(0);
 expect(fixture.events.profileSelect.length).toBeGreaterThan(0);
 expect(fixture.events.profileSelect.every(select=>!/(ai_enabled|monthly_limit_usd)/.test(select))).toBe(true);
 const source='Paciente fictício relata dor no joelho direito. Sem outros achados informados.';
 await page.getByRole('textbox',{name:'Transcrição / relato editável',exact:true}).fill(source);
 page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Ativar sincronização temporária',exact:true}).click();
 await expect.poll(()=>fixture.events.sessionWrites.length).toBeGreaterThan(0);
 expect(fixture.row.payload).toMatchObject({schema:1,raw:source});
 expect(fixture.events.sessionWrites[0].method).toBe('POST');
 await page.getByRole('textbox',{name:'Informações complementares',exact:true}).fill('Complemento fictício registrado no mesmo atendimento.');
 await expect.poll(()=>fixture.row.payload.complement).toBe('Complemento fictício registrado no mesmo atendimento.');
 expect(fixture.events.sessionWrites.some(event=>event.method==='PATCH')).toBe(true);
 await page.getByRole('button',{name:'Configurações',exact:true}).click();
 await page.getByRole('combobox',{name:'Especialidade',exact:true}).selectOption('Medicina de Família e Comunidade');
 await page.getByRole('button',{name:'Salvar preferências',exact:true}).click();
 await expect(page.getByText('Preferências salvas. Nenhum conteúdo clínico foi enviado.',{exact:true})).toBeVisible();
 expect(fixture.events.preferenceWrites).toEqual([{specialty:'Medicina de Família e Comunidade',caps:false,format:'Narrativo'}]);
 expect(fixture.events.directProfileWrites).toEqual([]);
 expect(fixture.events.unknownTables).toEqual([]);
 expect(errors).toEqual([]);
});

test('página /usuario aceita login usando somente configuração pública do servidor',async({page})=>{
 const {events}=await existingInstallation(page,{seedSession:false});
 await page.goto('/josiane');
 await expect(page.getByRole('heading',{name:'Entrar como josiane'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Entrar na minha conta',exact:true})).toBeEnabled();
 await page.getByLabel('Senha',{exact:true}).fill('senha-ficticia-de-teste');
 await page.getByRole('button',{name:'Entrar na minha conta',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Atendimento simplificado'})).toBeVisible();
 expect(events.publicConfig).toBeGreaterThan(0);
 expect(events.login).toEqual([{username:'josiane',password:'senha-ficticia-de-teste'}]);
 expect(events.unknownTables).toEqual([]);
});
