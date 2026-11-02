import React from 'react';
import { CheckCheck, Copy, Download, Printer } from 'lucide-react';

const SOAP = {
  subjective: 'S · História relatada',
  objective: 'O · Exame e resultados informados',
  assessment: 'A · Avaliação informada',
  plan: 'P · Conduta informada'
};

export default function ReviewStep({
  doc, stale, aiProposal, outputFormat, setOutputFormat,
  patch, applyAI, setAiProposal, setDoc, exportAllowed,
  onCopy, onDownload, onPrint
}) {
  return <>
    <div className="w-section-heading"><div><h2>Seu prontuário. Sua revisão.</h2><p>Confira cada informação com o relato antes de copiar ou baixar.</p></div><CheckCheck/></div>
    {stale && <div className="w-alert">O relato foi alterado depois da organização. Gere novamente ou confirme que incorporou as alterações ao rascunho.<button className="w-button" onClick={() => patch({ generatedFrom: doc.source })}>Confirmei as alterações manualmente</button></div>}
    {aiProposal && <div className="w-proposal">
      <h3>Resultado da IA · ainda não aplicado</h3><p>{aiProposal.note.summary}</p>
      <details><summary>Conferir todos os campos gerados</summary>{Object.entries(SOAP).map(([key, label]) => <div key={key}><strong>{label}</strong><p>{aiProposal.note[key] || 'Não informado'}</p></div>)}<strong>Pendências</strong><p>{aiProposal.note.pending || 'Nenhuma apontada'}</p></details>
      <button className="w-button primary" disabled={aiProposal.source !== doc.source} onClick={applyAI}>Aplicar rascunho de IA</button><button className="w-button" onClick={() => setAiProposal(null)}>Descartar resultado</button>
    </div>}
    <label className="w-field">Resumo factual<textarea rows={3} value={doc.summary} maxLength={8000} onChange={event => patch({ summary: event.target.value })} placeholder="O resumo da IA aparecerá aqui. Você também pode escrever manualmente."/></label>
    {Object.entries(SOAP).map(([key, label]) => <label className="w-field" key={key}>{label}<textarea rows={3} value={doc.soap[key]} maxLength={8000} placeholder="Não informado" onChange={event => patch({ soap: { ...doc.soap, [key]: event.target.value } })}/></label>)}
    <label className="w-field">Pendências e ambiguidades<textarea rows={3} value={doc.pending} maxLength={8000} onChange={event => patch({ pending: event.target.value })}/></label>
    {doc.origin === 'manual' && doc.generatedFrom !== doc.source && <button className="w-button" onClick={() => patch({ generatedFrom: doc.source })}>Vincular edição manual ao relato atual</button>}
    <label className="w-check w-review-check"><input type="checkbox" checked={doc.reviewed} disabled={stale || (!doc.summary.trim() && !Object.values(doc.soap).some(value => value.trim()))} onChange={event => setDoc(current => ({ ...current, reviewed: event.target.checked, generatedFrom: current.generatedFrom || current.source }))}/>Conferi o relato, negações, números, lateralidade e campos ausentes. Revisei e assumo a responsabilidade pelo texto.</label>
    <label className="w-field">Formato de saída<select value={outputFormat} onChange={event => setOutputFormat(event.target.value)}><option value="soap">SOAP</option><option value="narrative">Narrativo por seções</option></select></label>
    <div className="w-actions"><button className="w-button primary" disabled={!exportAllowed} onClick={onCopy}><Copy size={17}/> Copiar prontuário</button><button className="w-button" disabled={!exportAllowed} onClick={onDownload}><Download size={17}/> Baixar texto</button><button className="w-button" disabled={!exportAllowed} onClick={onPrint}><Printer size={17}/> Imprimir / salvar PDF</button></div>
  </>;
}
