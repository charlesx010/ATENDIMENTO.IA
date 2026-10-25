import React, {useMemo, useState} from 'react';
import {BookOpen, Check, ChevronLeft, Copy, Search, ShieldAlert} from 'lucide-react';
import {PRESCRIPTION_CATALOG} from './prescriptionCatalogData';

async function copyText(text){
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
  throw Error('Não foi possível copiar automaticamente neste navegador.');
}

function TreatmentDraft({entry,onClose}){
  const [choice,setChoice]=useState(entry.options?.[0]||null);
  const [reviewed,setReviewed]=useState(false);
  const [copied,setCopied]=useState(false);
  async function copyPrescription(){
    if(!choice||!reviewed)return;
    try{await copyText(choice.prescription);setCopied(true);}catch{setCopied(false);}
  }
  return <section className="rx-detail" aria-label={"Ficha terapêutica de "+entry.name}>
    <button type="button" className="btn outline small" onClick={onClose}><ChevronLeft size={15}/> Voltar à pesquisa</button>
    <header><div><p className="rx-eyebrow">{entry.audience} · {entry.setting}</p><h2>{entry.name}</h2><p>Fonte do lote: {entry.source||'em organização'}.</p></div><span>{entry.status}</span></header>
    {!entry.options?<p className="rx-notice"><ShieldAlert size={16}/> Esta condição ainda não possui opções terapêuticas liberadas para revisão.</p>:<>
      <p className="rx-gate"><ShieldAlert size={16}/>{entry.gate}</p>
      <div className="rx-choice-row">{entry.options.map(option=><button key={option.id} type="button" className={choice?.id===option.id?'selected':''} onClick={()=>{setChoice(option);setReviewed(false);setCopied(false);}}><strong>{option.title}</strong><span>{option.note}</span></button>)}</div>
      <section className="rx-prescription"><h3>{choice.title}</h3><pre>{choice.prescription}</pre></section>
      <label className="rx-review-check"><input type="checkbox" checked={reviewed} onChange={e=>{setReviewed(e.target.checked);setCopied(false);}}/><span>Revisei indicação, alergias, contraindicações, interações, diagnóstico e dados do paciente antes de copiar.</span></label>
      <div className="rx-detail-actions"><p><ShieldAlert size={16}/> Este texto é um rascunho e deve ser conferido pelo profissional responsável.</p><button className="btn primary" type="button" disabled={!reviewed} onClick={copyPrescription}>{copied?<><Check size={16}/> Copiado</>:<><Copy size={16}/> Copiar receituário</>}</button></div>
    </>}
  </section>;
}

export default function PrescriptionCatalog(){
  const [query,setQuery]=useState('');
  const [setting,setSetting]=useState('Todos');
  const [selected,setSelected]=useState(null);
  const results=useMemo(()=>PRESCRIPTION_CATALOG.filter(item=>(setting==='Todos'||item.setting===setting)&&item.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))),[query,setting]);
  return <section className="rx-catalog" aria-label="Catálogo de receitas">
    <div className="q-intro"><div><h1>Receitas</h1><p>Pesquise uma condição para acessar opções terapêuticas revisáveis.</p></div><span className="q-local"><BookOpen size={13}/> Sem uso de IA</span></div>
    {selected?<TreatmentDraft entry={selected} onClose={()=>setSelected(null)}/>:<>
      <div className="rx-controls"><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar doença ou indicação" aria-label="Pesquisar doença ou indicação"/></label><select value={setting} onChange={e=>setSetting(e.target.value)} aria-label="Filtrar cenário"><option>Todos</option><option>Atenção básica</option><option>Urgência</option></select></div>
      <p className="rx-notice"><ShieldAlert size={16}/> Escolha uma condição. Só lotes clinicamente revisáveis exibem modelos de receita.</p>
      <div className="rx-list">{results.map(item=><button type="button" className="rx-card" key={item.id} onClick={()=>setSelected(item)}><div><h2>{item.name}</h2><p>{item.audience} · {item.setting}</p></div><span>{item.status}</span></button>)}</div>
      {!results.length&&<p className="q-feedback">Nenhuma condição encontrada.</p>}
    </>}
  </section>;
}
