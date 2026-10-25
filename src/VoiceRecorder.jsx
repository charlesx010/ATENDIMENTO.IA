import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Mic, Pause, Play, Square } from 'lucide-react';
import { supabase } from './supabase';

// Apenas áudio fictício neste módulo. A gravação fica na memória durante a
// captação e é descartada depois de parar, inclusive quando a IA está ativada.
const MAX_SECONDS = 120;
const MIME_OPTIONS = ['audio/webm;codecs=opus','audio/webm','audio/mp4'];
const time = s => String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');

export default function VoiceRecorder({ aiEnabled=false, onInsertTranscript=()=>{} }) {
  const [status,setStatus]=useState('idle');
  const [seconds,setSeconds]=useState(0);
  const [consent,setConsent]=useState(false);
  const [error,setError]=useState('');
  const [transcript,setTranscript]=useState('');
  const [notice,setNotice]=useState('');
  const recorderRef=useRef(null);
  const streamRef=useRef(null);
  const chunksRef=useRef([]);
  const mountedRef=useRef(false);
  const apiAbortRef=useRef(null);
  const secondsRef=useRef(0);

  function releaseMic(){
    streamRef.current?.getTracks().forEach(track=>track.stop());
    streamRef.current=null;
  }
  useEffect(()=>{
    mountedRef.current=true;
    return ()=>{
      mountedRef.current=false;
      const rec=recorderRef.current;
      if(rec && rec.state!=='inactive'){
        rec.onstop=null;rec.ondataavailable=null;rec.onerror=null;
        try{rec.stop()}catch{}
      }
      releaseMic();
      recorderRef.current=null;
      chunksRef.current=[];
      apiAbortRef.current?.abort();
    };
  },[]);
  useEffect(()=>{
    if(status!=='recording')return;
    const ticker=setInterval(()=>{
      secondsRef.current=Math.min(secondsRef.current+1,MAX_SECONDS);
      setSeconds(secondsRef.current);
    },1000);
    return()=>clearInterval(ticker);
  },[status]);
  useEffect(()=>{
    if(seconds>=MAX_SECONDS && (status==='recording'||status==='paused')) stop();
  },[seconds,status]);

  async function sendToTranscription(blob,duration){
    if(!aiEnabled || !consent){
      setStatus('done');
      setNotice('Captação concluída. Áudio descartado: transcrição com IA ainda não autorizada.');
      return;
    }
    const controller=new AbortController();
    apiAbortRef.current=controller;
    setStatus('transcribing');
    try{
      const {data,error:sessionError}=await supabase.auth.getSession();
      if(sessionError||!data?.session?.access_token) throw Error('Entre novamente na sua conta.');
      const body=new FormData();
      body.append('consent','test_audio_only');
      body.append('duration_seconds',String(Math.max(1,Math.min(MAX_SECONDS,duration))));
      const isMp4=(blob.type||'').includes('mp4');
      body.append('audio',blob,isMp4?'gravacao.m4a':'gravacao.webm');
      const res=await fetch('/api/transcribe',{
        method:'POST',headers:{authorization:'Bearer '+data.session.access_token},
        body,signal:controller.signal
      });
      const json=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(json.error||'Não foi possível transcrever este áudio.');
      if(typeof json.text!=='string'||!json.text.trim())throw Error('A transcrição retornou vazia.');
      if(!mountedRef.current)return;
      setTranscript(json.text.trim());
      setNotice('Transcrição pronta. Confira a fidelidade antes de inserir no prontuário.');
      setStatus('review');
    }catch(err){
      if(!mountedRef.current)return;
      setError(err?.name==='AbortError'?'Transcrição interrompida.':err?.message||'Falha de transcrição.');
      setStatus('error');
    }finally{
      apiAbortRef.current=null;
    }
  }

  async function start(){
    if(['starting','recording','paused','stopping','transcribing'].includes(status))return;
    if(aiEnabled&&!consent){
      setError('Confirme o envio do áudio fictício à OpenAI para transcrição antes de começar.');
      return;
    }
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      setError('Gravação incompatível. Utilize o Chrome atualizado.');
      return;
    }
    setError('');setNotice('');setTranscript('');setSeconds(0);secondsRef.current=0;
    chunksRef.current=[];
    setStatus('starting');
    let stream;
    try{
      stream=await navigator.mediaDevices.getUserMedia({
        audio:{echoCancellation:true,noiseSuppression:true}
      });
      if(!mountedRef.current){stream.getTracks().forEach(t=>t.stop());return;}
      streamRef.current=stream;
      const mime=MIME_OPTIONS.find(type=>MediaRecorder.isTypeSupported(type));
      const recorder=new MediaRecorder(stream,mime?{mimeType:mime,audioBitsPerSecond:48000}:{audioBitsPerSecond:48000});
      recorderRef.current=recorder;
      recorder.ondataavailable=event=>{
        if(aiEnabled && event.data?.size>0)chunksRef.current.push(event.data);
      };
      recorder.onerror=()=>{
        releaseMic();chunksRef.current=[];
        if(mountedRef.current){setStatus('error');setError('A gravação foi interrompida.');}
      };
      recorder.onstop=()=>{
        releaseMic();recorderRef.current=null;
        if(!mountedRef.current){chunksRef.current=[];return;}
        const audioParts=chunksRef.current;
        chunksRef.current=[];
        if(!aiEnabled){setStatus('done');setNotice('Captação concluída. Áudio descartado. IA desativada.');return;}
        if(!audioParts.length){setStatus('error');setError('O microfone não produziu áudio.');return;}
        const blob=new Blob(audioParts,{type:recorder.mimeType||'audio/webm'});
        if(blob.size<512||blob.size>1500000){setStatus('error');setError('Áudio vazio ou acima de 1,5 MB.');return;}
        void sendToTranscription(blob,Math.max(secondsRef.current,1));
      };
      recorder.start(1000);
      setStatus('recording');
    }catch(e){
      if(stream)stream.getTracks().forEach(t=>t.stop());
      releaseMic();recorderRef.current=null;chunksRef.current=[];
      if(mountedRef.current){
        setStatus('idle');
        setError(e?.name==='NotAllowedError'?'Autorize o microfone nas configurações do Chrome.':'Não foi possível acessar o microfone.');
      }
    }
  }
  function pauseResume(){
    const rec=recorderRef.current;
    if(!rec)return;
    try{
      if(rec.state==='recording'){rec.pause();setStatus('paused');}
      else if(rec.state==='paused'){rec.resume();setStatus('recording');}
    }catch{setError('Erro ao pausar ou continuar.');}
  }
  function stop(){
    const rec=recorderRef.current;
    if(!rec||rec.state==='inactive')return;
    try{setStatus('stopping');rec.stop();}
    catch{releaseMic();setStatus('error');setError('Não foi possível finalizar.');}
  }
  function insert(){
    if(!transcript.trim())return;
    onInsertTranscript(transcript.trim());
    setTranscript('');
    setStatus('done');
    setNotice('Transcrição adicionada às anotações e aguardando sincronização. Revise os dados clínicos.');
  }
  const recording=status==='recording';
  const active=recording||status==='paused';
  return <section className="panel voice-card" aria-label="Escuta experimental da consulta">
    <div className="panel-heading"><div><h3><Mic size={18}/> Escuta da consulta</h3>
      <p>Iniciar, pausar e parar. {aiEnabled?'Após parar, transcrição para conferência.':'IA desativada: teste do microfone sem envio.'}</p>
      </div><span className="voice-test-label">TESTE</span>
    </div>
    {aiEnabled&&<label className="voice-confirm">
      <input type="checkbox" checked={consent} disabled={active||status==='starting'||status==='stopping'||status==='transcribing'}
        onChange={e=>setConsent(e.target.checked)}/>
      <span>Autorizo enviar apenas este áudio fictício à OpenAI para transcrição paga. Nenhum dado real de pacientes.</span>
    </label>}
    <div className="voice-main-row">
      <div className={'voice-indicator '+(recording?'live':'')}>
        <Mic size={20}/><strong>{time(seconds)}</strong>
      </div>
      <div className="voice-actions">
        {['idle','done','error','review'].includes(status)&&
          <button className="btn primary" type="button" onClick={start} disabled={aiEnabled&&!consent}><Mic size={17}/> Iniciar</button>}
        {active&&<>
          <button className="btn outline" type="button" onClick={pauseResume}>
            {recording?<Pause size={17}/>:<Play size={17}/>}
            {recording?'Pausar':'Continuar'}
          </button>
          <button className="btn primary" type="button" onClick={stop}><Square size={16}/> Parar</button>
        </>}
        {status==='starting'&&<span className="voice-muted">Abrindo microfone...</span>}
        {status==='stopping'&&<span className="voice-muted">Finalizando...</span>}
        {status==='transcribing'&&<span className="voice-muted">Transcrevendo com IA...</span>}
      </div>
    </div>
    {status==='paused'&&<p className="voice-paused">Captação pausada</p>}
    {status==='review'&&<div className="voice-review">
      <strong>Conferir transcrição</strong>
      <textarea rows="6" aria-label="Texto transcrito para revisão" value={transcript}
        onChange={e=>setTranscript(e.target.value)}/>
      <button className="btn primary" type="button" onClick={insert} disabled={!transcript.trim()}>
        <Check size={17}/> Inserir nas anotações
      </button>
      <p className="voice-hint">Apenas o texto aprovado será guardado na sessão clínica. Nomes, doses e exames podem ter sido reconhecidos incorretamente.</p>
    </div>}
    {notice&&<p className="voice-muted">{notice}</p>}
    {error&&<p className="voice-error"><AlertTriangle size={15}/>{error}</p>}
    {!aiEnabled&&<p className="voice-hint">Sem custo de IA. Ativação opcional pelo administrador, após configuração da chave privada.</p>}
  </section>;
}
