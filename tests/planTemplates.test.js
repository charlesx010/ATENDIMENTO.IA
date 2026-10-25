import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAN_REGIONS,getPlanGroups,confirmedPlanPhrases,insertPlanDetails} from '../src/planTemplates.js';

test('Biblioteca de condutas: joelho, ombro e tornozelo',()=>{
 assert.deepEqual(PLAN_REGIONS.map(x=>x.id),['joelho','ombro','tornozelo']);
 for(const r of PLAN_REGIONS)assert.equal(getPlanGroups(r.id).length,6);
 assert.equal(getPlanGroups('quadril'),null);
});
test('Nenhuma opção entra na evolução sem decisão explícita',()=>{
 for(const r of PLAN_REGIONS)assert.deepEqual(confirmedPlanPhrases(r.id,{}),[]);
 assert.equal(insertPlanDetails('CONDUTA: ',[]),'CONDUTA: ');
});
test('Valida apenas ações reconhecidas e selecionadas; medicamentos/doses não são sugeridos',()=>{
 assert.deepEqual(confirmedPlanPhrases('ombro',{analgesia:'DOSE DE MEDICAMENTO AUTOMÁTICA'}),[]);
 assert.deepEqual(confirmedPlanPhrases('joelho',{destino:'ALTA AUTOMÁTICA'}),[]);
 assert.deepEqual(confirmedPlanPhrases('tornozelo',{exames:['EXAME INVENTADO']}),[]);
});
test('Permite várias solicitações e orientações sem implicar execução',()=>{
 const selected=confirmedPlanPhrases('ombro',{
  analgesia:'PRESCREVO ANALGESIA',
  exames:['SOLICITO RADIOGRAFIA','SOLICITO RESSONÂNCIA MAGNÉTICA'],
  imobilizacao:'INDICO TIPOIA SIMPLES',
  orientacoes:['ORIENTO CRIOTERAPIA','FORNEÇO ORIENTAÇÕES GERAIS']
 });
 assert.deepEqual(selected,[
  'PRESCREVO ANALGESIA','SOLICITO RADIOGRAFIA','SOLICITO RESSONÂNCIA MAGNÉTICA',
  'INDICO TIPOIA SIMPLES','ORIENTO CRIOTERAPIA','FORNEÇO ORIENTAÇÕES GERAIS'
 ]);
});
test('Selecionar uma imobilização não registra as outras opções do mesmo grupo',()=>{
 const selected=confirmedPlanPhrases('joelho',{imobilizacao:'INDICO IMOBILIZAÇÃO DE JONES'});
 assert.deepEqual(selected,['INDICO IMOBILIZAÇÃO DE JONES']);
 assert.ok(!selected.includes('REALIZADA IMOBILIZAÇÃO DE JONES'));
});
test('Insere no campo Conduta sem apagar Queixa, HDA ou Exame Físico',()=>{
 const before='QUEIXA: OMBRO\n\nHDA: TRAUMA DIRETO\n\nEXAME FÍSICO: ADM LIMITADA\n\nCONDUTA: ANALGESIA';
 const after=insertPlanDetails(before,['INDICO TIPOIA SIMPLES','SOLICITO RADIOGRAFIA']);
 assert.match(after,/HDA: TRAUMA DIRETO\n\nEXAME FÍSICO: ADM LIMITADA/);
 assert.match(after,/CONDUTA: ANALGESIA \+ INDICO TIPOIA SIMPLES \+ SOLICITO RADIOGRAFIA/);
});
test('Não duplica ação idêntica e também reconhece CD',()=>{
 assert.equal(insertPlanDetails('CD: PRESCREVO ANALGESIA',['PRESCREVO ANALGESIA']),'CD: PRESCREVO ANALGESIA');
 assert.equal(insertPlanDetails('CD:',['INDICO TIPOIA SIMPLES']),'CD: INDICO TIPOIA SIMPLES');
});
test('Ações repetidas na mesma seleção são inseridas apenas uma vez',()=>{
 assert.equal(insertPlanDetails('CONDUTA:',['SOLICITO RADIOGRAFIA','SOLICITO RADIOGRAFIA']),
 'CONDUTA: SOLICITO RADIOGRAFIA');
});
