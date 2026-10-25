import React, {useEffect, useMemo, useState} from 'react';
import {AlertTriangle,Check,ClipboardCheck,Copy,LockKeyhole} from 'lucide-react';
import {buildFinalPackage} from './consultationPackage.js';
import {
 MEDICATION_ROUTES,buildReviewedPackage,documentBlockers,formatDocumentForCopy,
 hasBlockingPlaceholder,isInjectableRoute,reviewedPackageAsText
} from './documentSafety.js';

const MEDICATION_CHECKS=[
 ['clinical','Conferi alergias, comorbidades, gestação, função renal/hepática e medicamentos em uso quando aplicáveis.'],
 ['structure','Conferi medicamento, concentração, forma, dose, frequência, duração e quantidade.'],
 ['destination','Vou revisar o texto no sistema oficial de prescrição antes de assinar ou emitir.']
];

export default function FinalPackage({narrative='',documents={},pending='',outdated=false,copy=()=>{}}){
 const input=useMemo(()=>({narrative,documents,pending}),[narrative,documents,pending]);
 const sections=useMemo(()=>buildFinalPackage(input),[input]);
 const fingerprint=useMemo(()=>sections.map(section=>section.id+'\u0000'+section.text).join('\u0001'),[sections]);
 const medicationText=documents?.medicacao||'';
 const [reviewed,setReviewed]=useState({});
 const [medication,setMedication]=useState({route:'',checks:{}});
 useEffect(()=>{setReviewed({});},[fingerprint]);
 useEffect(()=>{setMedication({route:'',checks:{}});},[medicationText]);
 if(!sections.length)return null;
 const reviewState={outdated,reviewed,medication};
 const ready=buildReviewedPackage(input,reviewState);
 const copyReviewed=()=>copy(reviewedPackageAsText(input,reviewState),'Documentos revisados');
 return <section className="q-box q-final-package" aria-labelledby="final-documents-title">
  <div className="q-final-heading"><div><h2 id="final-documents-title"><ClipboardCheck size={18}/> Central de documentos finais</h2>
   <p>Revise cada rascunho e copie para o prontuário ou sistema oficial. Esta tela não assina nem emite documentos.</p></div>
   <button className="btn primary" type="button" onClick={copyReviewed} disabled={!ready.length}>
    <Copy size={16}/> Copiar revisados ({ready.length})
   </button>
  </div>
  <div className="q-document-notice"><LockKeyhole size={16}/><span><strong>Barreira de segurança ativa.</strong> Alterar qualquer texto cancela as revisões anteriores. Rascunho de medicação exige confirmações adicionais.</span></div>
  {outdated&&<p className="q-clinical-review" role="alert"><AlertTriangle size={14}/> Atualize a análise: o relato mudou e todos os documentos estão bloqueados.</p>}
  <div className="q-final-grid">{sections.map(section=>{
   const blockers=documentBlockers(section,reviewState);
   const blocked=blockers.length>0;
   const isMedication=section.id==='medicacao';
   const hasPlaceholder=hasBlockingPlaceholder(section.text);
   return <article key={section.id} className={'q-final-card'+(blocked?' is-blocked':' is-ready')}>
    <div className="q-final-card-title"><strong>{section.label}</strong><span>{blocked?'Bloqueado':'Pronto para copiar'}</span></div>
    <p>{section.text.length>360?section.text.slice(0,360)+'…':section.text}</p>
    {section.id!=='pendencias'&&<label className="q-check q-document-review"><input type="checkbox"
      checked={reviewed[section.id]===section.text} disabled={outdated||hasPlaceholder}
      onChange={e=>setReviewed(previous=>({...previous,[section.id]:e.target.checked?section.text:false}))}/>
      <span>Revisei este documento e confirmo que corresponde à consulta.</span></label>}
    {isMedication&&<div className="q-medication-guard">
      <strong>Conferência do rascunho de medicação</strong>
      <label>Via de administração conferida
       <select aria-label="Via de administração da medicação" value={medication.route}
        onChange={e=>setMedication(previous=>({...previous,source:section.text,route:e.target.value,checks:{...previous.checks,injectable:false}}))}>
        <option value="">Selecione a via</option>{MEDICATION_ROUTES.map(route=><option key={route.id} value={route.id}>{route.label}</option>)}
       </select>
      </label>
      {MEDICATION_CHECKS.map(([id,label])=><label className="q-check" key={id}><input type="checkbox"
       checked={medication.checks[id]===true} onChange={e=>setMedication(previous=>({...previous,source:section.text,checks:{...previous.checks,[id]:e.target.checked}}))}/><span>{label}</span></label>)}
      {isInjectableRoute(medication.route)&&<label className="q-check q-injectable-check"><input type="checkbox"
       checked={medication.checks.injectable===true} onChange={e=>setMedication(previous=>({...previous,source:section.text,checks:{...previous.checks,injectable:e.target.checked}}))}/>
       <span>Para o injetável, conferi diluente, volume, velocidade/técnica, local e monitorização quando aplicáveis.</span></label>}
    </div>}
    {blockers.length>0&&<ul className="q-document-blockers">{blockers.map(item=><li key={item}>{item}</li>)}</ul>}
    <button className="btn outline small" type="button" disabled={blocked}
     onClick={()=>copy(formatDocumentForCopy(section,reviewState),section.label)}><Copy size={14}/> Copiar documento revisado</button>
   </article>})}</div>
  <p className="q-final-disclaimer"><AlertTriangle size={14}/> Confira identificação do paciente, identificação profissional, data, alergias, contraindicações, doses, via, lateralidade e validade formal no sistema de destino. A assinatura e a emissão permanecem sob responsabilidade médica.</p>
 </section>;
}
