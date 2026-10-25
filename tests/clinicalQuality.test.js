import test from 'node:test';
import assert from 'node:assert/strict';
import {clinicalSections,reviewClinicalEvolution} from '../netlify/lib/clinical-quality.mjs';
import {validateClinicalBundle} from '../netlify/lib/ai-note.mjs';

const CASE='QUEIXA: DOR EM JOELHO DIREITO\nHDA: PACIENTE FICTÍCIO RELATA ENTORSE HÁ 3 DIAS, NEGA FEBRE.\nEXAME FÍSICO: DOR À PALPAÇÃO MEDIAL.\nCONDUTA: SOLICITADA RADIOGRAFIA.';
function response(evolution){
 return {status:'completed',output_text:JSON.stringify({
  evolucao:evolution,hipoteses:'LESÃO A CONSIDERAR',tratamento:'AVALIAR CONDUTAS',
  laudo:'',fisioterapia:'',medicacao:'',afastamento:'',orientacoes:'',
  encaminhamento:'',exames:'',pendencias:'CONFIRMAR'
 })};
}

test('A evolução prioriza HDA e não aceita se estiver em branco',()=>{
 assert.equal(reviewClinicalEvolution(CASE,CASE).ok,true);
 const broken='QUEIXA: DOR NO JOELHO\nHDA:\nEXAME FÍSICO: EDEMA\nCONDUTA: AVALIADO';
 assert.equal(reviewClinicalEvolution(broken,CASE).ok,false);
 const result=validateClinicalBundle(response(broken),CASE);
 assert.equal(result.ok,false);
 assert.match(result.message,/HDA/);
});

test('Lê HDA em várias linhas, exame e conduta sem confundir os campos',()=>{
 const sections=clinicalSections('QUEIXA: JOELHO\n\nHDA:\nENTORSE HÁ 2 DIAS.\nDOR PROGRESSIVA.\n\nEXAME FÍSICO:\nEDEMA OBSERVADO.\n\nCONDUTA:\nAVALIAÇÃO.');
 assert.match(sections.HDA,/ENTORSE HÁ 2 DIAS\. DOR PROGRESSIVA/);
 assert.equal(sections['EXAME FÍSICO'],'EDEMA OBSERVADO.');
});

test('Avisa se a lateralidade mudou ou desapareceu sem inventar correção',()=>{
 const swapped=CASE.replaceAll('DIREITO','ESQUERDO');
 const review=reviewClinicalEvolution(swapped,CASE);
 assert.equal(review.ok,true);
 assert.ok(review.warnings.some(v=>v.includes('lateralidade')||v.includes('Lateralidade')));
});

test('Avisa se houve omissão de dose expressa e negativa informada',()=>{
 const source=CASE+'\nCONDUTA: ADMINISTRADOS 5 MG CONFORME REGISTRO';
 const result=validateClinicalBundle(response('QUEIXA: JOELHO DIREITO\nHDA: ENTORSE HÁ 3 DIAS\nEXAME FÍSICO: DOR MEDIAL\nCONDUTA:'),source);
 assert.equal(result.ok,true);
 assert.ok(result.warnings.some(v=>v.includes('5 MG')));
 assert.ok(result.warnings.some(v=>v.includes('NEGA FEBRE')));
});

test('Respostas estruturalmente válidas mas sem história não geram documentos',()=>{
 const bad=response('QUEIXA: DOR\nHDA: [PREENCHER]\nEXAME FÍSICO:\nCONDUTA:');
 assert.equal(validateClinicalBundle(bad,CASE).ok,false);
});

test('Não aprova resposta que não contenha exame físico ou conduta como seção',()=>{
 assert.equal(reviewClinicalEvolution('QUEIXA: DOR\nHDA: PACIENTE FICTÍCIO RELATA TRAUMA HÁ DOIS DIAS',CASE).ok,false);
});

test('Avisa sobre dose de IA, afastamento com dias e CID sem suporte no relato',()=>{
 const body=response(CASE);
 const obj=JSON.parse(body.output_text);
 obj.medicacao='POSSIBILIDADE DE USAR 50 MG, A REVISAR';
 obj.afastamento='SUGERE 15 DIAS, SUJEITO A AVALIAÇÃO';
 obj.laudo='CID M25.5 CONFIRMADO';
 const result=validateClinicalBundle({status:'completed',output_text:JSON.stringify(obj)},CASE);
 assert.equal(result.ok,true);
 assert.ok(result.warnings.some(v=>v.includes('medicação')));
 assert.ok(result.warnings.some(v=>v.includes('afastamento')));
 assert.ok(result.warnings.some(v=>v.includes('CID')));
});
test('Não altera automaticamente doses ou lateralidade quando detecta alerta',()=>{
 const source=CASE+'\nCONDUTA: RELATA USO DE 5 MG';
 const altered=CASE.replace('JOELHO DIREITO','JOELHO ESQUERDO');
 const b=response(altered);
 const result=validateClinicalBundle(b,source);
 assert.equal(result.ok,true);
 assert.equal(result.text,altered);
 assert.ok(result.warnings.length>0);
});

test('HDA vazia ou com negação genérica de informação é bloqueada antes de aplicar',()=>{
 const source='HDA: QUEDA DA PRÓPRIA ALTURA HÁ 3 DIAS. DOR EM TORNOZELO.';
 for(const value of ['NÃO INFORMADO','SEM DADOS','[PREENCHER]','A CONFIRMAR']){
  const text='QUEIXA: TORNOZELO\nHDA: '+value+'\nEXAME FÍSICO:\nCONDUTA:';
  const result=reviewClinicalEvolution(text,source);
  assert.equal(result.ok,false);
 }
});
test('Duração omitida da HDA dispara aviso sem inventar correção',()=>{
 const source='PACIENTE FICTÍCIO RELATA DOR EM JOELHO HÁ 12 DIAS.';
 const report='QUEIXA: DOR EM JOELHO\nHDA: PACIENTE RELATA DOR EM JOELHO.\nEXAME FÍSICO:\nCONDUTA:';
 const result=reviewClinicalEvolution(report,source);
 assert.equal(result.ok,true);
 assert.ok(result.warnings.some(x=>x.includes('12 DIAS')));
});
test('Negativa nova no resultado é sinalizada para revisão',()=>{
 const source='DOR EM JOELHO ESQUERDO APÓS ENTORSE';
 const report='QUEIXA: DOR NO JOELHO ESQUERDO\nHDA: ENTORSE COM DOR PROGRESSIVA.\nEXAME FÍSICO: SEM FEBRE.\nCONDUTA:';
 const result=reviewClinicalEvolution(report,source);
 assert.equal(result.ok,true);
 assert.ok(result.warnings.some(x=>x.includes('SEM FEBRE')));
});
