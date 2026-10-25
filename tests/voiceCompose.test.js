import test from 'node:test';
import assert from 'node:assert/strict';
import {appendVoiceToNote,buildVoiceAddition,VOICE_TARGETS} from '../src/voiceCompose.js';

test('microfone tem destinos de história, exame físico, exames, conduta e queixa',()=>{
 assert.deepEqual(VOICE_TARGETS.map(t=>t.id),['HDA','EXAME FÍSICO','RX / EXAMES','CONDUTA','QUEIXA']);
});

test('primeiro ditado cria nota organizada sem inferir exame ou conduta',()=>{
 const note=appendVoiceToNote('', 'Paciente relata dor no joelho esquerdo após queda','HDA');
 assert.match(note,/HDA: PACIENTE RELATA DOR NO JOELHO ESQUERDO APÓS QUEDA/);
 assert.match(note,/EXAME FÍSICO:\n\nRX \/ EXAMES:\n\nCONDUTA:$/);
});

test('novo ditado na HDA acrescenta texto preservando exame e conduta originais',()=>{
 const existing='QUEIXA: DOR NO JOELHO\n\nHDA: QUEDA HÁ DOIS DIAS\n\nEXAME FÍSICO: ADM LIMITADA\n\nCONDUTA: SOLICITO RX';
 const added=appendVoiceToNote(existing,'Piora para deambular','HDA');
 assert.match(added,/HDA: QUEDA HÁ DOIS DIAS\. PIORA PARA DEAMBULAR\./);
 assert.match(added,/EXAME FÍSICO: ADM LIMITADA\n\nCONDUTA: SOLICITO RX$/);
});

test('médico direciona ditado ao exame ou conduta sem alterar HDA',()=>{
 const base='HDA: QUEDA HÁ DOIS DIAS\n\nEXAME FÍSICO:\n\nCONDUTA:';
 const exam=appendVoiceToNote(base,'Edema presente','EXAME FÍSICO');
 const plan=appendVoiceToNote(exam,'Oriento crioterapia','CONDUTA');
 assert.match(plan,/EXAME FÍSICO: EDEMA PRESENTE/);
 assert.match(plan,/CONDUTA: ORIENTO CRIOTERAPIA/);
 assert.match(plan,/HDA: QUEDA HÁ DOIS DIAS/);
});

test('marcador explícito no ditado prevalece sobre destino e é removido da frase',()=>{
 const spoken=buildVoiceAddition('CONDUTA: solicito radiografia', 'HDA');
 assert.deepEqual(spoken,{target:'CONDUTA',content:'solicito radiografia'});
 assert.match(appendVoiceToNote('HDA: HISTÓRIA\n\nCONDUTA:', 'CONDUTA: solicito radiografia','HDA'),/CONDUTA: SOLICITO RADIOGRAFIA/);
});

test('não repete integralmente ditado idêntico inserido no mesmo campo',()=>{
 const note=appendVoiceToNote('', 'Refere dor à mobilização', 'HDA');
 assert.equal(appendVoiceToNote(note,'Refere dor à mobilização','HDA'),note);
});

test('ditado vazio é ignorado e opção de minúsculas respeitada',()=>{
 const input='HDA: Texto inicial\n\nCONDUTA:';
 assert.equal(appendVoiceToNote(input,'','HDA'),input);
 assert.match(appendVoiceToNote(input,'refere dor leve','HDA',{caps:false}),/refere dor leve/);
});

test('não perde narrativa multiline quando adiciona outra história',()=>{
 const original='HDA:\nPaciente relata torção.\nPiora noturna.\n\nEXAME FÍSICO:\nSem derrame.';
 const result=appendVoiceToNote(original,'Melhora com repouso','HDA');
 assert.ok(result.includes('Paciente relata torção.'));
 assert.ok(result.includes('Piora noturna.'));
 assert.ok(result.includes('MELHORA COM REPOUSO.'));
 assert.ok(result.includes('Sem derrame.'));
});
