import test from 'node:test';
import assert from 'node:assert/strict';
import {
 QUICK_ACTIONS,parseNoteSections,getConfirmedRequests,getConfirmedGuidance,buildQuickDocument
} from '../src/documentDrafts.js';

const NOTE=[
 'QUEIXA: DOR EM OMBRO DIREITO',
 'HDA: QUEDA DA PRÓPRIA ALTURA ONTEM',
 'EXAME FÍSICO: ADM LIMITADA PELA DOR. NEUROVASCULAR PRESERVADO',
 'RX / EXAMES: RX SEM FRATURA',
 'CONDUTA: SOLICITO RADIOGRAFIA + ORIENTO CRIOTERAPIA + INDICO TIPOIA SIMPLES'
].join('\n\n');

test('Atalhos imediatos incluem fisioterapia, documentos e conduta sem IA',()=>{
 assert.deepEqual(QUICK_ACTIONS.map(x=>x.id),[
  'receita','exames','laudo','encaminhamento','fisioterapia','orientacoes','atestado','declaracao','conduta'
 ]);
});
test('Extrai somente conteúdo com rótulos clínicos fornecidos',()=>{
 const p=parseNoteSections(NOTE);
 assert.equal(p.QUEIXA,'DOR EM OMBRO DIREITO');
 assert.match(p.EXAME,/ADM LIMITADA/);
 assert.equal(p.RX,'RX SEM FRATURA');
 assert.equal(parseNoteSections('PACIENTE COM DOR EM OMBRO').QUEIXA,undefined);
});
test('Receituário não contém medicamento, dosagem nem exame inventados',()=>{
 const doc=buildQuickDocument('receita',{clinicalText:NOTE});
 assert.match(doc,/MEDICAMENTO E APRESENTAÇÃO: \[PREENCHER\]/);
 assert.match(doc,/DOSE, VIA E INTERVALO: \[PREENCHER\]/);
 assert.doesNotMatch(doc,/CORTICOIDE|DIPIRONA|AMOXICILINA/i);
});
test('Pedido de exames extrai somente exames explicitamente SOLICITADOS, não laudos',()=>{
 const selected=getConfirmedRequests(NOTE);
 assert.deepEqual(selected,['SOLICITO RADIOGRAFIA']);
 const doc=buildQuickDocument('exames',{clinicalText:NOTE});
 assert.match(doc,/EXAME\(S\) SOLICITADO\(S\): SOLICITO RADIOGRAFIA/);
 assert.doesNotMatch(doc,/EXAME\(S\) SOLICITADO\(S\): RX SEM FRATURA/);
});
test('Orientações usam ações confirmadas sem transformar indicação de tipoia em ato realizado',()=>{
 assert.deepEqual(getConfirmedGuidance(NOTE),['ORIENTO CRIOTERAPIA']);
 const doc=buildQuickDocument('orientacoes',{clinicalText:NOTE});
 assert.match(doc,/ORIENTAÇÕES EFETIVAMENTE FORNECIDAS: ORIENTO CRIOTERAPIA/);
 assert.doesNotMatch(doc,/TIPOIA SIMPLES COLOCADA/);
});
test('Laudo e encaminhamento usam história e exame literalmente, sem diagnóstico presumido',()=>{
 for(const type of ['laudo','encaminhamento']){
  const doc=buildQuickDocument(type,{clinicalText:NOTE});
  assert.match(doc,/HISTÓRIA INFORMADA: QUEDA DA PRÓPRIA ALTURA ONTEM/);
  assert.match(doc,/EXAME FÍSICO REGISTRADO: ADM LIMITADA/);
  assert.match(doc,/EXAMES \/ RESULTADOS INFORMADOS: RX SEM FRATURA/);
  assert.doesNotMatch(doc,/RUPTURA CONFIRMADA|FRATURA CONFIRMADA/);
 }
 assert.match(buildQuickDocument('laudo',{clinicalText:NOTE}),/DIAGNÓSTICO CONFIRMADO \(SE HOUVER\): \[PREENCHER\]/);
});
test('Atestado nunca determina automaticamente tempo de afastamento nem CID',()=>{
 const doc=buildQuickDocument('atestado',{clinicalText:NOTE});
 assert.match(doc,/AFASTAMENTO E PERÍODO, SE INDICADOS: \[PREENCHER\]/);
 assert.match(doc,/CID APENAS SE CABÍVEL E AUTORIZADO: \[PREENCHER\]/);
 assert.doesNotMatch(doc,/90 DIAS|ATESTO QUE O\(A\) PACIENTE FOI AVALIADO/);
});
test('Vazio preserva campos não informados e campos são editáveis',()=>{
 assert.match(buildQuickDocument('encaminhamento'),/MOTIVO DO ENCAMINHAMENTO: \[PREENCHER\]/);
 assert.match(buildQuickDocument('orientacoes'),/ORIENTAÇÕES EFETIVAMENTE FORNECIDAS: \[PREENCHER\]/);
 assert.equal(buildQuickDocument('inexistente'),'');
});
test('Formato de preferência por caixa de texto continua disponível',()=>{
 const mixed=buildQuickDocument('receita',{caps:false});
 assert.match(mixed,/MEDICAMENTO E APRESENTAÇÃO/);
});


test('História clínica multilinha é incorporada ao laudo e encaminhamento',()=>{
 const evolution=[
  'QUEIXA: DOR EM JOELHO DIREITO',
  'HDA:',
  'PACIENTE RELATA QUEDA ONTEM.',
  'DIFICULDADE DE APOIO DESDE ENTÃO.',
  'EXAME FÍSICO:',
  'EDEMA LOCAL. ADM LIMITADA.',
  'RX / EXAMES: RADIOGRAFIA SEM FRATURA',
  'CONDUTA: ORIENTAÇÕES'
 ].join('\n');
 const parts=parseNoteSections(evolution);
 assert.equal(parts.HDA,'PACIENTE RELATA QUEDA ONTEM. DIFICULDADE DE APOIO DESDE ENTÃO.');
 assert.equal(parts.EXAME,'EDEMA LOCAL. ADM LIMITADA.');
 for(const type of ['laudo','encaminhamento']){
  const generated=buildQuickDocument(type,{clinicalText:evolution});
  assert.match(generated,/HISTÓRIA INFORMADA: PACIENTE RELATA QUEDA ONTEM\. DIFICULDADE DE APOIO DESDE ENTÃO\./);
  assert.match(generated,/EXAME FÍSICO REGISTRADO: EDEMA LOCAL\. ADM LIMITADA\./);
 }
});

test('Sem HDA classificada, usa apenas relato original identificado como não classificado',()=>{
 const doc=buildQuickDocument('laudo',{clinicalText:'QUEIXA: DOR NO JOELHO\n\nHDA:\n\nEXAME FÍSICO:',rawText:'Paciente fictício relata queda e dor no joelho direito há dois dias.'});
 assert.match(doc,/RELATO CLÍNICO NÃO CLASSIFICADO \(REVISAR\): PACIENTE FICTÍCIO RELATA QUEDA E DOR NO JOELHO DIREITO HÁ DOIS DIAS/);
 assert.match(doc,/DIAGNÓSTICO CONFIRMADO \(SE HOUVER\): \[PREENCHER\]/);
});

test('História clínica revisada tem prioridade sobre ditado bruto anterior',()=>{
 const clinical='QUEIXA: OMBRO\n\nHDA: QUEDA HOJE. DOR À ELEVAÇÃO.';
 const doc=buildQuickDocument('encaminhamento',{clinicalText:clinical,rawText:'HDA: paciente relata queda hoje'});
 assert.match(doc,/HISTÓRIA INFORMADA: QUEDA HOJE\. DOR À ELEVAÇÃO\./);
 assert.doesNotMatch(doc,/HISTÓRIA INFORMADA: PACIENTE RELATA QUEDA HOJE/);
});

test('Modelos mantêm HDA disponível mesmo quando o exame está vazio',()=>{
 const doc=buildQuickDocument('laudo',{clinicalText:'HDA:\nDor lombar há 10 dias\n\nEXAME FÍSICO:\n\nCONDUTA:'});
 assert.match(doc,/HISTÓRIA INFORMADA: DOR LOMBAR HÁ 10 DIAS/);
 assert.doesNotMatch(doc,/EXAME FÍSICO REGISTRADO: DOR LOMBAR/);
});

test('Propostas pré-geradas podem alimentar documentos sem fazer novas chamadas',async()=>{
 const {buildContextualDocument}=await import('../src/documentDrafts.js');
 const note='QUEIXA: DOR NO OMBRO\\nHDA: ENTORSE HÁ DOIS DIAS';
 const aiDocuments={laudo:'AVALIAÇÃO MÉDICA DE OMBRO A CONFIRMAR',fisioterapia:'CONSIDERAR REABILITAÇÃO',medicacao:'ANALGESIA A AVALIAR',afastamento:'AVALIAR INCAPACIDADE'};
 assert.match(buildContextualDocument('laudo',{clinicalText:note,aiDocuments}),/AVALIAÇÃO MÉDICA DE OMBRO A CONFIRMAR/);
 assert.match(buildContextualDocument('fisioterapia',{clinicalText:note,aiDocuments}),/CONSIDERAR REABILITAÇÃO/);
 assert.match(buildContextualDocument('receita',{clinicalText:note,aiDocuments}),/NÃO É PRESCRIÇÃO/);
 assert.match(buildContextualDocument('atestado',{clinicalText:note,aiDocuments}),/NÃO É ATESTADO/);
});
