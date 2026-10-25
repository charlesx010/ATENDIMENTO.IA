import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecognitionParts, joinSpeech, removeObviousRepetitions } from '../src/speechText.js';

const speech = (value,isFinal=true) => ({0:{transcript:value},length:1,isFinal});

test('Web Speech cumulativa: repetir mesmo evento nao cria eco',()=>{
  const prefix='Paciente de 45 anos.';
  const one=[speech(' Refere dor no joelho.')];
  const two=[speech(' Refere dor no joelho.'),speech(' Sem trauma recente.',false)];
  const three=[speech(' Refere dor no joelho.'),speech(' Sem trauma recente.',true)];
  assert.equal(joinSpeech(prefix,getRecognitionParts(one).final),'Paciente de 45 anos. Refere dor no joelho.');
  assert.equal(joinSpeech(prefix,getRecognitionParts(two).final),'Paciente de 45 anos. Refere dor no joelho.');
  assert.equal(getRecognitionParts(two).temporary,'Sem trauma recente.');
  assert.equal(joinSpeech(prefix,getRecognitionParts(three).final),'Paciente de 45 anos. Refere dor no joelho. Sem trauma recente.');
  assert.equal(joinSpeech(prefix,getRecognitionParts(three).final),'Paciente de 45 anos. Refere dor no joelho. Sem trauma recente.');
});

test('Prefixo entre pausas: continua uma vez, sem repetir texto anterior',()=>{
  const before='Paciente com dor crônica.';
  const after=getRecognitionParts([speech(' Há três dias.')]).final;
  assert.equal(joinSpeech(before,after),'Paciente com dor crônica. Há três dias.');
});

test('Limpar repetições textuais em frases consecutivas',()=>{
  assert.equal(removeObviousRepetitions('paciente com quadro paciente com quadro paciente com quadro de dor crônica'),
    'paciente com quadro de dor crônica');
  assert.equal(removeObviousRepetitions('Paciente com quadro de dor crônica. paciente com quadro de dor crônica.'),
    'Paciente com quadro de dor crônica.');
});

test('Preservar quantidades e negativas',()=>{
  const medication='Administrar 10 mg ao dia. Administrar 10 mg ao dia.';
  const negation='Não refere dor no peito. Não refere dor no peito.';
  assert.equal(removeObviousRepetitions(medication),medication);
  assert.equal(removeObviousRepetitions(negation),negation);
});

test('Frase normal nao pode ser cortada',()=>{
  const normal='Paciente relata dor lombar com irradiação para membro inferior direito, sem febre.';
  assert.equal(removeObviousRepetitions(normal),normal);
});

test('Regressão Android: finais progressivos não entram como frases diferentes',()=>{
  const progressive=[
    'paciente com dor no joelho direito',
    'paciente com dor no joelho direito a',
    'paciente com dor no joelho direito a três',
    'paciente com dor no joelho direito a três meses'
  ];
  const results=progressive.map(v=>speech(v,true));
  assert.equal(getRecognitionParts(results).final,'paciente com dor no joelho direito a três meses');
});

test('Regressão: frase subsequente sem repetição do início',()=>{
  const items=[
    speech('paciente com dor no joelho direito'),
    speech('paciente com dor no joelho direito há três meses'),
    speech('sem histórico de trauma recente'),
    speech('apresenta dificuldade para caminhar')
  ];
  assert.equal(getRecognitionParts(items).final,
    'paciente com dor no joelho direito há três meses sem histórico de trauma recente apresenta dificuldade para caminhar');
});

test('Preserva frases novas e diferentes doses no mesmo turno',()=>{
  const results=[
    speech('Prescrito 5 mg pela manhã.'),
    speech('Prescrito 10 mg à noite.'),
    speech('Nega alergia.'),
    speech('Não apresenta febre.')
  ];
  assert.equal(getRecognitionParts(results).final,
    'Prescrito 5 mg pela manhã. Prescrito 10 mg à noite. Nega alergia. Não apresenta febre.');
});

test('Ao receber a mesma frase novamente, não a duplica',()=>{
  const repeated=[speech('Paciente refere dor lombar crônica.'),speech('Paciente refere dor lombar crônica.')];
  assert.equal(getRecognitionParts(repeated).final,'Paciente refere dor lombar crônica.');
});
