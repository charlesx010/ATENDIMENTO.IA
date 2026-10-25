import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTemporaryPayload, expiresAt, parseTemporaryPayload, TEMPORARY_SESSION_HOURS} from '../src/temporarySession.js';

test('payload temporário mantém apenas texto clínico permitido', () => {
  const payload = buildTemporaryPayload({raw:'relato', complement:'OCR', narrative:'evolução', docs:{receita:'texto'}, aiDocuments:{}, aiPending:''});
  assert.deepEqual(parseTemporaryPayload(payload), {raw:'relato', complement:'OCR', narrative:'evolução', docs:{receita:'texto'}, aiDocuments:{}, aiPending:''});
});
test('expiração é de 24 horas', () => {
  const start = new Date('2026-10-24T12:00:00.000Z');
  assert.equal(new Date(expiresAt(start)).getTime() - start.getTime(), TEMPORARY_SESSION_HOURS * 60 * 60 * 1000);
});
test('recusa estrutura desconhecida', () => assert.equal(parseTemporaryPayload({schema:2}), null));
