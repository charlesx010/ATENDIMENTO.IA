import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClinicalSource,clinicalInputFingerprint} from '../src/clinicalContext.js';

test('relato revisado no microfone é a fonte principal nos dois modos',()=>{
 const text=buildClinicalSource({raw:'HDA: QUEDA ONTEM NO OMBRO DIREITO',narrative:'HDA: FRASE ANTIGA',narrativeReviewed:false});
 assert.match(text,/QUEDA ONTEM NO OMBRO DIREITO/);
 assert.doesNotMatch(text,/FRASE ANTIGA/);
});
test('evolução prévia criada pela IA não é reaproveitada automaticamente como evidência',()=>{
 const t=buildClinicalSource({raw:'DOR APÓS TRAUMA',narrative:'DIAGNÓSTICO CONFIRMADO POR IA',narrativeReviewed:false});
 assert.doesNotMatch(t,/DIAGNÓSTICO CONFIRMADO/);
});
test('mudança confirmada no exame pode complementar a transcrição original',()=>{
 const t=buildClinicalSource({raw:'HDA: ENTORSE HÁ DOIS DIAS',narrative:'HDA: ENTORSE HÁ DOIS DIAS\nEXAME FÍSICO: EDEMA CONFIRMADO',narrativeReviewed:true});
 assert.match(t,/EDEMA CONFIRMADO/);
 assert.match(t,/ENTORSE HÁ DOIS DIAS/);
});
test('complemento clínico editável entra sem duplicar rascunhos da IA',()=>{
 const t=buildClinicalSource({raw:'HDA: DOR NO JOELHO',narrative:'TEXTO GERADO ANTERIORMENTE',complement:'SEM FEBRE',narrativeReviewed:false});
 assert.match(t,/SEM FEBRE/);
 assert.doesNotMatch(t,/GERADO ANTERIORMENTE/);
});
test('fingerprint mostra nova revisão, digitação ou troca de complemento',()=>{
 const original={raw:'HDA: DOR ONTEM',narrative:'HDA: DOR',narrativeReviewed:false,complement:''};
 assert.notEqual(clinicalInputFingerprint(original),clinicalInputFingerprint({...original,raw:'HDA: DOR HOJE'}));
 assert.notEqual(clinicalInputFingerprint(original),clinicalInputFingerprint({...original,complement:'EXAME FÍSICO: EDEMA'}));
 assert.notEqual(clinicalInputFingerprint(original),clinicalInputFingerprint({...original,narrativeReviewed:true}));
 assert.equal(clinicalInputFingerprint(original),clinicalInputFingerprint({...original,narrative:'RASCUNHO NÃO VALIDADO'}));
});
