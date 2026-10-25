import test from 'node:test';
import assert from 'node:assert/strict';
import {getFindingGroups,confirmedRegionFindings,SHOULDER_GROUPS,ANKLE_GROUPS,KNEE_EXTENDED_GROUPS} from '../src/complaintSuggestions.js';
import {insertConfirmedExam} from '../src/quickDraft.js';

test('joelho, ombro e tornozelo possuem grupos estruturados por achado',()=>{
  assert.equal(KNEE_EXTENDED_GROUPS.length,15);
  assert.equal(SHOULDER_GROUPS.length,10);
  assert.equal(ANKLE_GROUPS.length,12);
  assert.equal(getFindingGroups('joelho'),KNEE_EXTENDED_GROUPS);
  assert.equal(getFindingGroups('ombro'),SHOULDER_GROUPS);
  assert.equal(getFindingGroups('tornozelo'),ANKLE_GROUPS);
  assert.equal(getFindingGroups('quadril'),null);
});

test('nenhum modelo presume achados normais',()=>{
  for(const region of ['joelho','ombro','tornozelo']){
    assert.deepEqual(confirmedRegionFindings(region,{}),[]);
    assert.deepEqual(confirmedRegionFindings(region,{edema:null,nv:''}),[]);
  }
});

test('ombro: só incorpora Neer positivo após seleção explícita',()=>{
 const selected=confirmedRegionFindings('ombro',{neer:'TESTE DE NEER POSITIVO',hawkins:null});
 assert.deepEqual(selected,['TESTE DE NEER POSITIVO']);
 assert.ok(!selected.join(' ').includes('HAWKINS'));
});

test('tornozelo: Thompson preserva a descrição observada, sem presumir diagnóstico',()=>{
 const selected=confirmedRegionFindings('tornozelo',{thompson:'AUSÊNCIA DE FLEXÃO PLANTAR À COMPRESSÃO DO TRÍCEPS SURAL'});
 assert.deepEqual(selected,['AUSÊNCIA DE FLEXÃO PLANTAR À COMPRESSÃO DO TRÍCEPS SURAL']);
 assert.ok(!selected.join(' ').includes('RUPTURA'));
});

test('joelho: testes especiais não são preenchidos pelo simples reconhecimento da queixa',()=>{
 const selected=confirmedRegionFindings('joelho',{mcmurray:'TESTE DE MCMURRAY NEGATIVO'});
 assert.deepEqual(selected,['TESTE DE MCMURRAY NEGATIVO']);
});

test('opções externas, incluindo positivo e negativo para mesmo teste, não são admitidas',()=>{
 assert.deepEqual(confirmedRegionFindings('ombro',{neer:'TESTE DE NEER POSITIVO; TESTE DE NEER NEGATIVO'}),[]);
 assert.deepEqual(confirmedRegionFindings('tornozelo',{gaveta:'GAVETA ANTERIOR POSITIVA OU NEGATIVA'}),[]);
});

test('achados selecionados entram apenas na seção exame físico da evolução',()=>{
 const before='QUEIXA: DOR EM OMBRO\n\nHDA: QUEDA ONTEM\n\nEXAME FÍSICO:\n\nCONDUTA: SOLICITO RADIOGRAFIA';
 const findings=confirmedRegionFindings('ombro',{hawkins:'TESTE DE HAWKINS POSITIVO'});
 const result=insertConfirmedExam(before,findings);
 assert.match(result,/EXAME FÍSICO: TESTE DE HAWKINS POSITIVO\./);
 assert.match(result,/CONDUTA: SOLICITO RADIOGRAFIA/);
 assert.doesNotMatch(result,/TESTE DE JOBE/);
});
