import test from 'node:test';
import assert from 'node:assert/strict';
import {identifyComplaint,COMPLAINTS,KNEE_GROUPS,confirmedKneeFindings} from '../src/complaintSuggestions.js';

test('reconhece joelho em escrita livre e maiúsculas sem IA',()=>{
 assert.equal(identifyComplaint('Paciente relata trauma torcional em joelho direito').id,'joelho');
 assert.equal(identifyComplaint('GONALGIA DIREITA HÁ 3 MESES').id,'joelho');
 assert.equal(identifyComplaint('PACIENTE COM DOR EM OMBRO DIREITO').id,'ombro');
});
test('catálogo cobre dez queixas dos exemplos originais',()=>{
 assert.equal(COMPLAINTS.length,10);
 for(const id of ['joelho','ombro','mao','dedo','tornozelo','pe','punho','cotovelo','quadril','coluna']){
  assert.ok(COMPLAINTS.some(item=>item.id===id));
 }
});
test('nenhum exame normal é preenchido sem confirmação',()=>{
 assert.deepEqual(confirmedKneeFindings({}),[]);
 assert.deepEqual(confirmedKneeFindings({derrame:null,nv:''}),[]);
});
test('registra apenas resultados explicitamente escolhidos pelo médico',()=>{
 assert.deepEqual(confirmedKneeFindings({derrame:'SEM DERRAME ARTICULAR',nv:'NEUROVASCULAR PRESERVADO'}),
 ['SEM DERRAME ARTICULAR','NEUROVASCULAR PRESERVADO']);
});
test('recusa respostas não cadastradas, sem permitir preenchimento arbitrário',()=>{
 assert.deepEqual(confirmedKneeFindings({derrame:'SEM DERRAME E SEM HEMATOMA',nv:'NORMAL'}),[]);
 assert.equal(KNEE_GROUPS.length,10);
});
