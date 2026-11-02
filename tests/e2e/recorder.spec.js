import {test,expect} from '@playwright/test';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';

let harness;
test.beforeAll(async()=>{
  const entry=resolve(`.netlify/recorder-harness-${process.pid}.jsx`);
  await mkdir(resolve('.netlify'),{recursive:true});
  await writeFile(entry,`import React from 'react';import{createRoot}from'react-dom/client';import GroqRecorder from '../src/GroqRecorder.jsx';const root=createRoot(document.getElementById('root'));window.__unmountRecorder=()=>root.unmount();root.render(<GroqRecorder onInsertTranscript={text=>{window.__inserted=text}}/>);`);
  try{
    const result=await build({configFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('production')},plugins:[react(),{
      name:'recorder-test-session',enforce:'pre',
      resolveId(id,importer){if(id==='./supabase.js'&&importer?.endsWith('/GroqRecorder.jsx'))return '\0recorder-test-session';},
      load(id){if(id==='\0recorder-test-session')return `export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'test-token-only-not-a-real-credential'}}})}};`;}
    }],build:{write:false,lib:{entry,formats:['iife'],name:'RecorderHarness'},minify:false}});
    harness=(Array.isArray(result)?result:[result]).flatMap(item=>item.output||[]).find(output=>output.type==='chunk').code;
  }finally{await rm(entry,{force:true});}
});
async function setup(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.__mediaCalls=0;window.__tracksStopped=0;window.__pendingPermissions=[];window.__rejectPermissions=[];window.__transcriptionAborted=false;
    const fakeStream=()=>({getTracks:()=>[{stop:()=>{window.__tracksStopped++}}]});
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>{window.__mediaCalls++;return new Promise((resolve,reject)=>{window.__pendingPermissions.push(()=>resolve(fakeStream()));window.__rejectPermissions.push(reject);});}}});
    window.MediaRecorder=class{
      static isTypeSupported(){return true;}
      constructor(input,options){this.state='inactive';this.mimeType=options?.mimeType||'audio/webm';window.__recorder=this;}
      start(){this.state='recording';}
      stop(){if(this.state==='inactive')return;this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['a'.repeat(3000)],{type:this.mimeType})});this.onstop?.();});}
    };
    const originalFetch=window.fetch;
    window.fetch=(url,options)=>{if(String(url).includes('/api/free-transcription'))options.signal.addEventListener('abort',()=>{window.__transcriptionAborted=true});return originalFetch(url,options);};
  });
  await page.route('**/recorder-harness.js',route=>route.fulfill({contentType:'text/javascript; charset=utf-8',body:harness}));
  await page.route('**/recorder-test',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/recorder-harness.js"></script></body></html>'}));
  await page.goto('/recorder-test');
  if(errors.length)throw Error('Harness error: '+errors.join('; '));
  await page.getByLabel('Autorizo apenas áudio inventado.').check();
}
async function makeRecording(page){
  await page.getByRole('button',{name:'Gravar',exact:true}).click();
  await page.evaluate(()=>window.__pendingPermissions[0]());
  await page.getByRole('button',{name:/Parar \(/}).click();
  await expect(page.getByRole('button',{name:'Transcrever com IA',exact:true})).toBeEnabled();
}
test('duplo clique não abre duas permissões e uma permissão tardia libera tracks',async({page})=>{
  await setup(page);
  await page.getByRole('button',{name:'Gravar',exact:true}).click({clickCount:2});
  await expect.poll(()=>page.evaluate(()=>window.__mediaCalls)).toBe(1);
  await expect(page.getByRole('button',{name:'Aguardando microfone…',exact:true})).toBeDisabled();
  await page.evaluate(()=>window.__unmountRecorder());
  await page.evaluate(()=>window.__pendingPermissions[0]());
  await expect.poll(()=>page.evaluate(()=>window.__tracksStopped)).toBe(1);
});
test('cancelar permissão não inicia gravação quando o navegador responde depois',async({page})=>{
  await setup(page);await page.getByRole('button',{name:'Gravar',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar solicitação'}).click();
  await page.evaluate(()=>window.__pendingPermissions[0]());
  await expect.poll(()=>page.evaluate(()=>window.__tracksStopped)).toBe(1);
  await expect(page.getByRole('button',{name:'Gravar',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:/Parar \(/})).toHaveCount(0);
});
test('sair do componente cancela transcrição em trânsito',async({page})=>{
  await setup(page);await makeRecording(page);
  let release;
  const pending=new Promise(resolve=>{release=resolve});
  await page.route('**/api/free-transcription',async route=>{await pending;await route.fulfill({json:{text:'Resposta tardia fictícia.'}}).catch(()=>{});});
  await page.getByRole('button',{name:'Transcrever com IA',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cancelar transcrição'})).toBeVisible();
  await page.evaluate(()=>window.__unmountRecorder());
  await expect.poll(()=>page.evaluate(()=>window.__transcriptionAborted)).toBe(true);
  release();
  expect(await page.evaluate(()=>window.__inserted)).toBeUndefined();
});
test('resposta inválida preserva áudio e não libera inserção',async({page})=>{
  await setup(page);await makeRecording(page);
  await page.route('**/api/free-transcription',route=>route.fulfill({json:{text:123,qualityWarnings:[]}}));
  await page.getByRole('button',{name:'Transcrever com IA',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('A transcrição recebida é inválida');
  await expect(page.getByLabel('Reproduzir áudio gravado')).toBeVisible();
  await expect(page.getByRole('button',{name:'Inserir no relato',exact:true})).toHaveCount(0);
});

test('negação tardia de permissão anterior não encerra a gravação nova',async({page})=>{
  await setup(page);await page.getByRole('button',{name:'Gravar',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar solicitação'}).click();
  await page.getByRole('button',{name:'Gravar',exact:true}).click();
  await page.evaluate(()=>window.__pendingPermissions[1]());
  await expect(page.getByRole('button',{name:/Parar \(/})).toBeVisible();
  await page.evaluate(()=>window.__rejectPermissions[0](new Error('permissão antiga negada')));
  await expect.poll(()=>page.evaluate(()=>window.__tracksStopped)).toBe(0);
  await page.getByRole('button',{name:/Parar \(/}).click();
  await expect(page.getByRole('button',{name:'Transcrever com IA',exact:true})).toBeEnabled();
});
