import React, {lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronUp,
  ClipboardList, Copy, FileText, FlaskConical, HeartHandshake, LockKeyhole,
  LogOut, Mic, Pill, RotateCcw, Settings, ShieldCheck,
  Sparkles, Stethoscope, Trash2, WandSparkles, X
} from 'lucide-react';
import VoiceInput from './VoiceInput.jsx';
import SimpleWorkspace from './SimpleWorkspace.jsx';
import FinalPackage from './FinalPackage.jsx';
import PrescriptionCatalog from './PrescriptionCatalog.jsx';
import TemporarySessionPanel from './TemporarySessionPanel.jsx';
import {buildTemporaryPayload} from './temporarySession.js';
import {useTemporarySession} from './useTemporarySession.js';
import {configured,supabase} from './supabase.js';
import {formatNarrative,insertConfirmedExam,wordCount} from './quickDraft.js';
import {REGIONS,DOCUMENT_TYPES} from './clinicalLibrary.js';
import {QUICK_ACTIONS,AI_DOCUMENT_LINKS,buildContextualDocument} from './documentDrafts.js';
import {VOICE_TARGETS,buildVoiceAddition,appendVoiceToNote} from './voiceCompose.js';
import {buildClinicalSource,clinicalInputFingerprint} from './clinicalContext.js';
import {identifyComplaint,getFindingGroups,confirmedRegionFindings} from './complaintSuggestions.js';
import {HDA_REGIONS,getHdaGroups,getConfirmedHdaDetails,insertHdaDetails} from './hdaTemplates.js';
import {PLAN_REGIONS,getPlanGroups,confirmedPlanPhrases,insertPlanDetails} from './planTemplates.js';

const AdminPanel=lazy(()=>import('./AdminPanel.jsx'));
const APP_VERSION = '5.2.0';
const AI_DOCUMENT_NAMES=[
 {id:'hipoteses',name:'Hipóteses diagnósticas'},
 {id:'diferenciais',name:'Diagnósticos diferenciais'},
 {id:'investigacao',name:'Exame dirigido e investigação'},
 {id:'tratamento',name:'Tratamento a considerar'},
 {id:'alertas',name:'Sinais de alerta e reavaliação'},
 {id:'laudo',name:'Laudo / relatório'},
 {id:'fisioterapia',name:'Fisioterapia'},
 {id:'medicacao',name:'Possibilidades de medicação'},
 {id:'afastamento',name:'Possível afastamento'},
 {id:'orientacoes',name:'Orientações'},
 {id:'encaminhamento',name:'Encaminhamento'},
 {id:'exames',name:'Exames a considerar'}
];
const SPECIALTIES=['Ortopedia e Traumatologia','Clínica Geral','Pronto Atendimento / Emergência','Medicina de Família e Comunidade','Personalizado'];
const defaultPrefs={specialty:SPECIALTIES[0],caps:true};

function ButtonIcon({name,size=17}) {
  const list={receita:Pill,exames:FlaskConical,laudo:FileText,encaminhamento:ClipboardList,
    atestado:FileText,orientacoes:HeartHandshake,declaracao:FileText,fisioterapia:HeartHandshake};
  const Icon=list[name]||FileText;
  return <Icon size={size}/>;
}
async function putClipboard(value,element){
  if(!String(value||'').trim())throw Error('Nada para copiar.');
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(value);return;}catch{}
  }
  if(element){
    element.focus();
    element.select();
    if(document.execCommand('copy'))return;
  }
  throw Error('Selecione o texto e use a função Copiar do navegador.');
}

export default function QuickWorkspace({profile,demo=false,onLogout}){
  const [section,setSection]=useState('consulta');
  const [viewMode,setViewMode]=useState('simplificado');
  const [simpleComplement,setSimpleComplement]=useState('');
  const [prefs,setPrefs]=useState(()=>({
    ...defaultPrefs,...(profile?.preferences||{}),
    caps:typeof profile?.preferences?.caps==='boolean'?profile.preferences.caps:true
  }));
  const [raw,setRaw]=useState('');
  const [examRegion,setExamRegion]=useState('joelho');
  const [micOpen,setMicOpen]=useState(true);
  const [voiceDestination,setVoiceDestination]=useState('HDA');
  const [narrative,setNarrative]=useState('');
  const [manuallyEdited,setManuallyEdited]=useState(false);
  const [narrativeReviewed,setNarrativeReviewed]=useState(false);
  const [docs,setDocs]=useState({});
  const [docSources,setDocSources]=useState({});
  const [docType,setDocType]=useState(null);
  const [showFindings,setShowFindings]=useState(false);
  const [showPlan,setShowPlan]=useState(false);
  const [planRegionChoice,setPlanRegionChoice]=useState('');
  const [planAnswers,setPlanAnswers]=useState({});
  const [planExtra,setPlanExtra]=useState('');
  const [showHda,setShowHda]=useState(false);
  const [hdaRegionChoice,setHdaRegionChoice]=useState('');
  const [hdaAnswers,setHdaAnswers]=useState({});
  const [hdaDuration,setHdaDuration]=useState('');
  const [hdaDurationUnit,setHdaDurationUnit]=useState('dias');
  const [hdaSide,setHdaSide]=useState('');
  const [hdaExtra,setHdaExtra]=useState('');
  const [showSpecialTests,setShowSpecialTests]=useState(false);
  const [confirmed,setConfirmed]=useState([]);
  const [examSelections,setExamSelections]=useState({});
  const [status,setStatus]=useState('');
  const [prefStatus,setPrefStatus]=useState('');
  const [copied,setCopied]=useState('');
  const [aiConsent,setAiConsent]=useState(false);
  const [freeAiAvailable,setFreeAiAvailable]=useState(null);
  const [aiBusy,setAiBusy]=useState(false);
  const [aiDraft,setAiDraft]=useState('');
  const [aiDocuments,setAiDocuments]=useState({});
  const [aiPending,setAiPending]=useState('');
  const [aiWarnings,setAiWarnings]=useState([]);
  const [webEvidence,setWebEvidence]=useState(false);
  const [fullAiScope,setFullAiScope]=useState('deep');
  const [aiReferences,setAiReferences]=useState([]);
  const [evidenceStatus,setEvidenceStatus]=useState('disabled');
  const [aiSourceEvidence,setAiSourceEvidence]=useState(null);
  const [aiOriginalNarrative,setAiOriginalNarrative]=useState('');
  const [aiUndo,setAiUndo]=useState(null);
  const aiController=useRef(null);
  const currentNarrative=useRef('');
  const requestContextRef=useRef('');
  const restoreTemporarySession=useCallback(payload=>{
    setRaw(payload.raw);setSimpleComplement(payload.complement);setNarrative(payload.narrative);
    setDocs(payload.docs);setAiDocuments(payload.aiDocuments);setAiPending(payload.aiPending);
    setAiDraft('');setAiWarnings([]);setAiSourceEvidence(null);setAiReferences([]);setEvidenceStatus('disabled');
    setNarrativeReviewed(false);setManuallyEdited(false);setCopied('');
    setStatus('Consulta temporária retomada. Revise todo o conteúdo antes de copiar.');
  },[]);
  const temporarySnapshot=useMemo(()=>buildTemporaryPayload({
    raw,complement:simpleComplement,narrative,docs,aiDocuments,aiPending
  }),[raw,simpleComplement,narrative,docs,aiDocuments,aiPending]);
  const temporarySync=useTemporarySession({
    enabled:!demo&&configured&&Boolean(profile?.user_id),
    userId:profile?.user_id,
    snapshot:temporarySnapshot,
    onRestore:restoreTemporarySession
  });
  const [voiceEpoch,setVoiceEpoch]=useState(0);
  const currentContext=clinicalInputFingerprint({raw,narrative,complement:simpleComplement,narrativeReviewed});
  requestContextRef.current=currentContext;
  const aiResultsOutdated=aiSourceEvidence!==null&&aiSourceEvidence!==currentContext;
  const hasContent=Boolean(raw.trim()||simpleComplement.trim()||narrative.trim()||aiDraft.trim()||Object.values(aiDocuments).some(x=>String(x||'').trim())||Object.values(docs).some(x=>String(x||'').trim()));
  const canGenerateAi=!demo&&freeAiAvailable===true;
  const currentRegion=REGIONS.find(x=>x.id===examRegion)||REGIONS[0];
  const complaintHint=identifyComplaint([raw,narrative].filter(Boolean).join(' '));
  const examGroups=getFindingGroups(examRegion);
  const selectedExamFindings=examGroups?confirmedRegionFindings(examRegion,examSelections):confirmed;
  const generalGroupCount={joelho:10,ombro:5,tornozelo:7}[examRegion]||0;
  const visibleExamGroups=showSpecialTests?examGroups:examGroups?.slice(0,generalGroupCount);
  const specialTestCount=examGroups?Math.max(0,examGroups.length-generalGroupCount):0;
  const planRegion=planRegionChoice||(getPlanGroups(complaintHint?.id)?complaintHint.id:'');
  const planGroups=getPlanGroups(planRegion);
  const confirmedPlan=[
    ...confirmedPlanPhrases(planRegion,planAnswers),
    ...(planGroups&&planExtra.trim()?[planExtra.trim().replace(/\s+/g,' ').slice(0,500)]:[])
  ];
  const hdaRegion=hdaRegionChoice||(getHdaGroups(complaintHint?.id)?complaintHint.id:'');
  const hdaGroups=getHdaGroups(hdaRegion);
  const confirmedHdaPhrases=[
    ...getConfirmedHdaDetails(hdaRegion,hdaAnswers,hdaDuration,hdaDurationUnit,hdaSide),
    ...(hdaGroups&&hdaExtra.trim()?[hdaExtra.trim().replace(/\s+/g,' ').slice(0,500)]:[])
  ];

  useEffect(()=>{currentNarrative.current=narrative;},[narrative]);
  useEffect(()=>{
    let alive=true;
    fetch('/api/free-clinical',{cache:'no-store'}).then(r=>r.json()).then(data=>{
      if(alive)setFreeAiAvailable(Boolean(data.available));
    }).catch(()=>{if(alive)setFreeAiAvailable(false);});
    return()=>{alive=false;};
  },[]);

  useEffect(()=>{
    const prevent=e=>{
      if(!hasContent)return;
      e.preventDefault();
      e.returnValue='';
    };
    window.addEventListener('beforeunload',prevent);
    return ()=>window.removeEventListener('beforeunload',prevent);
  },[hasContent]);

  function onTranscript(text){
    const latest=String(text||'').trim();
    if(!latest)return;
    if(viewMode==='simplificado'){
      // Transcrever NÃO é gerar análise clínica. Não preencher a evolução
      // antes do clique explícito em IA nem confundir texto local com IA.
      // Se já havia análise, ela permanece editável, mas fica desatualizada
      // automaticamente pelo fingerprint do relato atualizado.
      setRaw(before=>[before.trim(),latest].filter(Boolean).join('\n'));
      setCopied('');
      setStatus('Transcrição inserida. Confira e corrija o relato; a análise clínica só será gerada após tocar em Gerar com IA.');
      return;
    }
    const addition=buildVoiceAddition(latest,voiceDestination);
    if(!addition.content)return;
    setRaw(before=>[before.trim(),addition.target+': '+addition.content].filter(Boolean).join('\n'));
    setNarrative(previous=>appendVoiceToNote(previous,latest,voiceDestination,{caps:prefs.caps}));
    setManuallyEdited(true);
    setCopied('');
    setStatus('Ditado acrescentado a '+addition.target+' gratuitamente. Confira a evolução e gere o documento atualizado.');
  }
  function organize(){
    if(!raw.trim()){setStatus('Escreva, cole ou dite um relato fictício antes de gerar a evolução.');return;}
    if(manuallyEdited&&narrative.trim()&&!window.confirm('Reorganizar substituirá as alterações feitas no editor de evolução. A transcrição original será preservada. Continuar?'))return;
    setNarrative(formatNarrative(raw,{caps:prefs.caps}));
    setManuallyEdited(false);setNarrativeReviewed(false);
    setStatus('Evolução gerada do texto informado. Você pode editar tudo antes de copiar. Dados não informados permanecem vazios.');
  }
  function applyHda(){
    if(!confirmedHdaPhrases.length){setStatus('Informe somente detalhes clínicos efetivamente relatados pelo paciente.');return;}
    const current=narrative.trim()||formatNarrative(raw,{caps:prefs.caps});
    const result=insertHdaDetails(current,confirmedHdaPhrases,{caps:prefs.caps});
    if(result===current){
      setStatus('Não houve dados novos para inserir na HDA. Confira a evolução e evite informações repetidas.');
      return;
    }
    setNarrative(result);
    setManuallyEdited(true);setNarrativeReviewed(true);
    setHdaAnswers({});setHdaDuration('');setHdaDurationUnit('dias');setHdaSide('');setHdaExtra('');
    setShowHda(false);
    setStatus('História complementada com seus dados confirmados. Revise repetições ou divergências antes de copiar.');
  }
  function applyPlan(){
    if(!confirmedPlan.length){setStatus('Selecione apenas condutas efetivamente decididas, prescritas, solicitadas ou realizadas.');return;}
    const initial=narrative.trim()||formatNarrative(raw,{caps:prefs.caps});
    const updated=insertPlanDetails(initial,confirmedPlan,{caps:prefs.caps});
    if(updated===initial){
      setStatus('A conduta já contém esses registros ou a seção CONDUTA não foi encontrada. Confira o texto.');
      return;
    }
    setNarrative(updated);setManuallyEdited(true);setNarrativeReviewed(true);
    setPlanAnswers({});setPlanExtra('');setShowPlan(false);
    setStatus('Condutas selecionadas inseridas no texto. Confira pertinência, execução e detalhes antes de copiar.');
  }
  function applyFindings(){
    const toInsert=selectedExamFindings;
    if(!toInsert.length){setStatus('Confirme apenas os achados que você realmente examinou.');return;}
    const current=narrative.trim()||formatNarrative(raw,{caps:prefs.caps});
    const replaced=insertConfirmedExam(current,toInsert,{caps:prefs.caps});
    if(current===replaced){
      setStatus('Não encontrei a seção "EXAME FÍSICO". Organize a evolução antes de complementar.');
      return;
    }
    setNarrative(replaced);
    setManuallyEdited(true);setNarrativeReviewed(true);
    setConfirmed([]);setExamSelections({});
    setShowFindings(false);setShowSpecialTests(false);
    setStatus('Achados confirmados acrescentados ao exame. Revise a evolução.');
  }
  async function generateWithAi(){
    if(!canGenerateAi){
      setStatus('IA grátis da Groq ainda indisponível. Nenhuma IA paga será usada.');
      return;
    }
    if(!aiConsent){setStatus('Confirme o relato fictício e, na Groq, que sua conta continua no plano Free.');return;}
    const source=buildClinicalSource({raw,narrative,complement:simpleComplement,narrativeReviewed});
    if(source.length<20||source.length>6000){
      setStatus('Informe um caso fictício entre 20 caracteres e 6 mil caracteres.');
      return;
    }
    if(aiBusy)return;
    if((aiDraft.trim()||Object.values(aiDocuments).some(x=>x.trim()))&&!window.confirm('Gerar novamente substituirá os rascunhos anteriores. No plano grátis, também consome cota Groq. Continuar?'))return;
    setAiBusy(true);setStatus('Gerando com a cota grátis Groq. Nenhuma IA paga será acionada.');
    const controller=new AbortController();
    aiController.current=controller;
    const oldNarrative=narrative;
    const initialContext=requestContextRef.current;
    try{
      const {data,error}=await supabase.auth.getSession();
      if(error||!data?.session?.access_token)throw Error('Sessão expirada. Entre novamente.');
      const res=await fetch('/api/free-clinical',{
        method:'POST',
        headers:{'content-type':'application/json',authorization:'Bearer '+data.session.access_token},
        body:JSON.stringify({text:source,caps:Boolean(prefs.caps),consent:'fictitious_only',mode:viewMode==='simplificado'?'deep':fullAiScope,webEvidence,freePlanAcknowledged:true}),
        signal:controller.signal
      });
      const payload=await res.json().catch(()=>({}));
      if(controller.signal.aborted)return;
      if(!res.ok)throw Error(payload.error||'IA indisponível. A evolução original foi preservada.');
      if(!payload?.text||typeof payload.text!=='string')throw Error('A IA não retornou um texto válido.');
      if(payload.mode!=='bundle'||!payload.documents||typeof payload.documents!=='object')throw Error('A IA não devolveu o pacote completo. Nenhum documento foi alterado.');
      if(requestContextRef.current!==initialContext){
        // A consulta mudou durante a chamada: a resposta vai só para conferência.
        // Os documentos e a evolução atuais são preservados.
        setAiDraft(payload.text);
        setAiOriginalNarrative(oldNarrative);
        setStatus('A consulta foi alterada durante a análise. O texto anterior e os documentos foram preservados; revise a proposta separada antes de aplicar.');
        return;
      }
      setAiUndo(oldNarrative);
      setNarrative(payload.text);
      setManuallyEdited(true);
      setAiDraft('');
      setAiDocuments(Object.fromEntries(AI_DOCUMENT_NAMES.map(doc=>[doc.id,typeof payload.documents[doc.id]==='string'?payload.documents[doc.id]:''])));
      setAiPending(typeof payload.pendencias==='string'?payload.pendencias:'');
      setAiWarnings(Array.isArray(payload.warnings)?payload.warnings.slice(0,8):[]);
      setAiReferences(Array.isArray(payload.references)?payload.references.filter(x=>/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/.test(x?.url||'')).slice(0,2):[]);
      setEvidenceStatus(typeof payload.evidence_status==='string'?payload.evidence_status:'disabled');
      setNarrativeReviewed(false);
      setAiSourceEvidence(clinicalInputFingerprint({raw,narrative:payload.text,complement:simpleComplement,narrativeReviewed:false}));
      setAiOriginalNarrative(oldNarrative);
      setStatus('Groq — cota Free: uma chamada, '+Number(payload.usage?.input_tokens||0)+' tokens de entrada e '+Number(payload.usage?.output_tokens||0)+' de saída. Revise antes de usar.');
    }catch(error){
      if(controller.signal.aborted)return;
      setStatus(error?.message||'Não foi possível gerar com IA. Nenhuma evolução foi substituída.');
    }finally{
      if(aiController.current===controller)aiController.current=null;
      if(!controller.signal.aborted)setAiBusy(false);
    }
  }
  function applyAiDraft(){
    if(!aiDraft.trim())return;
    const originalChanged=(narrative!==aiOriginalNarrative);
    if(originalChanged&&!window.confirm('Você modificou a evolução depois de solicitar o rascunho. Aplicar a IA vai substituir essas alterações. Continuar?'))return;
    setAiUndo(narrative);
    setNarrative(aiDraft);
    setManuallyEdited(true);setNarrativeReviewed(false);setCopied('');
    setAiDraft('');setAiOriginalNarrative('');
    setStatus('Rascunho da IA aplicado. Revise todos os dados antes de copiar; você pode desfazer.');
  }
  function restoreAiUndo(){
    if(aiUndo===null)return;
    setNarrative(aiUndo);setManuallyEdited(true);setNarrativeReviewed(true);setAiUndo(null);
    setStatus('Versão anterior da evolução restaurada.');
  }
  function selectDocument(id){
    if(id==='conduta'){
      if(getPlanGroups(complaintHint?.id))setPlanRegionChoice(complaintHint.id);
      setShowPlan(true);
      setStatus('Conduta ortopédica: confirme somente as ações decididas, solicitadas ou realizadas. Nenhum tratamento foi escolhido automaticamente.');
      document.querySelector('.q-plan')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    const action=QUICK_ACTIONS.find(item=>item.id===id&&item.clinical);
    if(!action)return;
    const source=narrative.trim();
    const safeSuggestions=aiResultsOutdated?{}:aiDocuments;
    const fingerprint=source+'\n--RELATO ORIGINAL--\n'+raw.trim()+'\n--SUGESTÃO IA--\n'+String(safeSuggestions[AI_DOCUMENT_LINKS[id]]||'');
    const already=Object.prototype.hasOwnProperty.call(docs,id);
    if(already&&docSources[id]!==fingerprint){
      if(!window.confirm('A consulta mudou desde que este documento foi criado. Atualizar com a história atual? Isso substitui edições feitas neste modelo.')) {
        setDocType(id);setStatus('Documento anterior preservado. Toque em Atualizar do relato quando desejar.');return;
      }
    }
    if(!already||docSources[id]!==fingerprint){
      setDocs(prev=>({...prev,[id]:buildContextualDocument(id,{caps:prefs.caps,clinicalText:source,rawText:raw,aiDocuments:safeSuggestions})}));
      setDocSources(prev=>({...prev,[id]:fingerprint}));
    }
    setDocType(id);
    setStatus(aiResultsOutdated?'Consulta alterada: '+action.name+' preparado sem sugestões antigas da IA. Revise os campos.':action.name+' preparado com o contexto atual, sem nova chamada à IA. Revise antes de copiar.');
  }
  function resetDocument(){
    if(!docType)return;
    if(!window.confirm('Recriar este modelo apagará apenas as alterações deste documento temporário. Continuar?'))return;
    const source=narrative.trim();
    const safeSuggestions=aiResultsOutdated?{}:aiDocuments;
    const fingerprint=source+'\n--RELATO ORIGINAL--\n'+raw.trim()+'\n--SUGESTÃO IA--\n'+String(safeSuggestions[AI_DOCUMENT_LINKS[docType]]||'');
    setDocs(prev=>({...prev,[docType]:buildContextualDocument(docType,{caps:prefs.caps,clinicalText:source,rawText:raw,aiDocuments:safeSuggestions})}));
    setDocSources(prev=>({...prev,[docType]:fingerprint}));
    setStatus('Modelo recriado usando a história clínica e o relato original atuais. Confira os dados.');
  }
  async function copy(value,what,target){
    if(what!=='Evolução'&&what!=='Transcrição' && String(value||'').includes('[PREENCHER]')){
      if(!window.confirm('O documento contém campos [PREENCHER]. Revise-os antes do uso. Deseja copiar mesmo assim para completar no sistema de destino?'))return;
    }
    try{await putClipboard(value,target);
      setCopied(what);setStatus(what+' copiado. Confira o texto no prontuário de destino.');
    }catch(err){setStatus(err?.message||'Falha ao copiar.');}
  }
  async function clearSession(){
    if(hasContent&&!window.confirm('Encerrar consulta e apagar o conteúdo desta aba? Confira se já copiou tudo para o prontuário do hospital. Essa ação não pode ser desfeita.'))return;
    if(temporarySync.active){
      const removed=await temporarySync.clearRemote();
      if(!removed){setStatus('A consulta não foi apagada porque a sincronização temporária falhou. Tente novamente antes de limpar esta aba.');return;}
    }
    aiController.current?.abort();aiController.current=null;
    setAiBusy(false);setAiDraft('');setAiDocuments({});setAiPending('');setAiWarnings([]);setAiSourceEvidence(null);setAiReferences([]);setEvidenceStatus('disabled');setAiConsent(false);setAiOriginalNarrative('');setAiUndo(null);
    setRaw('');setNarrative('');setNarrativeReviewed(false);setSimpleComplement('');setDocs({});setDocSources({});setDocType(null);
    setConfirmed([]);setExamSelections({});setManuallyEdited(false);setCopied('');
    setShowFindings(false);setShowSpecialTests(false);setMicOpen(true);setVoiceDestination('HDA');
    setShowHda(false);setHdaRegionChoice('');setHdaAnswers({});setHdaDuration('');setHdaDurationUnit('dias');setHdaSide('');setHdaExtra('');
    setShowPlan(false);setPlanRegionChoice('');setPlanAnswers({});setPlanExtra('');
    setExamRegion('joelho');
    setVoiceEpoch(n=>n+1);
    setStatus('Consulta temporária encerrada e limpa.');
  }
  function changeSection(next){
    if(next===section)return;
    if(next!=='consulta' && hasContent && !window.confirm('Antes de abrir configurações, confira se o ditado já foi finalizado. O texto nesta aba permanecerá até você limpar, sair ou atualizar a página. Continuar?'))return;
    setSection(next);
  }
  async function savePrefs(e){
    e.preventDefault();
    if(demo){setPrefStatus('Na demonstração, as preferências valem apenas para esta aba.');return;}
    if(!configured||!profile?.user_id){setPrefStatus('Não é possível salvar: conta indisponível.');return;}
    try{
      const {data}=await supabase.auth.getSession();const token=data?.session?.access_token;
      if(!token)throw Error('Entre novamente para salvar suas preferências.');
      const response=await fetch('/api/preferences',{method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({specialty:prefs.specialty,caps:prefs.caps,format:'Narrativo'}),signal:AbortSignal.timeout(15000)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(result.error||'Não foi possível salvar as preferências.');
      setPrefStatus('Preferências salvas. Nenhum conteúdo clínico foi enviado.');
    }catch(error){setPrefStatus(error.name==='TimeoutError'?'A gravação demorou demais. Tente novamente.':error.message);}
  }
  function logout(){
    if(hasContent&&!window.confirm(temporarySync.active?'Sair não apaga a consulta sincronizada: ela continuará disponível por até 24 horas na sua conta. Confirmar saída?':'Sair descartará o conteúdo clínico temporário desta aba. Confirma que já copiou tudo?'))return;
    aiController.current?.abort();
    onLogout();
  }
  const focusDoc=QUICK_ACTIONS.find(d=>d.id===docType)||DOCUMENT_TYPES.find(d=>d.id===docType);
  const visibleDocs=QUICK_ACTIONS;
  const finalDocuments={
    ...aiDocuments,...docs,
    medicacao:docs.receita||aiDocuments.medicacao||'',
    afastamento:docs.atestado||aiDocuments.afastamento||''
  };
  const sectionOptions=REGIONS.map(r=><option key={r.id} value={r.id}>{r.name}</option>);
  return <div className="qapp">
    <header className="q-top">
      <div className="q-brand" onClick={()=>changeSection('consulta')} role="presentation">
        <span className="brand-mark"><Activity size={19}/></span>
        <span>Prontuário<span className="brand-blue">.IA</span></span>
      </div>
      <div className="q-top-actions">
        <span className="q-test-label">TESTE</span>
        <button className="q-icon" type="button" aria-label="Configurações" title="Configurações" onClick={()=>changeSection(section==='config'?'consulta':'config')}><Settings size={19}/></button>
        {profile?.role==='admin'&&!demo&&<button className="q-icon" type="button" aria-label="Administração" title="Administração" onClick={()=>changeSection(section==='admin'?'consulta':'admin')}><ShieldCheck size={19}/></button>}
        <button className="q-icon" type="button" aria-label="Sair" title="Sair" onClick={logout}><LogOut size={19}/></button>
      </div>
    </header>
    {(section==='consulta'||section==='receitas')&&<nav className="q-view-modes" aria-label="Modo de atendimento">
      <button type="button" className={section==='consulta'&&viewMode==='simplificado'?'selected':''} onClick={()=>{setSection('consulta');setViewMode('simplificado');}}>Simplificado</button>
      <button type="button" className={section==='consulta'&&viewMode==='completo'?'selected':''} onClick={()=>{setSection('consulta');setViewMode('completo');}}>Completo</button>
      <button type="button" className={section==='receitas'?'selected':''} onClick={()=>setSection('receitas')}>Receituário pronto</button>
      <span>Mesmo contexto clínico · sem uso de IA para pesquisar receitas</span>
    </nav>}
    {section!=='consulta'?<main className={section==='receitas'?'q-page q-recipes-page':'q-page'}>
      <button type="button" className="btn outline small" onClick={()=>setSection('consulta')}><ArrowLeft size={15}/> Voltar à consulta</button>
      {section==='admin'?<Suspense fallback={<p>Carregando administração...</p>}><AdminPanel/></Suspense>:
      section==='receitas'?<PrescriptionCatalog/>:
      <section className="q-box q-settings">
        <h2>Preferências</h2>
        <p>Somente estas configurações podem ser guardadas na nuvem. Nunca são incluídas informações de pacientes.</p>
        <form onSubmit={savePrefs} className="q-stack">
          <label>Especialidade
            <select value={prefs.specialty} onChange={e=>setPrefs(p=>({...p,specialty:e.target.value}))}>
              {SPECIALTIES.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="q-check"><input type="checkbox" checked={prefs.caps} onChange={e=>setPrefs(p=>({...p,caps:e.target.checked}))}/><span>Gerar textos em MAIÚSCULAS</span></label>
          <button className="btn primary" type="submit"><Check size={16}/> Salvar preferências</button>
          {prefStatus&&<p className="q-feedback">{prefStatus}</p>}
        </form>
      </section>}
    </main>:viewMode==='simplificado'?<SimpleWorkspace
      raw={raw} setRaw={setRaw} complement={simpleComplement} setComplement={setSimpleComplement}
      narrative={narrative} setNarrative={setNarrative}
      onNarrativeEdit={()=>{setManuallyEdited(true);setNarrativeReviewed(true);setCopied('');}}
      onTranscript={onTranscript} voiceEpoch={voiceEpoch}
      aiConsent={aiConsent} setAiConsent={setAiConsent} aiBusy={aiBusy}
      userAiAllowed={canGenerateAi} generateWithAi={generateWithAi}
      freeAiAvailable={freeAiAvailable}
      aiResultReady={aiSourceEvidence!==null}
      aiDocuments={aiDocuments} setAiDocuments={setAiDocuments} finalDocuments={finalDocuments}
      aiPending={aiPending} setAiPending={setAiPending} aiWarnings={aiWarnings} aiResultsOutdated={aiResultsOutdated}
      webEvidence={webEvidence} setWebEvidence={setWebEvidence} aiReferences={aiReferences} evidenceStatus={evidenceStatus}
      aiDraft={aiDraft} setAiDraft={setAiDraft} applyAiDraft={applyAiDraft}
      undoAvailable={aiUndo!==null} undoAi={restoreAiUndo}
      copy={copy} clearSession={clearSession} status={status}
      syncPanel={<TemporarySessionPanel sync={temporarySync} demo={demo}/>}
    />:<main className="q-page q-consult">
      <div className="q-intro">
        <div>
          <h1>Atendimento rápido</h1>
          <p>Escreva ou fale, gere a evolução e copie. Sem cadastro de pacientes.</p>
        </div>
        <span className="q-local"><LockKeyhole size={13}/> Revise antes de copiar</span>
      </div>
      <TemporarySessionPanel sync={temporarySync} demo={demo}/>
      <section className="q-mic-section q-voice-primary">
        <div className="q-voice-intro"><span><Mic size={20}/> <strong>Ditado da consulta</strong></span><span className="q-local">Gratuito · sem tokens de IA</span></div>
        <p className="q-voice-explain">Fale o relato e acrescente novos achados à evolução. O texto anterior é preservado.</p>
        <label className="q-voice-destination">Onde inserir o próximo ditado?
          <select aria-label="Escolher seção para inserir a fala" value={voiceDestination}
            onChange={e=>setVoiceDestination(e.target.value)}>
            {VOICE_TARGETS.map(t=><option value={t.id} key={t.id}>{t.label}</option>)}
          </select>
        </label>
        <button type="button" className="q-toggle" aria-expanded={micOpen}
          onClick={()=>{if(micOpen&&!window.confirm('Ocultar o microfone encerra o ditado e descarta somente a transcrição ainda não inserida. Continuar?'))return;setMicOpen(v=>!v);}}>
          <span><Mic size={17}/> {micOpen?'Ocultar gravador':'Abrir microfone gratuito'}</span>{micOpen?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
        </button>
        {micOpen&&<div className="q-voice"><VoiceInput key={voiceEpoch} onInsertTranscript={onTranscript}/></div>}
        <p className="q-voice-explain">Para condensar a história com IA, use depois o botão opcional “Gerar com IA”. O microfone sozinho não usa créditos OpenAI.</p>
      </section>
      <section className="q-box q-write">
        <div className="q-box-title">
          <div><h2><FileText size={19}/> Digitar ou revisar relato</h2><p>Alternativa ao ditado: escreva livremente ou use QUEIXA, HDA, EXAME, RX e CD.</p></div>
        </div>
        <textarea id="q-raw" rows="6" aria-label="Digite, cole ou revise informações da consulta" value={raw}
          onChange={e=>{setRaw(e.target.value);setCopied('');}}
          placeholder="Ex.: Paciente com dor no joelho direito após entorse hoje. Dor à palpação, sem derrame articular. RX sem fratura. Conduta: analgesia e orientações."/>
        <div className="q-write-actions">
          <button className="btn primary" type="button" onClick={organize} disabled={!raw.trim()}><WandSparkles size={17}/> Gerar evolução</button>
          <button className="btn outline" type="button" onClick={()=>copy(raw,'Texto original',document.querySelector('#q-raw'))} disabled={!raw.trim()}><Copy size={15}/> Copiar como está</button>
        </div>
      </section>
      <section className="q-ai">
        <div className="q-voice-destination"><strong>Groq — somente cota gratuita</strong><br/><span>Nenhuma IA paga será acionada nesta versão de testes.</span></div>
        <label className="q-voice-destination">Objetivo desta geração
          <select aria-label="Tipo de análise clínica" value={fullAiScope} disabled={aiBusy} onChange={e=>setFullAiScope(e.target.value)}>
            <option value="deep">Análise clínica aprofundada (padrão)</option>
            <option value="bundle">Evolução e documentos em pacote</option>
          </select>
        </label>
        <label className="q-check q-evidence-option"><input type="checkbox" checked={webEvidence} disabled={aiBusy}
          onChange={e=>setWebEvidence(e.target.checked)}/>
          <span>Consultar até 2 referências do PubMed (gratuito, opcional). Somente um tema genérico vai à busca; não envia detalhes da consulta.</span>
        </label>
        <div className="q-ai-row">
          <button className="btn outline" type="button" onClick={generateWithAi}
            disabled={!canGenerateAi||aiBusy||!aiConsent||!(raw.trim()||narrative.trim())}>
            <Sparkles size={17}/>{aiBusy?' Analisando caso...':fullAiScope==='deep'?' Analisar caso com IA (1 chamada)':' Gerar documentos com IA (1 chamada)'}
          </button>
          <label className="q-ai-consent">
            <input type="checkbox" checked={aiConsent} onChange={e=>setAiConsent(e.target.checked)}/>
            <span>Confirmo que o caso é fictício e minha conta Groq continua no plano Free.</span>
          </label>
        </div>
        <p className="q-mode-hint">{freeAiAvailable===null?'Verificando a disponibilidade gratuita...'
          :freeAiAvailable?'Groq Free: consome somente a cota gratuita disponível; não existe troca automática para serviço pago.'
          :'Groq Free não está habilitada no servidor. Nenhuma IA paga será usada.'}</p>
        {aiDraft&&<div className="q-ai-preview">
          <div className="q-doc-title"><strong>Rascunho da IA — revisar e editar</strong>
            <button className="q-icon" type="button" aria-label="Descartar rascunho da IA" onClick={()=>setAiDraft('')}><X size={16}/></button>
          </div>
          <textarea aria-label="Rascunho de evolução gerada com IA" rows="10" value={aiDraft}
            onChange={e=>setAiDraft(e.target.value)}/>
          <p>Confira números, lateralidade, exame físico e conduta. A IA não substitui seu julgamento.</p>
          <div className="q-doc-actions">
            <button className="btn primary" type="button" onClick={applyAiDraft}><Check size={16}/> Aplicar na evolução</button>
            <button className="btn outline" type="button" onClick={()=>setAiDraft('')}><X size={15}/> Descartar evolução sugerida</button>
          </div>
        </div>}
        {evidenceStatus!=='disabled'&&<div className="q-clinical-review">
          <strong>Fontes on-line (PubMed)</strong>
          {aiReferences.length>0?
            <ul>{aiReferences.map(ref=><li key={ref.pmid}><a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.title} ({ref.year||'sem ano'}) — PMID {ref.pmid}</a></li>)}</ul>
            :<p>Nenhuma referência recuperada nesta consulta. A análise deve ser conferida sem respaldo de pesquisa on-line.</p>}
          <p>Referências de tema geral: não substituem protocolos brasileiros ou avaliação individual.</p>
        </div>}
        {aiWarnings.length>0&&<div className="q-clinical-review" role="alert"><strong>Conferência clínica obrigatória</strong>
          <ul>{aiWarnings.map((w,i)=><li key={i}>{w}</li>)}</ul></div>}
        {aiResultsOutdated&&<p className="q-clinical-review" role="status">O relato foi alterado depois da geração. Revise os documentos antigos antes de usar.</p>}
        {(AI_DOCUMENT_NAMES.some(doc=>aiDocuments[doc.id]?.trim())||aiPending.trim())&&<div className="q-ai-bundle">
          <div className="q-ai-bundle-header"><strong><ClipboardList size={17}/> Documentos da mesma chamada</strong>
            <span>Sem custo adicional para editar ou copiar</span></div>
          <p>Propostas não validadas. Medicações, fisioterapia e afastamento exigem confirmação clínica individual. Não são prescrições, pedidos ou atestados emitidos.</p>
          {aiPending.trim()&&<div className="q-ai-pending"><strong>Dados a confirmar</strong><textarea rows="3" aria-label="Dados pendentes da IA" value={aiPending} onChange={e=>setAiPending(e.target.value)}/></div>}
          {AI_DOCUMENT_NAMES.filter(doc=>aiDocuments[doc.id]?.trim()).map(doc=><details key={doc.id} className="q-ai-document">
            <summary>{doc.name} <span>Revisar</span></summary>
            <textarea rows="6" aria-label={'Proposta de '+doc.name} value={aiDocuments[doc.id]}
              onChange={e=>setAiDocuments(prev=>({...prev,[doc.id]:e.target.value}))}/>
          </details>)}
          <p>Se você acrescentar dados à consulta após gerar o pacote, revise estas propostas; elas não são atualizadas automaticamente. Nova geração só ocorre após novo clique e poderá ter custo.</p>
        </div>}
      </section>
      <section className="q-box q-evolution">
        <div className="q-box-title">
          <div>
            <h2><FileText size={19}/> Evolução médica</h2>
            <p>Texto corrido por seção. Você pode tocar e editar qualquer palavra.</p>
          </div>
        </div>
        <textarea id="q-narrative" rows="12" value={narrative} aria-label="Evolução clínica editável"
          onChange={e=>{setNarrative(e.target.value);setManuallyEdited(true);setNarrativeReviewed(true);setCopied('');}}
          placeholder={'QUEIXA:\n\nHDA:\n\nEXAME FÍSICO:\n\nCONDUTA:\n\nEscreva ou dite o relato acima e toque em Gerar evolução.'}/>
        <div className="q-editor-info"><span>{wordCount(narrative)} palavras</span><span>{manuallyEdited?'Edição manual':'Revisar antes de copiar'}</span></div>
        {aiUndo!==null&&<button type="button" className="btn outline small q-ai-undo" onClick={restoreAiUndo}><RotateCcw size={14}/> Desfazer aplicação da IA</button>}
      </section>
      <section className="q-hda">
        <button className="q-toggle" type="button" onClick={()=>setShowHda(v=>!v)} aria-expanded={showHda}>
          <span><ClipboardList size={17}/> Complementar história (HDA)</span>{showHda?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
        </button>
        {showHda&&<div className="q-hda-body">
          <p>Preencha somente informações obtidas na história. Todos os itens são opcionais e ficarão editáveis na evolução.</p>
          <label>Queixa / região
            <select aria-label="Escolher modelo de história clínica" value={hdaRegion} onChange={e=>{
              setHdaRegionChoice(e.target.value);setHdaAnswers({});setHdaDuration('');setHdaSide('');setHdaExtra('');
            }}>
              <option value="">Escolher região</option>
              {HDA_REGIONS.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {hdaGroups&&<>
            <div className="q-hda-basics">
              <label>Tempo de evolução
                <input inputMode="numeric" type="number" min="1" max="9999" step="1"
                  placeholder="Ex.: 3" value={hdaDuration}
                  onChange={e=>setHdaDuration(e.target.value)}/>
              </label>
              <label>Unidade
                <select value={hdaDurationUnit} onChange={e=>setHdaDurationUnit(e.target.value)}>
                  <option value="horas">Horas</option><option value="dias">Dias</option>
                  <option value="semanas">Semanas</option><option value="meses">Meses</option>
                  <option value="anos">Anos</option>
                </select>
              </label>
              <label>Lado
                <select value={hdaSide} onChange={e=>setHdaSide(e.target.value)}>
                  <option value="">Não informado</option><option value="DIREITO">Direito</option>
                  <option value="ESQUERDO">Esquerdo</option><option value="BILATERAL">Bilateral</option>
                </select>
              </label>
            </div>
            <div className="q-finding-groups">
              {hdaGroups.map(group=><div className="q-finding-group" key={group.id}>
                <strong>{group.title}</strong>
                <div className="q-choices">
                  <button type="button" className={'q-choice'+(!hdaAnswers[group.id]?' selected':'')}
                    onClick={()=>setHdaAnswers(prev=>({...prev,[group.id]:null}))}>Não informado</button>
                  {group.choices.map(choice=><button key={choice} type="button"
                    className={'q-choice'+(hdaAnswers[group.id]===choice?' selected':'')}
                    onClick={()=>setHdaAnswers(prev=>({...prev,[group.id]:choice}))}>{choice}</button>)}
                </div>
              </div>)}
            </div>
            <label>Outro dado da história (opcional)
              <textarea rows="2" maxLength={500} value={hdaExtra} onChange={e=>setHdaExtra(e.target.value)}
                placeholder="Acrescente aqui apenas informações realmente relatadas."/>
            </label>
            <button className="btn outline" type="button" disabled={!confirmedHdaPhrases.length} onClick={applyHda}>
              <Check size={16}/> Inserir detalhes na HDA
            </button>
            <p className="q-source-hint">Nada é acrescentado sem sua seleção. Confira se os novos detalhes não contradizem o relato já escrito.</p>
          </>}
        </div>}
      </section>
      {complaintHint&&<div className="q-complaint-hint">
        <span><Stethoscope size={15}/> Queixa identificada: <strong>{complaintHint.label}</strong></span>
        {getHdaGroups(complaintHint.id)&&<button type="button" className="btn outline small" onClick={()=>{
          setHdaRegionChoice(complaintHint.id);setHdaAnswers({});setHdaDuration('');setHdaSide('');setHdaExtra('');
          setShowHda(true);setStatus('Escolha os detalhes de história que foram confirmados.');
        }}>Completar HDA</button>}
        <button type="button" className="btn outline small" onClick={()=>{
          const selected=REGIONS.find(r=>r.id===complaintHint.id||(complaintHint.id==='pe'&&r.id==='tornozelo')||(complaintHint.id==='dedo'&&r.id==='mao'));
          if(!selected)return;
          setExamRegion(selected.id);setConfirmed([]);setExamSelections({});setShowSpecialTests(false);setShowFindings(true);
          setStatus('Complementos de '+selected.name+' abertos. Selecione apenas achados efetivamente avaliados.');
        }}>Complementar {complaintHint.label.toLowerCase()}</button>
      </div>}
      <section className="q-exam">
        <div className="q-exam-header">
          <button className="q-toggle" type="button" onClick={()=>setShowFindings(v=>!v)} aria-expanded={showFindings}>
            <span><Stethoscope size={17}/> Complementar exame físico</span>{showFindings?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
          </button>
          <label className="q-region-select">Região / membro
            <select aria-label="Escolher região anatômica nesta consulta" value={examRegion}
              onChange={e=>{setConfirmed([]);setExamSelections({});setShowSpecialTests(false);setExamRegion(e.target.value);setShowFindings(true);}}>{sectionOptions}</select>
          </label>
        </div>
        {showFindings&&<div className="q-exam-body">
          <p>Marque <strong>somente achados efetivamente examinados</strong>. Nenhuma opção vem selecionada. Testes especiais exigem confirmação do resultado observado.</p>
          {examGroups&&<p className="q-source-hint">Roteiro documental baseado nas apostilas TEOT 2021 (joelho, ombro e pé/tornozelo). Conteúdo em revisão; não interpreta nem confirma diagnósticos.</p>}
          {examGroups
            ? <div className="q-finding-groups">
                {visibleExamGroups.map(group=><div className="q-finding-group" key={group.id}>
                  <strong>{group.title}</strong>
                  <div className="q-choices">
                    <button type="button" className={'q-choice'+(!examSelections[group.id]?' selected':'')}
                      onClick={()=>setExamSelections(prev=>({...prev,[group.id]:null}))}>Não informado</button>
                    {group.choices.map(choice=><button type="button" key={choice}
                      className={'q-choice'+(examSelections[group.id]===choice?' selected':'')}
                      onClick={()=>setExamSelections(prev=>({...prev,[group.id]:choice}))}>{choice}</button>)}
                  </div>
                </div>)}
                {specialTestCount>0&&<button type="button" className="q-special-toggle"
                  onClick={()=>setShowSpecialTests(v=>!v)}>
                  {showSpecialTests?'Ocultar testes especiais':'Ver testes especiais ('+specialTestCount+')'}
                  {showSpecialTests?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
                </button>}
              </div>
            : <div className="q-chip-grid">
                {currentRegion.findings.map(finding=><label className={'q-chip'+(confirmed.includes(finding)?' selected':'')} key={finding}>
                  <input type="checkbox" checked={confirmed.includes(finding)}
                    onChange={e=>setConfirmed(old=>{
                      if(!e.target.checked)return old.filter(v=>v!==finding);
                      const cleaned=finding.startsWith('LASÈGUE ')
                        ? old.filter(v=>!v.startsWith('LASÈGUE '))
                        : old;
                      return [...cleaned,finding];
                    })}/>
                  <span>{finding}</span>
                </label>)}
              </div>}
          <button type="button" className="btn outline" onClick={applyFindings}
            disabled={!selectedExamFindings.length}>
            <Check size={16}/> Inserir achados confirmados
          </button>
        </div>}
      </section>
      <section className="q-plan">
        <button type="button" className="q-toggle" aria-expanded={showPlan} onClick={()=>setShowPlan(v=>!v)}>
          <span><ClipboardList size={17}/> Complementar conduta / tratamento</span>
          {showPlan?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
        </button>
        {showPlan&&<div className="q-plan-body">
          <p>Escolha somente decisões que tomou, exames que solicitou e procedimentos realmente realizados. Estes são atalhos de documentação, não indicações automáticas.</p>
          <label>Queixa / região
            <select aria-label="Região anatômica para condutas" value={planRegion}
              onChange={e=>{setPlanRegionChoice(e.target.value);setPlanAnswers({});setPlanExtra('');}}>
              <option value="">Escolher região</option>
              {PLAN_REGIONS.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          {planGroups&&<>
            <div className="q-finding-groups">
              {planGroups.map(group=><div className="q-finding-group" key={group.id}>
                <strong>{group.title}</strong>
                {group.mode==='multiple'&&<small>É possível selecionar mais de um item.</small>}
                <div className="q-choices">
                  {group.mode==='single'
                    ? <>
                      <button type="button" className={'q-choice'+(!planAnswers[group.id]?' selected':'')}
                        onClick={()=>setPlanAnswers(prev=>({...prev,[group.id]:null}))}>Não informado</button>
                      {group.choices.map(choice=><button key={choice} type="button"
                        className={'q-choice'+(planAnswers[group.id]===choice?' selected':'')}
                        onClick={()=>setPlanAnswers(prev=>({...prev,[group.id]:choice}))}>{choice}</button>)}
                    </>
                    : group.choices.map(choice=>{
                      const checked=Array.isArray(planAnswers[group.id])&&planAnswers[group.id].includes(choice);
                      return <button key={choice} type="button" aria-pressed={checked}
                        className={'q-choice'+(checked?' selected':'')}
                        onClick={()=>setPlanAnswers(prev=>{
                          const old=Array.isArray(prev[group.id])?prev[group.id]:[];
                          return {...prev,[group.id]:checked?old.filter(v=>v!==choice):[...old,choice]};
                        })}>{checked?'✓ ':''}{choice}</button>;
                    })}
                </div>
              </div>)}
            </div>
            <label>Outros tratamentos, medicamentos e detalhes (opcional)
              <textarea rows="2" maxLength={500} value={planExtra} onChange={e=>setPlanExtra(e.target.value)}
                placeholder="Digite somente a conduta realmente definida, inclusive medicamento, dose ou procedimento se necessário."/>
            </label>
            <button className="btn outline" type="button" disabled={!confirmedPlan.length} onClick={applyPlan}>
              <Check size={16}/> Inserir na conduta
            </button>
            <p className="q-source-hint">Revisar antes de copiar: medicamento, dose, contraindicações, imobilização e destino dependem de avaliação médica. Selecionar uma opção não realiza nem prescreve uma ação.</p>
          </>}
        </div>}
      </section>
      <section className="q-box q-documents">
        <div className="q-box-title">
          <div><h2><ClipboardList size={19}/> Gerar documentos — grátis</h2><p>Um toque para preparar modelos editáveis. Sem IA, sem tokens e sem enviar o conteúdo para servidores.</p></div>
        </div>
        <div className="q-document-grid">
          {visibleDocs.map(doc=><button type="button" key={doc.id}
            className={'q-doc-button'+(docType===doc.id?' selected':'')} onClick={()=>selectDocument(doc.id)}>
            <ButtonIcon name={doc.id}/><span>{doc.name}</span>
          </button>)}
        </div>
        {docType&&<div className="q-doc-editor">
          <div className="q-doc-title"><strong>{focusDoc?.name||'Documento'} — rascunho</strong>
            <button className="q-icon" type="button" title="Fechar documento" aria-label="Fechar documento" onClick={()=>setDocType(null)}><X size={17}/></button>
          </div>
          <textarea rows="11" id="q-doc-text" aria-label="Documento médico editável" value={docs[docType]||''}
            onChange={e=>setDocs(old=>({...old,[docType]:e.target.value}))}/>
          <div className="q-doc-actions">
            <button className="btn outline" type="button" onClick={resetDocument}><RotateCcw size={15}/> Atualizar do relato</button>
          </div>
          <p>Os campos [PREENCHER] exigem preenchimento. Nenhuma dose, indicação terapêutica, diagnóstico ou período de afastamento foi inferido.</p>
        </div>}
      </section>
      <p className="q-feedback">Para copiar a evolução ou qualquer rascunho, use a Central de documentos finais abaixo.</p>
      <FinalPackage narrative={narrative} documents={finalDocuments} pending={aiPending} outdated={aiResultsOutdated} copy={copy}/>

      {status&&<p className="q-feedback" role="status">{status}</p>}
      {copied&&<p className="q-copied"><Check size={15}/> {copied} copiado para a área de transferência.</p>}
      <button className="q-clear" type="button" onClick={clearSession}><Trash2 size={16}/> Encerrar e limpar consulta</button>
      <p className="q-privacy"><AlertTriangle size={15}/> Apenas testes fictícios. A transcrição pelo Chrome pode usar servidores externos. O texto clínico fica somente na memória desta aba e é perdido ao atualizar, fechar ou sair. Dados de sessões antigas no Supabase seguem o prazo de expiração anterior.</p>
    </main>}
    <footer className="q-footer"><span>Prontuário.IA · Marco zero v{APP_VERSION}</span><span>Groq Free · Sem chamadas pagas · Uso experimental</span></footer>
  </div>;
}
