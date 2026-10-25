import React from 'react';
import {Mic,FileText,Sparkles,Copy,Trash2,AlertTriangle,RotateCcw} from 'lucide-react';
import ExamAttachments from './ExamAttachments.jsx';
import FinalPackage from './FinalPackage.jsx';
import VoiceInput from './VoiceInput.jsx';

const EXTRA=[
 {id:'laudo',name:'Laudo sugerido'},
 {id:'fisioterapia',name:'Fisioterapia'},
 {id:'medicacao',name:'Medicação'},
 {id:'afastamento',name:'Afastamento'},
 {id:'orientacoes',name:'Orientações'},
 {id:'encaminhamento',name:'Encaminhamento'},
 {id:'exames',name:'Exames'}
];

export default function SimpleWorkspace({
 raw,setRaw,complement,setComplement,narrative,setNarrative,onNarrativeEdit,
 onTranscript,voiceEpoch,aiConsent,setAiConsent,aiBusy,userAiAllowed,
 freeAiAvailable,
 generateWithAi,aiResultReady=false,aiDocuments,setAiDocuments,aiPending,setAiPending,
 aiDraft,setAiDraft,applyAiDraft,undoAvailable,undoAi,copy,clearSession,status,finalDocuments=null,syncPanel=null,
 aiWarnings=[],aiResultsOutdated=false,
 webEvidence=false,setWebEvidence=()=>{},aiReferences=[],evidenceStatus='disabled'
}){
 const canGenerate=Boolean(raw.trim()||narrative.trim()||complement.trim());
 const textField=(id,name,value,onChange,rows=6)=>(
  <div className="q-simple-field">
   <label htmlFor={id}>{name}</label>
   <textarea id={id} rows={rows} value={value} onChange={e=>onChange(e.target.value)}/>
  </div>
 );
 return <main className="q-page q-consult q-simple">
   <div className="q-intro"><div><h1>Atendimento simplificado</h1>
    <p>Fale, revise a transcrição e complete o relato. IA somente após seu clique.</p></div></div>
   {syncPanel}
   <section className="q-mic-section q-voice-primary">
    <div className="q-voice-intro"><span><Mic size={20}/><strong>Microfone</strong></span></div>
    <div className="q-voice"><VoiceInput key={voiceEpoch} onInsertTranscript={onTranscript}/></div>
    <p className="q-voice-explain">O reconhecimento do navegador é gratuito, mas pode utilizar um serviço externo.</p>
   </section>
   <section className="q-box q-simple-card">
    <h2><FileText size={17}/> O que foi transcrito</h2>
    <p>Confira termos médicos, lados, datas e negativas. Você pode corrigir qualquer palavra.</p>
    {textField('simple-raw','Transcrição / relato editável',raw,setRaw,7)}
   </section>
   <section className="q-box q-simple-card">
    <h2>Complementar consulta</h2>
    <p>Inclua exame físico, exames, achados e decisões clínicas que não apareceram no ditado.</p>
    {textField('simple-complement','Informações complementares',complement,setComplement,4)}
   </section>
   <ExamAttachments onInsertText={text=>setComplement(previous=>[previous.trim(),text].filter(Boolean).join('\n\n'))}/>
   <section className="q-box q-simple-ai">
    <h2><Sparkles size={18}/> Gerar anamnese, hipóteses e tratamento</h2>
    <p>Uma solicitação de IA com todo o contexto. A evolução será exibida automaticamente. Propostas não equivalem a diagnóstico confirmado ou prescrição.</p>
    <p className="q-simple-provider"><strong>Groq — somente cota gratuita.</strong> Nenhuma IA paga será acionada.</p>
    <label className="q-check q-evidence-option"><input type="checkbox" checked={webEvidence} disabled={aiBusy}
      onChange={e=>setWebEvidence(e.target.checked)}/><span>Buscar gratuitamente até 2 referências científicas no PubMed, usando somente um tema geral da queixa. Opcional.</span></label>
    <label className="q-ai-consent"><input type="checkbox" checked={aiConsent} onChange={e=>setAiConsent(e.target.checked)}/>
      <span>Confirmo que o relato é fictício e minha conta Groq permanece no plano Free.</span></label>
    <button className="btn primary full" type="button" onClick={generateWithAi}
      disabled={!userAiAllowed||aiBusy||!aiConsent||!canGenerate}>
      <Sparkles size={17}/>{aiBusy?' Gerando em uma chamada...':' Gerar com IA grátis (Groq)'}
    </button>
    <p className="q-free-ai-status">{freeAiAvailable===null?'Verificando a IA gratuita...'
       :freeAiAvailable?'Modo gratuito: usa somente a cota Groq disponível. Sem troca para serviço pago.'
       :'Groq gratuita indisponível. Nenhuma IA paga será usada.'}</p>
   </section>
   {!aiResultReady&&!aiDraft.trim()&&!Object.values(aiDocuments).some(x=>String(x||'').trim())&&
     (raw.trim()||complement.trim())&&<p className="q-feedback" role="status">Transcrição pronta para revisão. A análise com anamnese, hipóteses e tratamento só aparecerá quando você tocar em Gerar com IA. O microfone não gera diagnóstico automaticamente.</p>}
   {(aiResultReady||aiDraft.trim()||Object.values(aiDocuments).some(x=>String(x||'').trim()))&&<section className="q-box q-simple-results">
    <h2>Resultado clínico — revisar e editar</h2>
    {evidenceStatus!=='disabled'&&<div className="q-clinical-review">
      <strong>Literatura consultada — PubMed</strong>
      {aiReferences.length>0?
        <ul>{aiReferences.map(ref=><li key={ref.pmid}><a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.title} ({ref.year||'ano não informado'}) — PMID {ref.pmid}</a></li>)}</ul>
        :<p>Não foi possível obter referências nesta busca. Não atribua à literatura afirmações sem fonte.</p>}
      <p>Pesquisas sobre tema geral, não diretriz personalizada. Conferir pertinência e aplicabilidade no Brasil.</p>
    </div>}
    {aiWarnings.length>0&&<div className="q-clinical-review" role="alert">
      <strong>Atenção: confira estes dados no relato original</strong>
      <ul>{aiWarnings.map((v,i)=><li key={i}>{v}</li>)}</ul>
    </div>}
    {aiResultsOutdated&&<p className="q-clinical-review" role="status">
      Você alterou a transcrição ou o complemento desde a última análise. Os documentos podem estar desatualizados.
    </p>}
    <div className="q-simple-field"><label htmlFor="simple-evolution">Anamnese e evolução</label>
     <textarea id="simple-evolution" rows={12} value={narrative} onChange={e=>{setNarrative(e.target.value);onNarrativeEdit();}}/>
    </div>
    {aiDraft&&<div className="q-simple-field"><label htmlFor="simple-pending-note">Evolução gerada enquanto você editava (não aplicada)</label>
      <textarea id="simple-pending-note" rows={6} value={aiDraft} onChange={e=>setAiDraft(e.target.value)}/>
      <button type="button" className="btn outline" onClick={applyAiDraft}>Aplicar esta versão</button>
    </div>}
    {['hipoteses','diferenciais','investigacao','tratamento','alertas'].map(key=><div key={key} className="q-simple-field">
      <label htmlFor={'simple-'+key}>{key==='hipoteses'?'Hipóteses diagnósticas — justificativas e incertezas'
        :key==='diferenciais'?'Diagnósticos diferenciais — como distinguir'
        :key==='investigacao'?'Perguntas, exame físico dirigido e exames a considerar'
        :key==='tratamento'?'Tratamento — possibilidades para decisão médica'
        :'Sinais de alerta e critérios de reavaliação'}</label>
      <textarea id={'simple-'+key} rows={6} value={aiDocuments[key]||''}
        onChange={e=>setAiDocuments(p=>({...p,[key]:e.target.value}))}
        placeholder="Sem proposta gerada para este item."/>
    </div>)}
    {!!aiPending.trim()&&<div className="q-simple-field"><label htmlFor="simple-pending">Dados clínicos a confirmar</label>
      <textarea id="simple-pending" rows={3} value={aiPending} onChange={e=>setAiPending(e.target.value)}/></div>}
    {EXTRA.filter(t=>aiDocuments[t.id]?.trim()).length>0&&<details className="q-simple-extra">
      <summary>Documentos adicionais da mesma análise (sem novas chamadas)</summary>
      {EXTRA.filter(t=>aiDocuments[t.id]?.trim()).map(t=><div className="q-simple-field" key={t.id}>
        <label htmlFor={'simple-doc-'+t.id}>{t.name} — rascunho</label>
        <textarea id={'simple-doc-'+t.id} rows={5} value={aiDocuments[t.id]}
          onChange={e=>setAiDocuments(p=>({...p,[t.id]:e.target.value}))}/>
      </div>)}
     </details>}
    {undoAvailable&&<button className="btn outline small" onClick={undoAi}><RotateCcw size={15}/> Desfazer aplicação da IA</button>}
    <p><AlertTriangle size={14}/> Todo conteúdo deve ser revisado. Medicamentos e afastamento são possibilidades, nunca ordens emitidas automaticamente.</p>
   </section>}
   <p className="q-feedback">Para copiar a evolução ou qualquer rascunho, use a Central de documentos finais abaixo.</p>
   <FinalPackage narrative={narrative} documents={finalDocuments||aiDocuments} pending={aiPending}
     outdated={aiResultsOutdated} copy={copy}/>
   
   {status&&<p className="q-feedback" role="status">{status}</p>}
   <button className="q-clear" onClick={clearSession}><Trash2 size={16}/> Encerrar e limpar consulta</button>
   <p className="q-privacy">Ambiente experimental: use casos fictícios nos testes. Se ativada, a sincronização guarda somente o texto desta consulta por até 24 horas na sua conta.</p>
 </main>;
}
