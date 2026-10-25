import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanOcrText,extractionMessage,validateExamFile,OCR_LIMITS} from '../src/localOcr.js';

test('OCR aceita formatos previstos e rejeita arquivo grande',()=>{
 assert.equal(validateExamFile({type:'image/jpeg',size:1000}),'');
 assert.match(validateExamFile({type:'application/zip',size:1000}),/Formato não aceito/);
 assert.match(validateExamFile({type:'application/pdf',size:OCR_LIMITS.maxBytes+1}),/8 MB/);
});

test('OCR limpa ruído sem inventar conteúdo',()=>{
 assert.equal(cleanOcrText('  JOELHO   DIREITO  \r\n\n\n sem fratura  '),'JOELHO DIREITO\n\n sem fratura');
});

test('mensagem informa baixa superfície e processamento local',()=>{
 assert.match(extractionMessage({text:'resultado',method:'image-ocr',confidence:63,truncated:false}),/OCR local/);
 assert.match(extractionMessage({text:'resultado',method:'image-ocr',confidence:63,truncated:false}),/63%/);
});
