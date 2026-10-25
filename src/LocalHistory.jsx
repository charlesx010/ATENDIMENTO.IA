import React, {useState} from 'react';
import {Archive,ChevronDown,Clock,Save,ShieldCheck,Trash2} from 'lucide-react';
import {
 HISTORY_STORAGE_KEY,addHistoryEntry,createHistoryEntry,normalizeCaseCode,parseHistory,serializeHistory,validFictitiousCaseCode
} from './localHistory.js';

const DOCUMENT_LABELS={
 evolucao:'Evolução',hipoteses:'Hipóteses',diferenciais:'Diferenciais',investigacao:'Investigação',
 tratamento:'Conduta',alertas:'Alertas',medicacao:'Medicação',receita:'Receita',orientacoes:'Orientações',
 exames:'Exames',fisioterapia:'Fisioterapia',laudo:'Laudo',encaminhamento:'Encaminhamento',
 afastamento:'Atestado / afastamento',atestado:'Atestado',declaracao:'Declaração'
};

function initialHistory(){
 if(typeof window==='undefined')return [];
 return parseHistory(window.sessionStorage.getItem(HISTORY_STORAGE_KEY)||'');
}
export default function LocalHistory({raw='',complement='',narrative='',documents={}}){
 const [caseCode,setCaseCode]=useState('CASO-FICTICIO-001');
 const [confirmed,setConfirmed]=useState(false);
 const [entries,setEntries]=useState(initialHistory);
 const [message,setMessage]=useState('');
 const hasContent=Boolean(raw.trim()||complement.trim()||narrative.trim()||Object.values(documents||{}).some(value=>String(value||'').trim()));
 function persist(next){
  window.sessionStorage.setItem(HISTORY_STORAGE_KEY,serializeHistory(next));
  setEntries(next);
 }
 function save(){
  setMessage('');
  try{
   const entry=createHistoryEntry({caseCode,raw,complement,narrative,documents});
   persist(addHistoryEntry(entries,entry));
   setConfirmed(false);
   setMessage('Consulta fictícia adicionada ao histórico temporário desta aba.');
  }catch(error){setMessage(error.message||'Não foi possível salvar o histórico.')}
 }
 function remove(id){
  if(!window.confirm('Apagar este registro fictício do histórico temporário?'))return;
  persist(entries.filter(entry=>entry.id!==id));
  setMessage('Registro fictício removido.');
 }
 return <section className="q-box q-local-history" aria-labelledby="local-history-title">
  <div className="q-box-title"><div><h2 id="local-history-title"><Archive size={19}/> Histórico temporário — v4.9</h2>
   <p>Protótipo local: reúne consultas e textos de exames somente nesta aba. Nada é enviado ao Supabase.</p></div><span className="q-local"><ShieldCheck size={13}/> Apenas fictício</span></div>
  <div className="q-history-save">
   <label>Código fictício do caso
    <input value={caseCode} maxLength={32} onChange={e=>setCaseCode(normalizeCaseCode(e.target.value))} placeholder="CASO-FICTICIO-001"/>
   </label>
   <label className="q-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
    <span>Confirmo que este registro contém somente dados inventados, sem nome, CPF, telefone ou outro identificador real.</span></label>
   <button type="button" className="btn primary" disabled={!hasContent||!confirmed||!validFictitiousCaseCode(caseCode)} onClick={save}><Save size={16}/> Salvar consulta fictícia nesta aba</button>
  </div>
  {message&&<p className="q-feedback" role="status">{message}</p>}
  <div className="q-history-list">
   {!entries.length?<p className="q-history-empty">Nenhuma consulta fictícia salva nesta aba.</p>:entries.map(entry=>{
    const docs=Object.entries(entry.documents||{});
    return <details className="q-history-entry" key={entry.id}>
     <summary><span><Clock size={14}/><strong>{entry.caseCode}</strong> · {new Date(entry.createdAt).toLocaleString('pt-BR')}</span><ChevronDown size={15}/></summary>
     <div className="q-history-entry-body">
      {entry.narrative&&<div><strong>Evolução</strong><pre>{entry.narrative}</pre></div>}
      {entry.complement&&<div><strong>Complementos / exames transcritos</strong><pre>{entry.complement}</pre></div>}
      {!entry.narrative&&entry.raw&&<div><strong>Relato</strong><pre>{entry.raw}</pre></div>}
      {docs.length>0&&<div><strong>Documentos ({docs.length})</strong><ul>{docs.map(([key,value])=><li key={key}><b>{DOCUMENT_LABELS[key]||key}</b><pre>{value}</pre></li>)}</ul></div>}
      <button type="button" className="btn danger-outline small" onClick={()=>remove(entry.id)}><Trash2 size={14}/> Excluir registro fictício</button>
     </div>
    </details>;
   })}
  </div>
  <p className="q-source-hint">Máximo de 8 registros. O histórico desaparece ao fechar esta aba ou ao sair. Não utilizar com pacientes reais.</p>
 </section>;
}
