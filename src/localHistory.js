export const HISTORY_STORAGE_KEY='prontuario_ia_preview_history_v1';
export const HISTORY_LIMIT=8;
const DOCUMENT_LIMIT=20000;
const TEXT_LIMITS={raw:20000,complement:30000,narrative:40000};

const clip=(value,limit)=>String(value||'').trim().slice(0,limit);

export function normalizeCaseCode(value=''){
 return String(value).toLocaleUpperCase('pt-BR').replace(/[^A-Z0-9-]/g,'-').replace(/-+/g,'-').slice(0,32);
}
export function validFictitiousCaseCode(value=''){
 return /^CASO-FICTICIO-[A-Z0-9][A-Z0-9-]{0,17}$/.test(normalizeCaseCode(value));
}
export function createHistoryEntry({caseCode,raw='',complement='',narrative='',documents={},createdAt=new Date().toISOString()}={}){
 const code=normalizeCaseCode(caseCode);
 if(!validFictitiousCaseCode(code))throw Error('Use um código como CASO-FICTICIO-001.');
 const safeDocuments=Object.fromEntries(Object.entries(documents||{})
  .map(([key,value])=>[String(key).slice(0,40),clip(value,DOCUMENT_LIMIT)])
  .filter(([,value])=>value));
 const entry={
  id:createdAt+'-'+code,
  caseCode:code,
  createdAt,
  raw:clip(raw,TEXT_LIMITS.raw),
  complement:clip(complement,TEXT_LIMITS.complement),
  narrative:clip(narrative,TEXT_LIMITS.narrative),
  documents:safeDocuments
 };
 if(!entry.raw&&!entry.complement&&!entry.narrative&&!Object.keys(entry.documents).length)throw Error('Não há conteúdo para salvar.');
 return entry;
}
export function addHistoryEntry(entries,entry){
 return [entry,...(Array.isArray(entries)?entries:[])].slice(0,HISTORY_LIMIT);
}
export function serializeHistory(entries){
 return JSON.stringify((Array.isArray(entries)?entries:[]).slice(0,HISTORY_LIMIT));
}
export function parseHistory(value=''){
 try{
  const parsed=JSON.parse(value||'[]');
  if(!Array.isArray(parsed))return [];
  return parsed.filter(item=>item&&validFictitiousCaseCode(item.caseCode)&&typeof item.createdAt==='string').slice(0,HISTORY_LIMIT);
 }catch{return []}
}
