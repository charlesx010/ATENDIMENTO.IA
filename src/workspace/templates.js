// Modelos são guias de documentação, nunca registros de pacientes ou condutas prontas.
export const TEMPLATE_LIMITS = Object.freeze({ count: 40, title: 80, category: 40, body: 3000, fileBytes: 200000, libraryBytes: 180000 });
export const TEMPLATE_KIND = 'documentation-checklist';
const LIBRARY_KIND = 'documentation-checklists';
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const TEMPLATE_KEYS = ['id', 'title', 'category', 'body', 'kind'];
const invalid = message => { throw new Error(message); };
const isPlainRecord = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function onlyKeys(value, keys) {
  if (!isPlainRecord(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(key => FORBIDDEN.has(key) || !keys.includes(key))) invalid('Estrutura do arquivo de modelos inválida.');
}
function cleanText(value, max, label) {
  if (typeof value !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) invalid(`${label} deve conter somente texto válido.`);
  const text = value.replace(/\r\n?/g, '\n').trim();
  if (!text || text.length > max) invalid(`${label} deve ter entre 1 e ${max} caracteres.`);
  return text;
}
function newId() {
  if (!globalThis.crypto?.randomUUID) invalid('Este navegador precisa de contexto seguro para criar modelos.');
  return `tpl-${crypto.randomUUID()}`;
}
export function validateTemplate(value) {
  onlyKeys(value, TEMPLATE_KEYS);
  if (typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value.id) || FORBIDDEN.has(value.id)) invalid('Identificador de modelo inválido.');
  if (value.kind !== TEMPLATE_KIND) invalid('O arquivo deve conter somente guias de documentação.');
  return { id: value.id, title: cleanText(value.title, TEMPLATE_LIMITS.title, 'Nome'), category: cleanText(value.category, TEMPLATE_LIMITS.category, 'Categoria'), body: cleanText(value.body, TEMPLATE_LIMITS.body, 'Roteiro'), kind: TEMPLATE_KIND };
}
export function createTemplate(input) {
  if (!isPlainRecord(input) || Object.keys(input).some(key => !['title','category','body'].includes(key) || FORBIDDEN.has(key))) invalid('Campos do modelo inválidos.');
  return validateTemplate({ id: newId(), title: input.title, category: input.category, body: input.body, kind: TEMPLATE_KIND });
}
export function updateTemplate(template, input) {
  const original = validateTemplate(template);
  if (!isPlainRecord(input) || Object.keys(input).some(key => !['title','category','body'].includes(key) || FORBIDDEN.has(key))) invalid('Campos do modelo inválidos.');
  return validateTemplate({ ...original, ...input });
}
export function duplicateTemplate(template) {
  const original = validateTemplate(template);
  const suffix = ' (cópia)';
  return validateTemplate({ ...original, id: newId(), title: original.title.slice(0, TEMPLATE_LIMITS.title - suffix.length) + suffix });
}
export function parseTemplateLibrary(value) {
  onlyKeys(value, ['schema', 'kind', 'templates']);
  if (value.schema !== 1 || value.kind !== LIBRARY_KIND || !Array.isArray(value.templates) || value.templates.length > TEMPLATE_LIMITS.count) invalid(`Biblioteca incompatível. O limite é ${TEMPLATE_LIMITS.count} modelos.`);
  const templates = value.templates.map(validateTemplate);
  if (new Set(templates.map(item => item.id)).size !== templates.length) invalid('Há identificadores repetidos no arquivo de modelos.');
  if(new TextEncoder().encode(JSON.stringify({schema:1,kind:LIBRARY_KIND,templates})).length>TEMPLATE_LIMITS.libraryBytes)invalid('A biblioteca excede o limite total. Reduza os roteiros ou exporte partes separadamente.');
  return templates;
}
export function exportTemplateLibrary(templates) {
  const value = { schema: 1, kind: LIBRARY_KIND, templates };
  const text=JSON.stringify({ ...value, templates: parseTemplateLibrary(value) }, null, 2);
  if(new TextEncoder().encode(text).length>TEMPLATE_LIMITS.fileBytes)invalid('A biblioteca excede o limite do arquivo.');
  return text;
}
export function filterTemplates(templates, query = '') {
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const term = normalize(query.trim());
  return templates.filter(item => normalize(`${item.title} ${item.category} ${item.body}`).includes(term));
}
const STARTERS = [
  {
    id: 'starter-first-visit', title: 'Primeira consulta', category: 'Consulta geral', kind: TEMPLATE_KIND,
    body: 'GUIA PARA COLETA — PREENCHER SOMENTE COM INFORMAÇÕES REALMENTE OBTIDAS\n\nQueixa principal e duração.\nHistória e evolução relatadas.\nAntecedentes, medicamentos e alergias: registrar apenas o que foi informado.\nExame físico: registrar somente achados efetivamente avaliados.\nExames disponíveis: identificar fonte e data, quando informadas.\nAvaliação do profissional: distinguir hipótese de confirmação.\nConduta efetivamente definida e orientações dadas.\nDúvidas e informações ainda não obtidas.'
  },
  {
    id: 'starter-follow-up', title: 'Consulta de retorno', category: 'Acompanhamento', kind: TEMPLATE_KIND,
    body: 'GUIA DE RETORNO — NÃO PRESSUPÕE MELHORA, ADESÃO OU NORMALIDADE\n\nMotivo do retorno e intervalo desde a avaliação anterior.\nMudanças dos sintomas conforme relato.\nTratamentos referidos e dificuldades informadas, sem presumir adesão.\nResultados apresentados: registrar conteúdo e origem.\nExame físico realmente realizado nesta consulta.\nAvaliação e decisões expressas pelo profissional.\nOrientações comunicadas e acompanhamento combinado.\nInformações pendentes para conferência.'
  },
  {
    id: 'starter-urgent-record', title: 'Registro de atendimento de urgência', category: 'Urgência', kind: TEMPLATE_KIND,
    body: 'GUIA DE REGISTRO — NÃO É PROTOCOLO DE TRIAGEM NEM RECOMENDA CONDUTAS\n\nMotivo, início e cronologia dos acontecimentos relatados.\nInformações obtidas e fonte do relato.\nSinais vitais: incluir somente valores medidos/informados, com horário se disponível.\nAchados efetivamente examinados.\nResultados de exames apresentados ou realizados.\nAvaliação documentada pelo profissional.\nIntervenções efetivamente realizadas e resposta observada, quando informadas.\nDestino, orientações e encaminhamentos realmente definidos.\nIncertezas ou dados ausentes a registrar.'
  }
];
export function createStarterTemplates() { return STARTERS.map(item => ({ ...item })); }
