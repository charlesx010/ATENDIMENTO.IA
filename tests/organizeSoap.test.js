import test from 'node:test';
import assert from 'node:assert/strict';
import { organizeNotesToSoap, formatOrganizedSoap } from '../src/organizeSoap.js';

test('Fala fictícia com queixa e limitação vai apenas para subjetivo',()=>{
  const text='DITADO DO NAVEGADOR (REVISAR):\nPaciente com dor no joelho direito há três meses, sem histórico de trauma recente. Apresenta dificuldade para caminhar.';
  const result=organizeNotesToSoap(text);
  assert.equal(result.sections.subjective.length,2);
  assert.deepEqual(result.sections.objective,[]);
  assert.deepEqual(result.sections.assessment,[]);
  assert.deepEqual(result.sections.plan,[]);
  assert.ok(formatOrganizedSoap(result).includes('Campos vazios não significam achados normais'));
});

test('Seções explícitas S/O/A/P não geram conteúdo novo',()=>{
  const text='S: paciente refere dor crônica.\nO: ao exame, edema discreto.\nA: hipótese diagnóstica de lesão meniscal.\nP: solicito radiografia.';
  const result=organizeNotesToSoap(text);
  assert.deepEqual(result.sections.subjective,['paciente refere dor crônica.']);
  assert.deepEqual(result.sections.objective,['ao exame, edema discreto.']);
  assert.deepEqual(result.sections.assessment,['hipótese diagnóstica de lesão meniscal.']);
  assert.deepEqual(result.sections.plan,['solicito radiografia.']);
  assert.equal(result.classifiedCount,4);
});

test('Seção explícita permite múltiplas linhas até a próxima seção',()=>{
  const text='O: exame físico informado\nDor à palpação medial.\nA: diagnóstico informado: sem confirmação.\nP: orientar retorno.';
  const result=organizeNotesToSoap(text);
  assert.equal(result.sections.objective.length,2);
  assert.equal(result.sections.assessment.length,1);
  assert.equal(result.sections.plan.length,1);
});

test('Frase ambígua permanece não classificada, sem diagnóstico inventado',()=>{
  const result=organizeNotesToSoap('Talvez cirurgia futuramente.\nPessoa com condição não especificada.');
  assert.deepEqual(result.sections.subjective,[]);
  assert.deepEqual(result.sections.objective,[]);
  assert.deepEqual(result.sections.assessment,[]);
  assert.deepEqual(result.sections.plan,[]);
  assert.equal(result.sections.unclassified.length,2);
});

test('Negações, quantidades e valores não são modificados',()=>{
  const notes='S: Nega febre e dispneia.\nO: PA 120/80 mmHg.\nP: Prescrevo 5 mg a cada 12 horas.';
  const result=organizeNotesToSoap(notes);
  const doc=formatOrganizedSoap(result,{name:'PACIENTE FICTÍCIO'});
  assert.ok(doc.includes('Nega febre e dispneia.'));
  assert.ok(doc.includes('PA 120/80 mmHg.'));
  assert.ok(doc.includes('5 mg a cada 12 horas.'));
  assert.ok(doc.includes('PACIENTE FICTÍCIO'));
});

test('Somente rótulos sem conteúdo deixam seção vazia, não normal',()=>{
  const doc=formatOrganizedSoap(organizeNotesToSoap('S: dor no joelho\nO:\nA:\nP:'));
  assert.ok(doc.includes('O — OBJETIVO / EXAME FÍSICO:\n\nA — AVALIAÇÃO / HIPÓTESES:'));
});
