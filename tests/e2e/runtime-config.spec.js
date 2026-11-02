import {test,expect} from '@playwright/test';
const anon=['e30',Buffer.from(JSON.stringify({role:'anon'})).toString('base64url'),'test-only'].join('.');
test('login é habilitado por configuração pública das Functions mesmo sem VITE no build',async({page})=>{
 await page.route('**/api/public-config',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({configured:true,supabase:{url:'https://runtime-example.supabase.co',anonKey:anon},loginReady:true})}));
 await page.goto('/josiane');await expect(page.getByRole('heading',{name:'Entrar como josiane'})).toBeVisible();await expect(page.getByRole('button',{name:'Entrar na minha conta',exact:true})).toBeEnabled();
});
test('configuração inexistente não impede os modos clássicos da demonstração',async({page})=>{
 await page.route('**/api/public-config',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({configured:false,supabase:null})}));
 await page.goto('/demo');await expect(page.getByRole('button',{name:'Simplificado',exact:true})).toBeVisible();await page.getByRole('button',{name:'Completo',exact:true}).click();await expect(page.getByRole('button',{name:'Simplificado',exact:true})).toBeVisible();
});
