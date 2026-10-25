import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyNote,formatNarrative,insertConfirmedExam} from '../src/quickDraft.js';
import {REGIONS,DOCUMENT_TYPES,buildDocument} from '../src/clinicalLibrary.js';

test('Novo marco zero: exemplo de joelho com texto narrativo sem SOAP',()=>{
  const input='# DOR EM JOELHO\nPACIENTE COM TRAUMA TORCIONAL EM JOELHO DIREITO\nDOR À PALPAÇÃO, SEM DERRAME ARTICULAR\nRX: SEM SINAIS DE FRATURA\nCD: ANALGESIA + IMOBILIZAÇÃO';
  const result=formatNarrative(input,{caps:true});
  assert.match(result,/QUEIXA: DOR EM JOELHO/);
  assert.match(result,/HDA: PACIENTE COM TRAUMA TORCIONAL/);
  assert.match(result,/EXAME FÍSICO: DOR À PALPAÇÃO/);
  assert.match(result,/RX \/ EXAMES: SEM SINAIS DE FRATURA/);
  assert.match(result,/CONDUTA: ANALGESIA/);
  assert.doesNotMatch(result,/SOAP/);
});

test('Ditado fictício livre não inventa dados do exame ou conduta',()=>{
  const result=formatNarrative('Paciente relata dor em joelho há 3 meses.');
  assert.match(result,/HDA: PACIENTE RELATA DOR/);
  assert.match(result,/EXAME FÍSICO:\n\nCONDUTA:/);
  assert.doesNotMatch(result,/NV PRESERVADO|SEM EDEMA|ANALGESIA/);
});

test('Exame físico opcional só incorpora achados confirmados',()=>{
  const before='QUEIXA: DOR EM JOELHO\n\nHDA: ENTORSE\n\nEXAME FÍSICO:\n\nCONDUTA: ANALGESIA';
  const result=insertConfirmedExam(before,['NV PRESERVADO','BOA PERFUSÃO DISTAL']);
  assert.match(result,/EXAME FÍSICO: NV PRESERVADO; BOA PERFUSÃO DISTAL\./);
  assert.match(result,/CONDUTA: ANALGESIA/);
  assert.doesNotMatch(result,/SEM EDEMA/);
});

test('Exame físico já preenchido mantém achado informado e não duplica',()=>{
  const before='EXAME FÍSICO: ADM LIMITADA PELA DOR\n\nCONDUTA: ALTA';
  const result=insertConfirmedExam(before,['ADM LIMITADA PELA DOR','NEUROVASCULAR PRESERVADO']);
  assert.equal((result.match(/ADM LIMITADA PELA DOR/g)||[]).length,1);
  assert.match(result,/NEUROVASCULAR PRESERVADO/);
  assert.match(result,/CONDUTA: ALTA/);
});

test('Trechos ambíguos permanecem identificados sem classificação',()=>{
  const r=classifyNote('Talvez retorno depois.\nInformação clínica não especificada.');
  assert.equal(r.unmatched.length,2);
  assert.equal(r.sections.CONDUTA.length,0);
});

test('Textos preservam números e negativas',()=>{
  const result=formatNarrative('HDA: PACIENTE NEGA FEBRE.\nEXAME FÍSICO: PA 120/80 MMHG.\nCONDUTA: TOMAR 5 MG CONFORME PRESCRIÇÃO.');
  assert.match(result,/NEGA FEBRE/);
  assert.match(result,/120\/80 MMHG/);
  assert.match(result,/5 MG/);
});

test('Biblioteca de documentos contém modelos editáveis, nunca preenchidos automaticamente',()=>{
  assert.ok(REGIONS.length>=8);
  for(const doc of DOCUMENT_TYPES){
    const body=buildDocument(doc.id);
    assert.ok(body.includes('RASCUNHO'));
    assert.ok(body.includes('[PREENCHER]')||body.includes('[IDENTIFICAÇÃO'));
  }
});
