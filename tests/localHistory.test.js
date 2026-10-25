import test from 'node:test';
import assert from 'node:assert/strict';
import {HISTORY_LIMIT,addHistoryEntry,createHistoryEntry,normalizeCaseCode,parseHistory,serializeHistory,validFictitiousCaseCode} from '../src/localHistory.js';

test('aceita somente código explicitamente fictício',()=>{
 assert.equal(normalizeCaseCode('caso ficticio 001'),'CASO-FICTICIO-001');
 assert.equal(validFictitiousCaseCode('CASO-FICTICIO-001'),true);
 assert.equal(validFictitiousCaseCode('JOAO-SILVA'),false);
});
test('não cria histórico vazio',()=>{
 assert.throws(()=>createHistoryEntry({caseCode:'CASO-FICTICIO-001'}),/conteúdo/i);
});
test('registra consulta, OCR e documentos sem campos pessoais separados',()=>{
 const entry=createHistoryEntry({caseCode:'CASO-FICTICIO-002',raw:'Relato inventado',complement:'OCR fictício',narrative:'Evolução',documents:{laudo:'Laudo fictício'},createdAt:'2026-10-24T20:00:00.000Z'});
 assert.equal(entry.caseCode,'CASO-FICTICIO-002');
 assert.equal(entry.complement,'OCR fictício');
 assert.deepEqual(Object.keys(entry.documents),['laudo']);
 assert.equal(Object.hasOwn(entry,'patientName'),false);
});
test('limita o histórico temporário aos registros mais recentes',()=>{
 let entries=[];
 for(let i=0;i<HISTORY_LIMIT+3;i++)entries=addHistoryEntry(entries,{id:String(i),caseCode:'CASO-FICTICIO-'+i,createdAt:String(i)});
 assert.equal(entries.length,HISTORY_LIMIT);
 assert.equal(entries[0].id,String(HISTORY_LIMIT+2));
 assert.equal(parseHistory(serializeHistory(entries)).length,HISTORY_LIMIT);
});
