import {hasContent, parseConsultation} from './model.js';
export const MAX_REVISIONS = 8;
export function checkpoint(history, document, label, now = new Date()) {
  const doc = parseConsultation(document);
  if (!hasContent(doc)) return history;
  if (history[0] && JSON.stringify(history[0].doc) === JSON.stringify(doc)) return history;
  const entry = { id: crypto.randomUUID(), label: String(label).slice(0,80), createdAt: now.toISOString(), doc };
  return [entry, ...history].slice(0, MAX_REVISIONS);
}
export function restoredRevision(entry) {
  return parseConsultation({...entry.doc,reviewed:false});
}
