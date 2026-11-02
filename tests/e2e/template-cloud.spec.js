import {test,expect} from '@playwright/test';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';

let harness;
const VERSION='00000000-0000-4000-8000-000000000001';
const NEXT_VERSION='00000000-0000-4000-8000-000000000002';
const template=title=>({id:'personal-first',title,category:'Consulta geral',body:'Registrar apenas informações obtidas.',kind:'documentation-checklist'});
const library=title=>({schema:1,kind:'documentation-checklists',templates:[template(title)]});
const serverRow=title=>({version:VERSION,library:library(title),updatedAt:'2026-11-02T12:00:00Z'});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};

test.beforeAll(async()=>{
  const entry=resolve(`.netlify/template-cloud-harness-${process.pid}.jsx`);
  await mkdir(resolve('.netlify'),{recursive:true});
  await writeFile(entry,`import React,{useState} from 'react';import{createRoot}from'react-dom/client';import TemplateCloudPanel from '../src/workspace/TemplateCloudPanel.jsx';function Harness(){const[templates,setTemplates]=useState([${JSON.stringify(template('Modelo local original'))}]);const[status,setStatus]=useState('');window.__editTemplates=title=>setTemplates(current=>current.map(item=>({...item,title})));return <><output data-testid="local-title">{templates[0]?.title}</output><p data-testid="operation-status">{status}</p><TemplateCloudPanel active demo={false} templates={templates} setTemplates={setTemplates} onStatus={setStatus}/></>;}createRoot(document.getElementById('root')).render(<Harness/>);`);
  try{
    const result=await build({configFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[react(),{
      name:'template-cloud-test-session',enforce:'pre',
      resolveId(id,importer){if(id==='../supabase.js'&&importer?.endsWith('/TemplateCloudPanel.jsx'))return '\0template-cloud-test-session';},
      load(id){if(id==='\0template-cloud-test-session')return `export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'test-token-only-not-a-real-credential'}}})}};`;}
    }],build:{write:false,lib:{entry,formats:['iife'],name:'TemplateCloudHarness'},minify:false}});
    harness=(Array.isArray(result)?result:[result]).flatMap(item=>item.output||[]).find(output=>output.type==='chunk').code;
  }finally{await rm(entry,{force:true});}
});
async function setup(page){
  await page.route('**/template-cloud-harness.js',route=>route.fulfill({contentType:'text/javascript; charset=utf-8',body:harness}));
  await page.route('**/template-cloud-test',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/template-cloud-harness.js"></script></body></html>'}));
  await page.route('**/api/personal-templates',route=>route.fulfill({json:serverRow('Modelo na nuvem')}));
  await page.goto('/template-cloud-test');
  await expect(page.getByRole('button',{name:'Salvar modelos na conta',exact:true})).toBeEnabled();
  await expect(page.getByTestId('local-title')).toHaveText('Modelo local original');
}
test('GET tardio não substitui modelos editados durante o carregamento',async({page})=>{
  await setup(page);
  const received=deferred(),release=deferred();
  await page.route('**/api/personal-templates',async route=>{received.resolve();await release.promise;await route.fulfill({json:serverRow('Nuvem em resposta tardia')});});
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Carregar da conta',exact:true}).click();
  await received.promise;
  await page.evaluate(()=>window.__editTemplates('Minha edição durante GET'));
  await expect(page.getByTestId('local-title')).toHaveText('Minha edição durante GET');
  release.resolve();
  await expect(page.getByRole('alert')).toContainText(/local.*mudou.*carregamento/i);
  await expect(page.getByTestId('local-title')).toHaveText('Minha edição durante GET');
});
test('PUT grava snapshot e avisa que novas alterações permanecem somente locais',async({page})=>{
  await setup(page);
  const received=deferred(),release=deferred();let submitted;
  await page.route('**/api/personal-templates',async route=>{
    submitted=route.request().postDataJSON();received.resolve();await release.promise;
    await route.fulfill({json:{version:NEXT_VERSION,library:submitted.library,updatedAt:'2026-11-02T12:01:00Z'}});
  });
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Salvar modelos na conta',exact:true}).click();
  await received.promise;
  expect(submitted.expectedVersion).toBe(VERSION);
  expect(submitted.library.templates[0].title).toBe('Modelo local original');
  await page.evaluate(()=>window.__editTemplates('Edição mais recente durante PUT'));
  release.resolve();
  await expect(page.getByTestId('operation-status')).toContainText(/alterações mais recentes somente nesta aba/i);
  await expect(page.getByTestId('local-title')).toHaveText('Edição mais recente durante PUT');
});
test('409 bloqueia nova gravação e mantém a biblioteca local',async({page})=>{
  await setup(page);
  await page.evaluate(()=>window.__editTemplates('Minha biblioteca que deve permanecer'));
  await page.route('**/api/personal-templates',route=>route.fulfill({status:409,json:{error:'Conflito de versão.',remote:serverRow('Outro aparelho')}}));
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Salvar modelos na conta',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText(/alterados em outro aparelho/i);
  await expect(page.getByRole('button',{name:'Salvar modelos na conta',exact:true})).toBeDisabled();
  await expect(page.getByTestId('local-title')).toHaveText('Minha biblioteca que deve permanecer');
});
