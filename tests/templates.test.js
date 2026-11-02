import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterTemplates, createTemplate, duplicateTemplate, exportTemplateLibrary, filterTemplates, parseTemplateLibrary, TEMPLATE_LIMITS, updateTemplate } from '../src/workspace/templates.js';
const input = { title:'Roteiro de teste', category:'Geral', body:'Registrar somente informações realmente obtidas.\nExame realizado: quais achados foram informados?' };

test('biblioteca exportada é restaurada preservando o roteiro e cópias independentes', () => {
  const source = createStarterTemplates();
  const restored = parseTemplateLibrary(JSON.parse(exportTemplateLibrary(source)));
  assert.deepEqual(restored, source);
  restored[0].body = 'Alteração local';
  assert.notEqual(createStarterTemplates()[0].body, restored[0].body);
});
test('criação, edição e duplicação preservam identidade correta sem modificar o original', () => {
  const original = createTemplate(input);
  const edited = updateTemplate(original, { title:'Título revisado', body:'Conferir apenas o que foi narrado.' });
  const duplicate = duplicateTemplate(original);
  assert.equal(edited.id, original.id);
  assert.equal(original.title, input.title);
  assert.equal(duplicate.body, original.body);
  assert.notEqual(duplicate.id, original.id);
  assert.notEqual(createTemplate(input).id, original.id);
  assert.match(duplicate.title, /cópia/);
});
test('importação rejeita formato de prontuário, identificadores duplicados e campos desconhecidos', () => {
  const source = createStarterTemplates();
  const value = { schema:1, kind:'documentation-checklists', templates:source };
  assert.throws(() => parseTemplateLibrary({ ...value, schema:2 }));
  assert.throws(() => parseTemplateLibrary({ ...value, templates:[source[0], source[0]] }));
  assert.throws(() => parseTemplateLibrary({ ...value, templates:[{ ...source[0], patient:'não aceito' }] }));
  assert.throws(() => parseTemplateLibrary({ ...value, templates:[{ ...source[0], kind:'clinical-note' }] }));
});
test('importação impede prototype pollution e não aplica dados ao protótipo', () => {
  const source = createStarterTemplates();
  const raw = JSON.parse(JSON.stringify({ schema:1, kind:'documentation-checklists', templates:source }));
  raw.templates[0] = JSON.parse('{"id":"safe","title":"Teste","category":"Geral","body":"Guia","kind":"documentation-checklist","__proto__":{"polluted":true}}');
  assert.throws(() => parseTemplateLibrary(raw));
  assert.equal({}.polluted, undefined);
  assert.throws(() => parseTemplateLibrary({ schema:1, kind:'documentation-checklists', templates:[{ ...source[0], id:'constructor' }] }));
});
test('limites e caracteres inválidos são rejeitados sem truncar os roteiros', () => {
  assert.throws(() => createTemplate({ ...input, title:' ' }));
  assert.throws(() => createTemplate({ ...input, body:'a'.repeat(TEMPLATE_LIMITS.body + 1) }));
  assert.throws(() => createTemplate({ ...input, body:'Guia\u0000invalido' }));
  const template = createTemplate(input);
  const tooMany = Array.from({ length:TEMPLATE_LIMITS.count + 1 }, (_,i) => ({ ...template, id:`test-${i}` }));
  assert.throws(() => parseTemplateLibrary({ schema:1, kind:'documentation-checklists', templates:tooMany }));
  assert.throws(() => updateTemplate(template, { id:'outra-identidade' }));
});
test('busca encontra categorias e palavras acentuadas sem exigir acento', () => {
  const library = createStarterTemplates();
  assert.equal(filterTemplates(library, 'urgencia')[0].id, 'starter-urgent-record');
  assert.equal(filterTemplates(library, 'cronologia')[0].id, 'starter-urgent-record');
  assert.deepEqual(filterTemplates(library, 'consulta').map(item => item.id).sort(), ['starter-first-visit','starter-follow-up']);
  assert.equal(filterTemplates(library, 'termo inexistente').length, 0);
});

test('biblioteca Unicode não produz um backup maior que o importador aceita',()=>{
 const templates=Array.from({length:40},(_,i)=>createTemplate({title:'Roteiro '+i,category:'Teste',body:'字'.repeat(3000)}));
 assert.throws(()=>exportTemplateLibrary(templates),/limite/i);
});
