import test from 'node:test';
import assert from 'node:assert/strict';
import {HDA_REGIONS,getHdaGroups,getConfirmedHdaDetails,insertHdaDetails} from '../src/hdaTemplates.js';
import {formatNarrative} from '../src/quickDraft.js';

test('HDA: modelos de joelho, ombro e tornozelo',()=>{
 assert.deepEqual(HDA_REGIONS.map(x=>x.id),['joelho','ombro','tornozelo']);
 for(const region of HDA_REGIONS)assert.equal(getHdaGroups(region.id).length,4);
 assert.equal(getHdaGroups('quadril'),null);
});
test('Não cria informações não confirmadas',()=>{
 for(const region of HDA_REGIONS){
  assert.deepEqual(getConfirmedHdaDetails(region.id,{},'', 'dias',''),[]);
 }
 assert.equal(insertHdaDetails('HDA:',[]),'HDA:');
});
test('Rejeita opções inválidas sem gerar diagnósticos',()=>{
 assert.deepEqual(getConfirmedHdaDetails('joelho',{mecanismo:'FRATURA CONFIRMADA'}),[]);
 assert.deepEqual(getConfirmedHdaDetails('ombro',{mecanismo:'TESTE NEGATIVO NÃO AVALIADO'}),[]);
});
test('Tempo, lado e informações confirmadas são combinados, sem outras inferências',()=>{
 const snippets=getConfirmedHdaDetails('ombro',{
  mecanismo:'TRAUMA DIRETO NO OMBRO',limitacao:'DIFICULDADE PARA ELEVAR O MEMBRO'
 },'3','dias','DIREITO');
 assert.deepEqual(snippets,[
  'HÁ 3 DIAS','LADO DIREITO','TRAUMA DIRETO NO OMBRO','DIFICULDADE PARA ELEVAR O MEMBRO'
 ]);
 assert.ok(!snippets.join(' ').includes('NEUROVASCULAR PRESERVADO'));
});
test('Tempo inválido não entra na história',()=>{
 assert.deepEqual(getConfirmedHdaDetails('joelho',{},'-1','dias',''),[]);
 assert.deepEqual(getConfirmedHdaDetails('joelho',{},'3.5','dias',''),[]);
 assert.deepEqual(getConfirmedHdaDetails('joelho',{},'7','séculos',''),[]);
});
test('Acrescenta dados à HDA preservando exame físico e conduta',()=>{
 const input=formatNarrative('HDA: PACIENTE RELATA DOR EM OMBRO\nEXAME FÍSICO: ADM LIMITADA PELA DOR\nCD: RX');
 const output=insertHdaDetails(input,['DOR NOTURNA','DIFICULDADE PARA ELEVAR O MEMBRO']);
 assert.match(output,/HDA: PACIENTE RELATA DOR EM OMBRO\. DOR NOTURNA; DIFICULDADE PARA ELEVAR O MEMBRO\./);
 assert.match(output,/EXAME FÍSICO: ADM LIMITADA PELA DOR/);
 assert.match(output,/CONDUTA: RX/);
});
test('Duplicação literal de dados não se repete na HDA',()=>{
 const initial='HDA: DOR NOTURNA.';
 const again=insertHdaDetails(initial,['DOR NOTURNA']);
 assert.equal(again,initial);
});
