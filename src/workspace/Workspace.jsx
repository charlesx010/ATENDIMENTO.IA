import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Activity, Mic, FileText, Sparkles, CheckCheck, Cloud, CloudOff, Download, Copy, ArrowRight, LogOut, BookOpen, Plus, Settings, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase.js';
import { organizeNotesToSoap } from '../organizeSoap.js';
import { emptyConsultation, MAX_SOURCE, hasContent, canExport, exportNote, sourceChanged, parseConsultation } from './model.js';
import { useConsultationSync } from './useConsultationSync.js';
import './workspace.css';
const BrowserDictation = lazy(() => import('../BrowserDictation.jsx'));
const GroqRecorder = lazy(() => import('../GroqRecorder.jsx'));
const PrescriptionCatalog = lazy(() => import('../PrescriptionCatalog.jsx'));
const ExamAttachments = lazy(() => import('../ExamAttachments.jsx'));
const AdminPanel = lazy(() => import('../AdminPanel.jsx'));
const SOAP = { subjective:'S · História relatada', objective:'O · Exame e resultados informados', assessment:'A · Avaliação informada', plan:'P · Conduta informada' };
const SYNC = {disabled:'Somente nesta aba',loading:'Conectando…',pending:'Alterações pendentes',syncing:'Salvando…',synced:'Sincronizado',offline:'Sem conexão',conflict:'Conflito entre aparelhos',error:'Sincronização indisponível',expired:'Sessão expirada'};
const SAMPLE = 'Paciente fictício relata dor no joelho direito há três dias após corrida. Nega febre. Ao exame: edema discreto, sem deformidade descrita. Hipótese diagnóstica: lesão por sobrecarga a esclarecer. Conduta: orientado repouso relativo e retorno para reavaliação. Alergias e medicamentos em uso não informados.';
function download(name, text, type='text/plain') {
  const url = URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function Workspace({demo=false,profile,onLogout}) {
  const [doc,setDoc] = useState(emptyConsultation);
  const [tab,setTab]=useState('consultation'), [stage,setStage]=useState('capture'), [voice,setVoice]=useState('browser');
  const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [online,setOnline]=useState(navigator.onLine),[aiAvailable,setAiAvailable]=useState(false),[aiProposal,setAiProposal]=useState(null);
  const [confirmNew,setConfirmNew]=useState(false),[showSync,setShowSync]=useState(false),[voicePending,setVoicePending]=useState(false);
  const latest=useRef(doc),request=useRef(null); latest.current=doc;
  const sync=useConsultationSync({enabled:!demo,userId:profile?.user_id,doc,setDoc});
  useEffect(()=>{
    if(!confirmNew)return;
    const previous=document.activeElement;
    const dialog=document.querySelector('.w-modal');
    const focusable=()=>[...dialog.querySelectorAll('button:not(:disabled),[href],input:not(:disabled)')];
    focusable()[0]?.focus();
    const handle=e=>{if(e.key==='Escape')setConfirmNew(false);if(e.key==='Tab'){const items=focusable(),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};
    dialog.addEventListener('keydown',handle);
    return()=>{dialog.removeEventListener('keydown',handle);previous?.focus()};
  },[confirmNew]);

  useEffect(()=>{const fn=()=>setOnline(navigator.onLine);window.addEventListener('online',fn);window.addEventListener('offline',fn);return()=>{window.removeEventListener('online',fn);window.removeEventListener('offline',fn);request.current?.abort();};},[]);
  useEffect(()=>{let alive=true;fetch('/api/organize-note').then(r=>r.ok?r.json():null).then(v=>{if(alive)setAiAvailable(v?.available===true);}).catch(()=>{});return()=>{alive=false};},[]);
  useEffect(()=>{const fn=e=>{if(hasContent(latest.current)){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',fn);return()=>window.removeEventListener('beforeunload',fn);},[]);
  function patch(fields) { setDoc(d=>({...d,...fields,reviewed:false}));setMessage(''); }
  function insert(text) {
    const source=(latest.current.source ? latest.current.source+'\n' : '')+text;
    if(source.length>MAX_SOURCE){setMessage('O relato excederia 6.000 caracteres. Reduza-o antes de inserir; a transcrição foi preservada no gravador.');return false;}
    setDoc(d=>sourceChanged(d,source));setMessage('Transcrição inserida. Confira números, negações e lateralidade.');return true;
  }
  function organizeLocal() {
    const {sections}=organizeNotesToSoap(doc.source);
    patch({summary:'',soap:Object.fromEntries(Object.keys(SOAP).map(k=>[k,sections[k].join('\n')])),pending:sections.unclassified.join('\n'),generatedFrom:doc.source,origin:'local'});
    setStage('review');setMessage('Organização literal concluída, sem IA. Trechos não classificados estão em pendências.');
  }
  async function organizeAI() {
    if(busy)return;
    const source=doc.source;
    setBusy(true);setMessage('Organizando o relato. Você poderá conferir o resultado antes de aplicá-lo.');
    const abort=new AbortController();request.current=abort;
    const timer=setTimeout(()=>abort.abort(),42000);
    try {
      const {data}=await supabase.auth.getSession();const token=data?.session?.access_token;
      if(!token)throw Error('Sua sessão expirou. Entre novamente.');
      const r=await fetch('/api/organize-note',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({text:source,consent:'fictitious_only',freePlanAcknowledged:consent}),signal:abort.signal});
      const result=await r.json().catch(()=>({}));if(!r.ok)throw Error(result.error||'Não foi possível organizar.');
      const n=result.note;
      if(!n||['summary',...Object.keys(SOAP),'pending'].some(k=>typeof n[k]!=='string'||n[k].length>8000))throw Error('Resposta de IA inválida.');
      setAiProposal({source,note:n});setStage('review');setMessage('Rascunho de IA recebido. Compare com o relato e escolha Aplicar.');
    }catch(e){setMessage(e.name==='AbortError'?'Operação cancelada ou tempo excedido. Seu conteúdo foi preservado.':e.message);}
    finally{clearTimeout(timer);setBusy(false);request.current=null;}
  }
  function applyAI(){
    if(!aiProposal||aiProposal.source!==doc.source){setMessage('O relato mudou. Gere novamente para evitar um resumo desatualizado.');return;}
    const n=aiProposal.note;
    patch({summary:n.summary,soap:Object.fromEntries(Object.keys(SOAP).map(k=>[k,n[k]])),pending:n.pending,generatedFrom:aiProposal.source,origin:'ai'});setAiProposal(null);
  }
  async function newConsultation(){
    if(sync.phase!=='disabled'){const cleared=await sync.clear();if(!cleared){setMessage('Não foi possível encerrar a sessão na nuvem. Aguarde a gravação, verifique a conexão ou resolva o conflito antes de tentar.');setConfirmNew(false);return;}}
    request.current?.abort();setDoc(emptyConsultation());setAiProposal(null);setStage('capture');setConfirmNew(false);setMessage('Nova consulta iniciada.');
  }
  async function importBackup(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{if(file.size>100000)throw Error('Backup excede o limite permitido.');const imported=parseConsultation(JSON.parse(await file.text()));if(hasContent(doc)&&!window.confirm('Importar substitui o conteúdo desta aba. Você já preservou o rascunho atual?'))return;setDoc({...imported,reviewed:false});setMessage('Backup importado. Revise novamente antes de exportar.');setTab('consultation');setStage('capture');}catch(e){setMessage(e.message||'Backup inválido.');}
  }
  const stale=Boolean(doc.generatedFrom)&&doc.generatedFrom!==doc.source;
  const exportAllowed=canExport(doc);
  async function copy(){try{await navigator.clipboard.writeText(exportNote(doc));setMessage('Prontuário revisado copiado.');}catch{setMessage('O navegador não permitiu copiar. Use Baixar texto.');}}
  function navigate(action){if(voicePending&&!window.confirm('Há gravação ou transcrição ainda não inserida. Continuar descarta esse conteúdo do microfone.'))return;setVoicePending(false);action();}
  const leave=()=>{if(hasContent(doc)&&!window.confirm('Sair descarta o conteúdo desta aba. Exporte um backup ou confirme que a consulta está sincronizada antes de sair. Continuar?'))return;onLogout();};
  return <div className="workspace-v2">
    <aside className="w-sidebar"><a className="w-brand" href="/" onClick={e=>{e.preventDefault();navigate(()=>setTab('consultation'))}}><span><Activity/></span><div>Prontuário<span>.IA</span><small>ASSISTENTE DE DOCUMENTAÇÃO</small></div></a>
      <p className="w-nav-label">ÁREA DE TRABALHO</p>
      <nav aria-label="Navegação principal"><button className={tab==='consultation'?'active':''} onClick={()=>navigate(()=>setTab('consultation'))}><FileText size={19}/> Consulta</button><button className={tab==='catalog'?'active':''} onClick={()=>navigate(()=>setTab('catalog'))}><BookOpen size={19}/> Receituário</button><button className={tab==='settings'?'active':''} onClick={()=>navigate(()=>setTab('settings'))}><Settings size={19}/> Configuração</button></nav>
      <div className="w-sidebar-note"><Cloud size={20}/><strong>Do celular ao computador</strong><p>A mesma conta, uma consulta temporária. Ative a sincronização para continuar em outro aparelho.</p></div>
      <div className="w-account"><span className="w-avatar">{(profile?.display_name||'D').slice(0,1)}</span><div><strong>{demo?'Demonstração':profile?.display_name}</strong><small>{demo?'Sem conexão com a nuvem':'Conta individual'}</small></div><button onClick={leave} aria-label="Sair"><LogOut size={18}/></button></div>
    </aside>
    <div className="w-main"><header className="w-topbar"><span><span className="w-mobile-brand">Prontuário.IA · </span>Seu espaço de atendimento</span><div><span className="w-test-badge">AMBIENTE DE TESTES</span><button className="w-sync-button" onClick={()=>setShowSync(v=>!v)} aria-expanded={showSync}>{sync.phase==='synced'?<Cloud size={16}/>:<CloudOff size={16}/>}<span>{online?SYNC[sync.phase]:'Sem conexão'}</span></button></div></header>
    <main className="w-content">
      {showSync&&<section className="w-card w-sync-panel" aria-label="Sincronização"><h2>Continue em outro aparelho</h2><p>{demo?'O modo demonstração mantém tudo somente na memória desta aba. Entre com sua conta para sincronizar.':'A sincronização guarda somente o texto na sua conta por 24 horas desde a criação. Áudio não é sincronizado. A atualização é verificada a cada 4 segundos enquanto a aba está ativa.'}</p>
        {sync.expiresAt&&<p>Expira em {new Date(sync.expiresAt).toLocaleString('pt-BR')}.</p>}
        {!demo&&sync.phase==='disabled'&&<button className="w-button primary" onClick={sync.connect}>Ativar sincronização</button>}
        {['error','offline'].includes(sync.phase)&&<button className="w-button" onClick={sync.retry}>Tentar novamente</button>}
        {sync.phase==='expired'&&<p>A sessão expirou. Exporte seu rascunho e recarregue a página para iniciar uma nova sessão.</p>}
      </section>}
      {sync.phase==='conflict'&&<section className="w-alert" role="alert"><strong>Outra versão está na nuvem. Seu texto local foi preservado.</strong><p>Baixe um backup local antes de carregar a versão do outro aparelho. Não fazemos mescla automática de informações clínicas.</p><div className="w-actions"><button className="w-button" onClick={()=>download('consulta-conflito-local.json',JSON.stringify(doc,null,2),'application/json')}>Baixar backup local</button>{sync.remote&&<button className="w-button" onClick={()=>{if(window.confirm('Carregar a nuvem substitui esta aba. Você já salvou o conteúdo local que deseja preservar?'))sync.reload()}}>Carregar versão da nuvem</button>}</div></section>}
      {message&&<div className="w-message" role="status"><AlertCircle size={17}/>{message}<button onClick={()=>setMessage('')} aria-label="Fechar mensagem">×</button></div>}
      {tab==='consultation'&&<>
        <div className="w-heading"><div><div className="w-eyebrow">MENOS DIGITAÇÃO. MAIS ATENÇÃO.</div><h1>Uma consulta, bem organizada.</h1><p>Registre o relato, organize as informações e revise o prontuário.</p></div><button className="w-button" onClick={()=>setConfirmNew(true)}><Plus size={17}/> Nova consulta</button></div>
        <div className="w-test-note">Use apenas dados fictícios nesta versão. Nenhum diagnóstico ou tratamento é gerado automaticamente.</div>
        <div className="w-stepper" role="tablist" aria-label="Etapas da consulta">{[['capture','1','Capturar',Mic],['organize','2','Organizar',Sparkles],['review','3','Revisar',CheckCheck]].map(([key,num,label,Icon])=><button key={key} role="tab" aria-selected={stage===key} onClick={()=>{if(stage!==key)navigate(()=>setStage(key))}} className={stage===key?'active':''}><span>{num}</span><Icon size={18}/>{label}</button>)}</div>
        <div className="w-editor-grid"><section className="w-card w-primary-card">
          {stage==='capture'&&<><div className="w-section-heading"><div><h2>O atendimento começa pelo relato</h2><p>Fale como costuma registrar. Você confere a transcrição antes de inserir.</p></div><Mic size={22}/></div>
            <label className="w-field">Identificador fictício da consulta<input value={doc.patient} maxLength={100} placeholder="Ex.: Caso de teste 001" onChange={e=>patch({patient:e.target.value})}/></label>
            <div className="w-segmented"><button className={voice==='browser'?'active':''} onClick={()=>navigate(()=>setVoice('browser'))}>Ditado do navegador</button><button className={voice==='ai'?'active':''} onClick={()=>navigate(()=>setVoice('ai'))}>Microfone com IA</button></div>
            <Suspense fallback={<p>Preparando microfone…</p>}>{voice==='browser'?<BrowserDictation onInsertTranscript={insert} onPendingChange={setVoicePending}/>:demo?<div className="w-empty"><Mic/><h3>Whisper precisa de uma conta</h3><p>Gravação por IA usa Groq no servidor. A demonstração oferece ditado do navegador e edição de texto.</p></div>:<GroqRecorder onInsertTranscript={insert} onPendingChange={setVoicePending}/>}</Suspense>
            <details className="w-attachments"><summary>Anexar exame ou laudo fictício · OCR local</summary><Suspense fallback={<p>Preparando leitura local…</p>}><ExamAttachments onInsertText={insert}/></Suspense></details>
            <div className="w-section-divider"/><label className="w-field">Relato original · editável<textarea aria-label="Relato original" rows={9} value={doc.source} maxLength={MAX_SOURCE} placeholder="Digite ou insira a transcrição do atendimento aqui…" onChange={e=>{setDoc(d=>sourceChanged(d,e.target.value))}}/></label>
            <div className="w-field-footer"><span>{doc.source.length.toLocaleString('pt-BR')} / 6.000 caracteres</span>{!doc.source&&<button onClick={()=>patch({source:SAMPLE})}>Carregar exemplo fictício</button>}</div>
            <button className="w-button primary w-next" disabled={!doc.source.trim()} onClick={()=>navigate(()=>setStage('organize'))}>Organizar prontuário <ArrowRight size={17}/></button>
          </>}
          {stage==='organize'&&<><div className="w-section-heading"><div><h2>Do relato ao prontuário</h2><p>O original permanece intacto. O resultado será sempre um rascunho.</p></div><Sparkles/></div>
            <div className="w-source-preview"><strong>RELATO ORIGINAL</strong><p>{doc.source||'Volte à captura para informar o relato.'}</p></div>
            <div className="w-method"><div className="w-method-icon"><Sparkles/></div><div><h3>Resumo e SOAP por IA</h3><p>Organiza somente os fatos narrados, separa história, exame, avaliação e conduta e aponta informações ausentes.</p><span className="w-chip">{aiAvailable&&!demo?'Provedor configurado':'Requer configuração do servidor'}</span></div></div>
            <label className="w-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Autorizo o envio de texto fictício à Groq e confirmei que a conta está no plano gratuito, sujeito a cotas.</label>
            <button className="w-button primary" disabled={busy||demo||!aiAvailable||!consent||!online||doc.source.trim().length<20} onClick={organizeAI}><Sparkles size={17}/>{busy?'Organizando…':'Gerar resumo e prontuário'}</button>{busy&&<button className="w-button" onClick={()=>request.current?.abort()}>Cancelar</button>}
            <div className="w-section-divider"/><h3>Organização literal, sem IA</h3><p className="w-muted">Distribui frases pelos marcadores do relato. Não resume nem interpreta. Trechos não reconhecidos continuam nas pendências.</p><button className="w-button" disabled={!doc.source.trim()||busy} onClick={()=>{if((doc.summary||Object.values(doc.soap).some(Boolean))&&!window.confirm('Substituir o rascunho atual pela organização literal? O relato original permanece.'))return;organizeLocal()}}>Organizar sem IA</button>
          </>}
          {stage==='review'&&<><div className="w-section-heading"><div><h2>Seu prontuário. Sua revisão.</h2><p>Confira cada informação com o relato antes de copiar ou baixar.</p></div><CheckCheck/></div>
            {stale&&<div className="w-alert">O relato foi alterado depois da organização. Gere novamente ou confirme que incorporou as alterações ao rascunho.<button className="w-button" onClick={()=>patch({generatedFrom:doc.source})}>Confirmei as alterações manualmente</button></div>}
            {aiProposal&&<div className="w-proposal"><h3>Resultado da IA · ainda não aplicado</h3><p>{aiProposal.note.summary}</p><details><summary>Conferir todos os campos gerados</summary>{Object.entries(SOAP).map(([k,label])=><div key={k}><strong>{label}</strong><p>{aiProposal.note[k]||'Não informado'}</p></div>)}<strong>Pendências</strong><p>{aiProposal.note.pending||'Nenhuma apontada'}</p></details><button className="w-button primary" disabled={aiProposal.source!==doc.source} onClick={applyAI}>Aplicar rascunho de IA</button><button className="w-button" onClick={()=>setAiProposal(null)}>Descartar resultado</button></div>}
            <label className="w-field">Resumo factual<textarea rows={3} value={doc.summary} maxLength={8000} onChange={e=>patch({summary:e.target.value})} placeholder="O resumo da IA aparecerá aqui. Você também pode escrever manualmente."/></label>
            {Object.entries(SOAP).map(([k,label])=><label className="w-field" key={k}>{label}<textarea rows={3} value={doc.soap[k]} maxLength={8000} placeholder="Não informado" onChange={e=>patch({soap:{...doc.soap,[k]:e.target.value}})}/></label>)}
            <label className="w-field">Pendências e ambiguidades<textarea rows={3} value={doc.pending} maxLength={8000} onChange={e=>patch({pending:e.target.value})}/></label>
            {doc.origin==='manual'&&doc.generatedFrom!==doc.source&&<button className="w-button" onClick={()=>patch({generatedFrom:doc.source})}>Vincular edição manual ao relato atual</button>}
            <label className="w-check w-review-check"><input type="checkbox" checked={doc.reviewed} disabled={stale||(!doc.summary.trim()&&!Object.values(doc.soap).some(v=>v.trim()))} onChange={e=>setDoc(d=>({...d,reviewed:e.target.checked,generatedFrom:d.generatedFrom||d.source}))}/>Conferi o relato, negações, números, lateralidade e campos ausentes. Revisei e assumo a responsabilidade pelo texto.</label>
            <div className="w-actions"><button className="w-button primary" disabled={!exportAllowed} onClick={copy}><Copy size={17}/> Copiar prontuário</button><button className="w-button" disabled={!exportAllowed} onClick={()=>download('prontuario-revisado.txt',exportNote(doc))}><Download size={17}/> Baixar texto</button></div>
          </>}
        </section><aside className="w-context"><section className="w-card"><span className="w-eyebrow">CONSULTA ATUAL</span><h3>{doc.patient||'Novo atendimento'}</h3><div className="w-status-line"><span className={doc.source?'done':''}><Check size={13}/></span> Relato registrado</div><div className="w-status-line"><span className={doc.generatedFrom?'done':''}><Check size={13}/></span> Rascunho organizado</div><div className="w-status-line"><span className={exportAllowed?'done':''}><Check size={13}/></span> Revisão concluída</div><div className="w-section-divider"/><p className="w-muted">{SYNC[sync.phase]}. {demo?'Ao fechar esta aba, o conteúdo será perdido.':'Ative a nuvem para continuar em outro dispositivo.'}</p><button className="w-text-button" onClick={()=>setShowSync(true)}><Cloud size={16}/> Ver sincronização</button></section>
          <section className="w-card w-backup"><h3>Preserve seu trabalho</h3><p>Baixe o conteúdo completo, inclusive o relato e as pendências. O backup pode conter texto ainda não revisado.</p><button className="w-button" disabled={!hasContent(doc)} onClick={()=>download('consulta-rascunho.json',JSON.stringify({...doc,exportWarning:'RASCUNHO. Revisão obrigatória antes de uso.'},null,2),'application/json')}><Download size={16}/> Backup do rascunho</button></section>
          {stage==='review'&&<section className="w-card"><h3>Compare com o original</h3><p className="w-original">{doc.source||'Nenhum relato informado.'}</p></section>}
        </aside></div>
      </>}
      {tab==='catalog'&&<Suspense fallback={<p>Carregando catálogo…</p>}><PrescriptionCatalog/></Suspense>}
      {tab==='settings'&&<><div className="w-heading"><div><h1>Configuração e privacidade</h1><p>Disponibilidade real dos recursos deste ambiente.</p></div></div><section className="w-card"><h2>Conexões</h2><p>Conta: {demo?'demonstração, sem login':'autenticada'}. IA de documentação: {aiAvailable?'configurada no servidor':'indisponível ou não configurada'}.</p><p>Sincronização: {SYNC[sync.phase]}. Exige a migração SQL de workspace_sessions e a mesma conta em ambos os aparelhos.</p><h3>Como os dados circulam</h3><p>O ditado do navegador pode usar servidores do fabricante. Whisper envia áudio à Groq após autorização. Resumo por IA envia o relato à Groq. A sincronização guarda somente texto no Supabase por 24 horas desde a criação; backups do provedor têm políticas próprias.</p><p>Não há persistência clínica em localStorage nem promessa de funcionamento offline. Sem nuvem, fechar a aba perde o rascunho. Exporte antes.</p><h3>Microfone no celular</h3><p>Use HTTPS e permita acesso ao microfone. Suporte a ditado varia por navegador; Whisper negocia WebM ou MP4 conforme o dispositivo. Validação em aparelhos físicos ainda é necessária.</p><h3>Restaurar backup</h3><label className="w-field">Arquivo JSON exportado pelo aplicativo<input type="file" accept=".json,application/json" onChange={importBackup}/></label><h3>Instalação independente</h3><p>Consulte README.md, docs/AUDITORIA_V2.md e docs/PROMPT_RECONSTRUCAO.md no pacote do projeto. Nenhuma chave privada deve entrar no frontend.</p></section>{!demo&&profile?.role==='admin'&&<section className="w-card"><Suspense fallback={<p>Carregando administração…</p>}><AdminPanel/></Suspense></section>}</>}
    </main><footer className="w-footer">Prontuário.IA · Reconstrução 2.0 <span>Documentação assistida. Decisão sempre humana.</span></footer></div>
    {confirmNew&&<div className="w-modal-backdrop"><section className="w-card w-modal" role="dialog" aria-modal="true" aria-labelledby="new-title"><h2 id="new-title">Começar outra consulta?</h2><p>{sync.phase==='disabled'?'O conteúdo desta aba será limpo. Baixe um backup antes de continuar.':'Isso encerra a consulta na nuvem nos dois aparelhos e limpa esta aba. Baixe um backup antes; a exclusão exige conexão e não é aplicada se outro aparelho já atualizou a versão.'}</p><div className="w-actions"><button className="w-button" onClick={()=>setConfirmNew(false)}>Cancelar</button><button className="w-button" onClick={()=>download('consulta-backup.json',JSON.stringify(doc,null,2),'application/json')}>Baixar backup</button><button className="w-button primary" onClick={()=>navigate(newConsultation)}>Limpar e começar</button></div></section></div>}
  </div>;
}
