import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFinalPackage} from '../src/consultationPackage.js';
import {buildReviewedPackage,documentBlockers,medicationReady,reviewedPackageAsText} from '../src/documentSafety.js';

test('campos pendentes bloqueiam a cópia mesmo após marcar revisão',()=>{
 const [section]=buildFinalPackage({documents:{laudo:'LAUDO: [PREENCHER diagnóstico].'}});
 assert.match(documentBlockers(section,{reviewed:{laudo:true}}).join(' '),/campo/i);
});

test('medicação exige via, três confirmações e checagem extra se injetável',()=>{
 const base={checks:{clinical:true,structure:true,destination:true}};
 assert.equal(medicationReady({...base,route:''}),false);
 assert.equal(medicationReady({...base,route:'oral'}),true);
 assert.equal(medicationReady({...base,route:'intramuscular'}),false);
 assert.equal(medicationReady({route:'intramuscular',checks:{...base.checks,injectable:true}}),true);
});

test('pacote inclui somente documentos explicitamente revisados e liberados',()=>{
 const input={narrative:'Evolução conferida.',documents:{orientacoes:'Retorno se piora.',laudo:'[PREENCHER].'}};
 const state={reviewed:{evolucao:true,orientacoes:false,laudo:true}};
 assert.deepEqual(buildReviewedPackage(input,state).map(item=>item.id),['evolucao']);
});

test('medicação copiada continua identificada como rascunho e registra a via conferida',()=>{
 const input={documents:{medicacao:'Medicamento fictício 1 comprimido uma vez ao dia por 2 dias.'}};
 const text='Medicamento fictício 1 comprimido uma vez ao dia por 2 dias.';
 const state={reviewed:{medicacao:true},medication:{source:text,route:'oral',checks:{clinical:true,structure:true,destination:true}}};
 const output=reviewedPackageAsText(input,state);
 assert.match(output,/NÃO É RECEITA EMITIDA/);
 assert.match(output,/VIA CONFERIDA PELO MÉDICO: Via oral/);
});
