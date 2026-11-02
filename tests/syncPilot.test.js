import test from 'node:test';
import assert from 'node:assert/strict';
import {ConsultationSync} from '../src/workspace/sync.js';
import {emptyConsultation} from '../src/workspace/model.js';
const row=v=>({version:v,payload:{...emptyConsultation(),source:'Relato remoto'},expires_at:'2030-01-01'});
test('áudio pendente impede aplicação automática de outra versão remota',async()=>{
 let doc=emptyConsultation(),remote=row('first'),state,editing=false;
 const c=new ConsultationSync({store:{read:async()=>remote},getLocal:()=>doc,applyRemote:v=>{doc=v},isEditing:()=>editing,onState:s=>{state=s}});
 await c.connect();editing=true;remote=row('second');await c.tick();assert.equal(state.phase,'conflict');assert.equal(c.version,'first');
 assert.equal(c.detach(),true);assert.equal(state.phase,'disabled');assert.equal(doc.source,'Relato remoto');
});
test('pausa não promete interrupção de uma gravação que já está em voo',async()=>{
 let release;const c=new ConsultationSync({store:{read:()=>new Promise(r=>{release=r})},getLocal:emptyConsultation,applyRemote:()=>{},onState:()=>{}});
 const waiting=c.connect();assert.equal(c.detach(),false);release(null);await waiting;assert.equal(c.detach(),true);assert.equal(c.active,false);
});
