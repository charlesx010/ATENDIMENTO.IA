export const TEMPORARY_SESSION_HOURS = 24;
export const MAX_TEMPORARY_SESSION_BYTES = 180000;

const TEXT_LIMIT = 30000;
const cleanText = (value, limit = TEXT_LIMIT) => String(value || '').slice(0, limit);
const cleanRecord = value => Object.fromEntries(Object.entries(value || {}).slice(0, 24).map(([key, item]) => [key, cleanText(item, 3500)]));

export function expiresAt(from = new Date()) {
  return new Date(new Date(from).getTime() + TEMPORARY_SESSION_HOURS * 60 * 60 * 1000).toISOString();
}

export function buildTemporaryPayload({raw, complement, narrative, docs, aiDocuments, aiPending}) {
  const payload = {
    schema: 1,
    raw: cleanText(raw),
    complement: cleanText(complement),
    narrative: cleanText(narrative),
    docs: cleanRecord(docs),
    aiDocuments: cleanRecord(aiDocuments),
    aiPending: cleanText(aiPending, 8000)
  };
  if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_TEMPORARY_SESSION_BYTES) {
    throw new Error('A consulta excede o limite seguro da sincronização temporária. Copie os documentos concluídos e reduza o texto antes de sincronizar.');
  }
  return payload;
}

export function parseTemporaryPayload(value) {
  if (!value || typeof value !== 'object' || value.schema !== 1) return null;
  return {
    raw: cleanText(value.raw), complement: cleanText(value.complement), narrative: cleanText(value.narrative),
    docs: cleanRecord(value.docs), aiDocuments: cleanRecord(value.aiDocuments), aiPending: cleanText(value.aiPending, 8000)
  };
}
