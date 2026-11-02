import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpoint,restoredRevision,MAX_REVISIONS} from '../src/workspace/revisions.js';
import {emptyConsultation,canExport,parseConsultation} from '../src/workspace/model.js';
test('ponto anterior é independente, limitado e restauração exige nova revisão',()=>{
 const doc={...emptyConsultation(),source:'Relato fictício original',summary:'Resumo',generatedFrom:'Relato fictício original',reviewed:true};
 const h=checkpoint([],doc,'Antes da IA');doc.soap.subjective='Edição posterior';
 assert.equal(h[0].doc.soap.subjective,'');assert.equal(canExport(restoredRevision(h[0])),false);
 let revisions=h;for(let i=0;i<12;i++)revisions=checkpoint(revisions,{...doc,source:'Versão '+i},'Antes de editar');
 assert.equal(revisions.length,MAX_REVISIONS);assert.equal(revisions[0].doc.source,'Versão 11');
});
test('não acumula revisões vazias ou duplicadas',()=>{
 assert.deepEqual(checkpoint([],emptyConsultation(),'Vazio'),[]);
 const doc={...emptyConsultation(),source:'Caso inventado'};
 const history=checkpoint([],doc,'Antes');assert.equal(checkpoint(history,doc,'De novo'),history);
});
test('payload muito grande em UTF-8 é recusado, sem truncamento',()=>{
 const doc={...emptyConsultation(),source:'字'.repeat(6000),generatedFrom:'字'.repeat(6000),summary:'字'.repeat(8000),pending:'字'.repeat(8000),soap:{subjective:'字'.repeat(8000),objective:'字'.repeat(8000),assessment:'字'.repeat(8000),plan:'字'.repeat(8000)}};
 assert.throws(()=>parseConsultation(doc),/limite|excede/i);
});
