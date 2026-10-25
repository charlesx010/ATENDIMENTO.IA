import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Mic, Pause, Play, Square, Trash2, WandSparkles } from 'lucide-react';
import { getRecognitionParts, stitchSpeech, removeObviousRepetitions } from './speechText.js';

// Ditado gratuito via API de fala do navegador: nao usa a OpenAI.
// ATENCAO: dependendo do navegador o fornecedor processa a fala em
// servidores externos; por isso exige autorizacao especifica e dados ficticios.
// Somente o TEXTO revisado e inserido pelo medico entra na sessao Supabase.
const MAX_SECONDS = 300;
const prettyTime = seconds => String(Math.floor(seconds/60)).padStart(2,'0') + ':' +
  String(seconds%60).padStart(2,'0');

export default function BrowserDictation({ onInsertTranscript=()=>{} }) {
  const [supported,setSupported] = useState(true);
  const [consented,setConsented] = useState(false);
  const [status,setStatus] = useState('idle');
  const [seconds,setSeconds] = useState(0);
  const [text,setText] = useState('');
  const [interim,setInterim] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');

  const mountedRef=useRef(false);
  const recognitionRef=useRef(null);
  const activeRef=useRef(false);
  const restartingRef=useRef(null);
  const textRef=useRef('');
  const prefixRef=useRef('');
  const interimRef=useRef('');

  useEffect(()=>{
    mountedRef.current=true;
    setSupported(Boolean(window.SpeechRecognition||window.webkitSpeechRecognition));
    return ()=>{
      mountedRef.current=false;
      activeRef.current=false;
      clearTimeout(restartingRef.current);
      const rec=recognitionRef.current;
      if(rec){
        rec.onstart=null;rec.onresult=null;rec.onerror=null;rec.onend=null;
        try{rec.abort()}catch{}
      }
      recognitionRef.current=null;
    };
  },[]);

  useEffect(()=>{
    if(status!=='listening') return;
    const timer=setInterval(()=>setSeconds(s=>Math.min(s+1,MAX_SECONDS)),1000);
    return()=>clearInterval(timer);
  },[status]);
  useEffect(()=>{
    if(seconds>=MAX_SECONDS && ['listening','starting','paused'].includes(status)){
      stopListening();
      setNotice('Limite de cinco minutos deste teste alcançado. Confira a transcrição.');
    }
  },[seconds,status]);

  function launch(){
    if(!mountedRef.current || !activeRef.current)return;
    const Constructor=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Constructor){
      setSupported(false);
      activeRef.current=false;
      setStatus('error');
      return;
    }
    const recognition=new Constructor();
    recognition.lang='pt-BR';
    // Chrome Android pode marcar hipoteses parciais como definitivas. O modo
    // por frase elimina o acúmulo dessas versões progressivas como resultados finais.
    // Ao encerrar cada frase, onend reinicia automaticamente se continuar ativo.
    recognition.continuous=false;
    recognition.interimResults=false;
    recognition.maxAlternatives=1;
    recognitionRef.current=recognition;
    // O prefixo é fixado no INÍCIO desta sessão. Resultados intermediários e
    // finais do navegador costumam conter novamente todo o histórico dela.
    const sessionPrefix=textRef.current;
    prefixRef.current=sessionPrefix;
    interimRef.current='';
    recognition.onstart=()=>{if(mountedRef.current && recognitionRef.current===recognition)setStatus('listening');};
    recognition.onresult=event=>{
      if(!mountedRef.current || recognitionRef.current!==recognition)return;
      const {final,temporary}=getRecognitionParts(event.results);
      const updated=stitchSpeech(sessionPrefix,final);
      textRef.current=updated;
      interimRef.current=temporary;
      setText(updated);
      setInterim(temporary);
    };
    recognition.onerror=event=>{
      if(!mountedRef.current || recognitionRef.current!==recognition)return;
      const code=event?.error||'unknown';
      if(code==='no-speech'||code==='aborted')return;
      activeRef.current=false;
      const message=code==='not-allowed'||code==='service-not-allowed'
        ? 'Permissão de microfone ou reconhecimento negada. Verifique o Chrome.'
        : code==='network'
          ? 'O serviço de reconhecimento do navegador não respondeu. Confira a conexão.'
          : code==='language-not-supported'
            ? 'Português brasileiro indisponível para reconhecimento neste navegador.'
            : 'Reconhecimento interrompido ('+code+'). Confira e retome o teste.';
      setError(message);
      setStatus('error');
    };
    recognition.onend=()=>{
      // Um evento atrasado de uma sessão anterior nunca deve apagar o estado
      // de uma nova sessão.
      if(recognitionRef.current!==recognition)return;
      recognitionRef.current=null;
      if(!mountedRef.current)return;
      if(!activeRef.current && interimRef.current){
        // Ao parar/pausar, preservar para conferência as últimas palavras
        // provisórias, caso o navegador não tenha enviado um resultado final.
        const finalWithPartial=stitchSpeech(textRef.current,interimRef.current);
        textRef.current=finalWithPartial;
        setText(finalWithPartial);
        setNotice('Últimas palavras provisórias incluídas. Confira especialmente o final do ditado.');
      }
      interimRef.current='';
      setInterim('');
      if(activeRef.current){
        // Cada frase gera no máximo um resultado final; continuamos a escuta
        // ao terminar uma frase, sem criar dois reconhecedores simultâneos.
        // Chrome pode encerrar espontaneamente ao detectar silêncio.
        restartingRef.current=setTimeout(()=>launch(),450);
        setStatus('starting');
      } else {
        setStatus(previous=>previous==='paused'||previous==='error'?previous:'stopped');
      }
    };
    try{recognition.start();}
    catch{
      activeRef.current=false;
      setStatus('error');
      setError('Não foi possível iniciar o reconhecimento. Reabra esta tela.');
    }
  }

  function start(){
    if(!supported)return;
    if(!consented){setError('Confirme antes que usará apenas fala fictícia.');return;}
    if(textRef.current && !window.confirm('Iniciar uma nova transcrição descarta o texto não inserido. Continuar?'))return;
    clearTimeout(restartingRef.current);
    textRef.current='';prefixRef.current='';interimRef.current='';
    setText('');setInterim('');setError('');setNotice('');
    setSeconds(0);
    activeRef.current=true;
    setStatus('starting');
    launch();
  }
  function pause(){
    if(!activeRef.current)return;
    activeRef.current=false;
    clearTimeout(restartingRef.current);
    setStatus('paused');
    setInterim('');
    try{recognitionRef.current?.stop();}catch{}
  }
  function resume(){
    if(!consented)return;
    if(status!=='paused')return;
    clearTimeout(restartingRef.current);
    setError('');
    activeRef.current=true;
    setStatus('starting');
    // Aguarda o encerramento do motor anterior para evitar duas escutas
    // simultâneas e callbacks que se sobreponham.
    if(!recognitionRef.current)launch();
  }
  function stopListening(){
    activeRef.current=false;
    clearTimeout(restartingRef.current);
    setStatus(recognitionRef.current?'finishing':'stopped');
    try{recognitionRef.current?.stop();}catch{setStatus('stopped');}
  }
  function edit(value){
    textRef.current=value;
    setText(value);
  }
  function insert(){
    if(!text.trim())return;
    onInsertTranscript(text.trim());
    textRef.current='';
    prefixRef.current='';
    interimRef.current='';
    setText('');
    setInterim('');
    setNotice('Texto acrescentado à seção escolhida da evolução. Confira o resultado.');
  }
  function clear(){
    if(!text && !interim)return;
    if(!window.confirm('Apagar o texto transcrito que ainda não foi inserido?'))return;
    edit('');
    interimRef.current='';
    setInterim('');
  }
  function cleanRepeated(){
    const cleaned=removeObviousRepetitions(text);
    if(cleaned===text){
      setNotice('Não encontrei frases consecutivas idênticas para remover.');
      return;
    }
    edit(cleaned);
    setNotice('Frases idênticas removidas. Revise: nenhuma interpretação clínica foi realizada.');
  }

  const listening=status==='listening'||status==='starting';
  const canStart=['idle','stopped','error'].includes(status);
  return <section className="panel browser-dictation" aria-label="Transcrição gratuita da consulta">
    <div className="panel-heading">
      <div>
        <h3><Mic size={18}/> Falar e revisar</h3>
        <p>Modo de frases para Android: evita eco de hipóteses parciais. Sem créditos da OpenAI.</p>
      </div>
      <span className="voice-test-label">TESTE</span>
    </div>
    <p className="voice-privacy">
      <AlertTriangle size={16}/>
      <span>O navegador pode enviar a fala ao serviço do seu fornecedor. Não é garantido processamento local. Use <strong>somente falas fictícias</strong>.</span>
    </p>
    <label className="voice-confirm">
      <input type="checkbox" checked={consented} disabled={listening||status==='paused'}
        onChange={e=>setConsented(e.target.checked)}/>
      <span>Entendi e autorizo apenas um teste fictício de reconhecimento de voz pelo navegador.</span>
    </label>
    {!supported && <p className="voice-error"><AlertTriangle size={16}/>
      Seu navegador não oferece reconhecimento de fala. Como alternativa gratuita, use o microfone do teclado do Android no campo de anotações.
    </p>}
    {supported && <div className="voice-main-row">
      <div className={'voice-indicator '+(listening?'live':'')}>
        <Mic size={20}/><strong>{prettyTime(seconds)}</strong>
      </div>
      <div className="voice-actions">
        {canStart && <button type="button" className="btn primary" disabled={!consented}
          onClick={start}><Mic size={17}/> Iniciar</button>}
        {listening && <button type="button" className="btn outline" onClick={pause}>
          <Pause size={17}/> Pausar
        </button>}
        {status==='paused' && <button type="button" className="btn outline"
          onClick={resume}><Play size={17}/> Continuar</button>}
        {(listening||status==='paused') &&
          <button type="button" className="btn primary" onClick={stopListening}>
            <Square size={16}/> Parar
          </button>}
      </div>
    </div>}
    {(text || interim) && <div className="voice-review">
      <strong>Conferir texto reconhecido</strong>
      <textarea rows="6" aria-label="Transcrição gratuita para revisão"
        value={[text,interim].filter(Boolean).join(' ')}
        readOnly={listening||status==='paused'||status==='finishing'}
        onChange={e=>edit(e.target.value)}
      />
      {listening && <p className="voice-hint">Texto provisório: aguarde ou toque em Parar antes de editar.</p>}
      {!listening && status!=='paused' && status!=='finishing' && <div className="voice-review-actions">
        <button type="button" className="btn primary" disabled={!text.trim()} onClick={insert}>
          <Check size={17}/> Acrescentar à evolução
        </button>
        <button type="button" className="btn outline" onClick={cleanRepeated} disabled={!text.trim()}>
          <WandSparkles size={15}/> Remover repetições
        </button>
        <button type="button" className="btn outline" onClick={clear}>
          <Trash2 size={15}/> Limpar
        </button>
      </div>}
    </div>}
    {status==='finishing'&&<p className="voice-muted">Concluindo as últimas palavras...</p>}
    {error && <p className="voice-error"><AlertTriangle size={16}/>{error}</p>}
    {notice && <p className="voice-muted">{notice}</p>}
    <p className="voice-hint">
      Sem cobrança OpenAI. A fala revisada complementa a seção escolhida na tela principal; a consulta fica somente nesta aba.
      O botão de limpeza remove somente repetições literalmente iguais; revise os dados clínicos. Este recurso não identifica interlocutores nem garante termos médicos corretos.
    </p>
  </section>;
}
