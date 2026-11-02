import React,{useEffect,useRef,useState} from 'react';
import {Mic,Square,Send,Check,Trash2,AlertTriangle} from 'lucide-react';
import {supabase} from './supabase.js';

const MAX_SECONDS=100;
const MAX_BYTES=3600000;
export default function GroqRecorder({onInsertTranscript=()=>{},onPendingChange=()=>{}}){
 const [consent,setConsent]=useState(false);
 const [requesting,setRequesting]=useState(false);
 const [recording,setRecording]=useState(false);
 const [seconds,setSeconds]=useState(0);
 const [audio,setAudio]=useState(null);
 const [audioUrl,setAudioUrl]=useState('');
 const [text,setText]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [qualityWarnings,setQualityWarnings]=useState([]);
 const recorder=useRef(null),stream=useRef(null),chunks=useRef([]),mounted=useRef(false);
 // A trava é síncrona: dois cliques antes do próximo render não abrem duas capturas.
 const starting=useRef(false),generation=useRef(0),transcription=useRef(null);
 const isCurrent=id=>mounted.current&&generation.current===id;
 function releaseStream(input){input?.getTracks().forEach(track=>track.stop());if(stream.current===input)stream.current=null;}
 useEffect(()=>{mounted.current=true;return()=>{
  mounted.current=false;generation.current+=1;starting.current=false;
  transcription.current?.abort();transcription.current=null;
  const rec=recorder.current;
  if(rec){rec.onstop=null;rec.ondataavailable=null;rec.onerror=null;try{if(rec.state!=='inactive')rec.stop();}catch{}}
  recorder.current=null;chunks.current=[];releaseStream(stream.current);
 };},[]);
 useEffect(()=>{if(!audio){setAudioUrl('');return;}const url=URL.createObjectURL(audio);setAudioUrl(url);return()=>URL.revokeObjectURL(url);},[audio]);
 useEffect(()=>{if(!recording)return;const timer=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(timer);},[recording]);
 useEffect(()=>{if(seconds>=MAX_SECONDS&&recording)stop();},[seconds,recording]);
 useEffect(()=>{onPendingChange(Boolean(requesting||recording||audio||text||busy));},[requesting,recording,audio,text,busy,onPendingChange]);
 function cancelPermission(){
  generation.current+=1;starting.current=false;
  setRequesting(false);setMessage('Solicitação de microfone cancelada. Uma permissão tardia será ignorada.');
 }
 function stop(){
  const rec=recorder.current;
  try{if(rec&&rec.state!=='inactive')rec.stop();}catch{if(mounted.current)setMessage('Não foi possível concluir o áudio. Grave novamente.');}
  releaseStream(stream.current);
  if(mounted.current)setRecording(false);
 }
 async function start(){
  if(starting.current||recorder.current?.state==='recording'||transcription.current)return;
  if(!consent){setMessage('Confirme que o áudio será inteiramente fictício.');return;}
  if(audio&&!window.confirm('Substituir a gravação atual?'))return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setMessage('Gravação não suportada neste navegador.');return;}
  starting.current=true;
  const id=++generation.current;
  setRequesting(true);setMessage('Aguardando permissão do microfone…');
  let input;
  try{
   input=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
   if(!isCurrent(id)){releaseStream(input);return;}
   stream.current=input;
   const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>window.MediaRecorder.isTypeSupported?.(x));
   const rec=new MediaRecorder(input,mime?{mimeType:mime}:undefined);
   let byteCount=0,oversize=false,failed=false;
   recorder.current=rec;chunks.current=[];
   rec.ondataavailable=e=>{
    if(!isCurrent(id)||!e.data?.size)return;
    byteCount+=e.data.size;
    if(byteCount>MAX_BYTES){oversize=true;chunks.current=[];stop();return;}
    chunks.current.push(e.data);
   };
   rec.onstop=()=>{
    releaseStream(input);
    if(!isCurrent(id))return;
    const blob=oversize||failed?null:new Blob(chunks.current,{type:rec.mimeType||mime||'audio/webm'});
    chunks.current=[];recorder.current=null;
    setAudio(blob?.size?blob:null);setRecording(false);
    if(failed)setMessage('A gravação foi interrompida por erro. Confira o microfone e grave novamente.');
    else if(oversize)setMessage('Áudio acima de 3,6 MB: gravação interrompida. Grave um trecho menor.');
    else if(!blob?.size)setMessage('A gravação não produziu áudio. Confira o microfone e tente novamente.');
    else setMessage('Áudio pronto. Ouça e confira antes de transcrever.');
   };
   rec.onerror=()=>{if(isCurrent(id)){failed=true;stop();}};
   rec.start(500);
   setAudio(null);setText('');setSeconds(0);setQualityWarnings([]);setMessage('Gravando. Toque em Parar ao concluir.');setRecording(true);
  }catch{
   releaseStream(input);
   if(isCurrent(id))setMessage('Permissão do microfone negada ou dispositivo indisponível.');
  }finally{
   if(isCurrent(id)){starting.current=false;setRequesting(false);}
  }
 }
 async function transcribe(){
  if(!audio||transcription.current||!consent||text.trim())return;
  const abort=new AbortController(),id=generation.current;
  transcription.current=abort;
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;abort.abort();},42000);
  setBusy(true);setMessage('Transcrevendo pelo Whisper. O áudio permanece disponível para revisão.');
  try{
   const {data}=await supabase.auth.getSession();
   if(!isCurrent(id))return;
   abort.signal.throwIfAborted();
   const token=data?.session?.access_token;
   if(!token)throw Error('Entre com sua conta para usar a transcrição.');
   const response=await fetch('/api/free-transcription',{
    method:'POST',headers:{authorization:'Bearer '+token,'content-type':audio.type||'audio/webm','x-clinical-consent':'fictitious_only'},
    body:audio,signal:abort.signal
   });
   const result=await response.json().catch(()=>({}));
   if(!isCurrent(id))return;
   abort.signal.throwIfAborted();
   if(!response.ok)throw Error(result.error||'Não foi possível transcrever.');
   if(typeof result.text!=='string'||!result.text.trim()||result.text.length>12000)throw Error('A transcrição recebida é inválida. O áudio foi preservado.');
   setText(result.text);setQualityWarnings(Array.isArray(result.qualityWarnings)?result.qualityWarnings.filter(w=>typeof w==='string').slice(0,8):[]);
   setMessage('Transcrição pronta. Revise termos clínicos, números, negações e lateralidade antes de inserir.');
  }catch(e){if(isCurrent(id))setMessage(e?.name==='AbortError'?(timedOut?'A transcrição demorou demais. Áudio preservado.':'Transcrição cancelada. Áudio preservado.'):(e?.message||'Transcrição indisponível.'));}
  finally{clearTimeout(timer);if(transcription.current===abort)transcription.current=null;if(isCurrent(id))setBusy(false);}
 }
 function insert(){
  if(!text.trim())return;
  if(onInsertTranscript(text.trim())===false)return;
  setText('');setAudio(null);setSeconds(0);setMessage('Texto inserido na consulta. Confira o conteúdo antes de gerar com IA.');
 }
 return <div className="q-groq-voice">
   <p><strong>Whisper (GroqCloud)</strong> — transcrição por IA, sujeita ao plano e às cotas da conta.</p>
   <p><AlertTriangle size={14}/> Este áudio fictício será enviado à Groq. Não utilizar com pacientes reais.</p>
   <label className="q-ai-consent"><input type="checkbox" checked={consent} disabled={requesting||recording||busy}
     onChange={e=>setConsent(e.target.checked)}/>Autorizo apenas áudio inventado.</label>
   <div className="q-groq-actions">
     {requesting?<><button className="btn primary" type="button" disabled><Mic size={17}/> Aguardando microfone…</button><button className="btn outline" type="button" onClick={cancelPermission}>Cancelar solicitação</button></>:!recording?<button className="btn primary" type="button" onClick={start} disabled={!consent||busy}><Mic size={17}/> Gravar</button>
       :<button className="btn outline" type="button" onClick={stop}><Square size={15}/> Parar ({seconds}s)</button>}
     {!!audio&&!recording&&!requesting&&!text.trim()&&<button className="btn primary" type="button" disabled={busy} onClick={transcribe}><Send size={16}/>{busy?' Transcrevendo...':' Transcrever com IA'}</button>}
     {busy&&<button className="btn outline" type="button" onClick={()=>transcription.current?.abort()}>Cancelar transcrição</button>}
   </div>
   {qualityWarnings.length>0&&<div className="q-clinical-review" role="alert"><strong>Revisão reforçada</strong><ul>{qualityWarnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></div>}
   {audioUrl&&<audio controls src={audioUrl} aria-label="Reproduzir áudio gravado" style={{width:'100%',marginTop:12}}/>}
   {audio&&!recording&&!requesting&&<button className="btn outline" type="button" disabled={busy} onClick={()=>{setAudio(null);setText('');setQualityWarnings([]);setMessage('Áudio descartado.');}}>Descartar gravação</button>}
   {!!text&&<div className="q-simple-field"><label htmlFor="groq-text">Texto reconhecido — corrigir antes de inserir</label>
    <textarea id="groq-text" rows={5} value={text} onChange={e=>setText(e.target.value)}/>
    <button className="btn primary" type="button" onClick={insert}><Check size={16}/> Inserir no relato</button>
    <button className="btn outline" type="button" onClick={()=>{setAudio(null);setText('');setQualityWarnings([]);}}><Trash2 size={14}/> Descartar</button></div>}
   {message&&<p className="q-feedback" role="status">{message}</p>}
 </div>;
}
