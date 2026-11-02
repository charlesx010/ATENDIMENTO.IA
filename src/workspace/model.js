export const MAX_SOURCE = 6000;
export const MAX_PAYLOAD_BYTES = 90000;
export const EMPTY_SOAP = { subjective: '', objective: '', assessment: '', plan: '' };
export function emptyConsultation() {
  return { schema: 2, patient: '', source: '', summary: '', soap: { ...EMPTY_SOAP }, pending: '', reviewed: false, generatedFrom: '', origin: 'manual' };
}
export function parseConsultation(value) {
  if (!value || value.schema !== 2 || typeof value !== 'object') throw Error('Consulta incompatível. Exporte o conteúdo antes de migrar.');
  const text = (v, max) => { if (typeof v !== 'string' || v.length > max) throw Error('Dados da consulta inválidos ou excessivos.'); return v; };
  if (typeof value.reviewed !== 'boolean' || !['manual','local','ai'].includes(value.origin)) throw Error('Estado de revisão inválido.');
  const document = { schema: 2, patient: text(value.patient, 100), source: text(value.source, MAX_SOURCE), summary: text(value.summary, 8000),
    soap: Object.fromEntries(Object.keys(EMPTY_SOAP).map(k => [k, text(value.soap?.[k], 8000)])),
    pending: text(value.pending, 8000), reviewed: value.reviewed, generatedFrom: text(value.generatedFrom, MAX_SOURCE), origin: value.origin };
  if(new TextEncoder().encode(JSON.stringify(document)).length > MAX_PAYLOAD_BYTES) throw Error('A consulta excede o limite total. Exporte um backup e reduza o conteúdo.');
  return document;
}
export function hasContent(doc) { return Boolean(doc.patient || doc.source || doc.summary || doc.pending || Object.values(doc.soap).some(Boolean)); }
export function canExport(doc) { return doc.reviewed && Boolean(doc.summary.trim() || Object.values(doc.soap).some(v => v.trim())) && doc.source === doc.generatedFrom; }
export function exportNote(doc,{format='soap'}={}) {
  return [format==='narrative'?'REGISTRO NARRATIVO — REVISADO PELO USUÁRIO':'PRONTUÁRIO — REVISADO PELO USUÁRIO', doc.patient ? `Identificador: ${doc.patient}` : '', `Origem: ${doc.origin === 'ai' ? 'Rascunho de IA revisado' : doc.origin === 'local' ? 'Organização literal revisada' : 'Edição manual'}`,
    '\nRESUMO', doc.summary, ...Object.entries({subjective:'S — Subjetivo',objective:'O — Objetivo',assessment:'A — Avaliação informada',plan:'P — Plano informado'}).flatMap(([k,label]) => [`\n${format==='narrative'?label.replace(/^[SOAP] — /,''):label}`, doc.soap[k] || 'Não informado']), '\nPENDÊNCIAS',doc.pending || 'Nenhuma anotada.'].filter(Boolean).join('\n');
}
export function sourceChanged(doc, source) { return { ...doc, source, reviewed: false }; }
