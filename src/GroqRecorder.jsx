import React,{useEffect,useRef,useState} from 'react';
import {Mic,Square,Send,Check,Trash2,AlertTriangle} from 'lucide-react';
import {supabase} from './supabase.js';

const MAX_SECONDS=100;
const MAX_BYTES=3600000;
export default function GroqRecorder({onInsertTranscript=()=>{},onPendingChange=()=>{}}){
 const [consent,setConsent]=useState(false);
 const [recording,setRecording]=useState(false);
 const [seconds,setSeconds]=useState(0);
 const [audio,setAudio]=useState(null);
 const [audioUrl,setAudioUrl]=useState('');
 useEffect(()=>{if(!audio){setAudioUrl('');return;}const url=URL.createObjectURL(audio);setAudioUrl(url);return()=>URL.revokeObjectURL(url);},[audio]);
 const [text,setText]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [qualityWarnings,setQualityWarnings]=useState([]);
 const recorder=useRef(null),stream=useRef(null),chunks=useRef([]),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{
  mounted.current=false;
  try{recorder.current?.stop();}catch{}
  stream.current?.getTracks().forEach(track=>track.stop());
 };},[]);
 useEffect(()=>{
  if(!recording)return;
  const timer=setInterval(()=>setSeconds(s=>s+1),1000);
  return()=>clearInterval(timer);
 },[recording]);
 useEffect(()=>{if(seconds>=MAX_SECONDS&&recording)stop();},[seconds,recording]);
 useEffect(()=>{onPendingChange(Boolean(recording||audio||text||busy));},[recording,audio,text,busy,onPendingChange]);
 function stop(){
  if(recorder.current?.state==='recording')recorder.current.stop();
  stream.current?.getTracks().forEach(t=>t.stop());
  stream.current=null;
  if(mounted.current)setRecording(false);
 }
 async function start(){
  if(!consent){setMessage('Confirme que o áudio será inteiramente fictício.');return;}
  if(audio&&!window.confirm('Substituir a gravação atual?'))return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setMessage('Gravação não suportada neste navegador.');return;}
  setMessage('');setQualityWarnings([]);setText('');setAudio(null);setSeconds(0);chunks.current=[];
  try{
   const input=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
   if(!mounted.current){input.getTracks().forEach(t=>t.stop());return;}
   stream.current=input;
   const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4']
     .find(x=>window.MediaRecorder.isTypeSupported(x));
   const rec=new MediaRecorder(input,mime?{mimeType:mime}:undefined);
   recorder.current=rec;
   rec.ondataavailable=e=>{if(e.data?.size)chunks.current.push(e.data);};
   rec.onstop=()=>{
    const blob=new Blob(chunks.current,{type:rec.mimeType||'audio/webm'});
    chunks.current=[];
    if(mounted.current){
     setAudio(blob.size>0&&blob.size<=MAX_BYTES?blob:null);
     if(blob.size>MAX_BYTES)setMessage('Áudio acima de 3,6 MB: grave um trecho menor.');
     setRecording(false);
    }
    input.getTracks().forEach(t=>t.stop());
   };
   rec.onerror=()=>{setMessage('Erro no gravador. Tente novamente.');stop();};
   rec.start(500);
   setRecording(true);
  }catch{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setMessage('Permissão do microfone negada ou dispositivo indisponível.');}
 }
 async function transcribe(){
  if(!audio||busy||!consent||text.trim())return; // Uma transcrição por áudio. Sem repetição acidental.
  setBusy(true);setMessage('Transcrevendo pelo Whisper. Nenhuma chamada à OpenAI.');
  try{
   const {data}=await supabase.auth.getSession();
   const token=data?.session?.access_token;
   if(!token)throw Error('Entre com sua conta para usar a transcrição gratuita.');
   const response=await fetch('/api/free-transcription',{
    method:'POST',
    headers:{authorization:'Bearer '+token,'content-type':audio.type||'audio/webm','x-clinical-consent':'fictitious_only'},
    body:audio,signal:AbortSignal.timeout(42000)
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'Não foi possível transcrever.');
   setText(result.text||'');setQualityWarnings(Array.isArray(result.qualityWarnings)?result.qualityWarnings:[]);
   setMessage('Transcrição pronta. Revise termos clínicos, números, negações e lateralidade antes de inserir.');
  }catch(e){setMessage(e?.message||'Transcrição indisponível.');}
  finally{setBusy(false);}
 }
 function insert(){
  if(!text.trim())return;
  if(onInsertTranscript(text.trim())===false)return;
  setText('');setAudio(null);setSeconds(0);
  setMessage('Texto inserido na consulta. Confira o conteúdo antes de gerar com IA.');
 }
 return <div className="q-groq-voice">
   <p><strong>Whisper (GroqCloud)</strong> — reconhecimento de voz por IA no plano gratuito, sujeito a cotas.</p>
   <p><AlertTriangle size={14}/> Este áudio fictício será enviado à Groq. Não utilizar com pacientes reais.</p>
   <label className="q-ai-consent"><input type="checkbox" checked={consent} disabled={recording||busy}
     onChange={e=>setConsent(e.target.checked)}/>Autorizo apenas áudio inventado.</label>
   <div className="q-groq-actions">
     {!recording?<button className="btn primary" type="button" onClick={start} disabled={!consent||busy}><Mic size={17}/> Gravar</button>
       :<button className="btn outline" type="button" onClick={stop}><Square size={15}/> Parar ({seconds}s)</button>}
     {!!audio&&!recording&&!text.trim()&&<button className="btn primary" type="button" disabled={busy} onClick={transcribe}><Send size={16}/>{busy?' Transcrevendo...':' Transcrever (cota grátis)'}</button>}
   </div>
   {qualityWarnings.length>0&&<div className="q-clinical-review" role="alert"><strong>Revisão reforçada</strong><ul>{qualityWarnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></div>}
   {audioUrl&&<audio controls src={audioUrl} aria-label="Reproduzir áudio gravado" style={{width:'100%',marginTop:12}}/>}
   {audio&&!recording&&<button className="btn outline" type="button" disabled={busy} onClick={()=>{setAudio(null);setText('');setMessage('Áudio descartado.');}}>Descartar gravação</button>}
   {!!text&&<div className="q-simple-field"><label htmlFor="groq-text">Texto reconhecido — corrigir antes de inserir</label>
    <textarea id="groq-text" rows={5} value={text} onChange={e=>setText(e.target.value)}/>
    <button className="btn primary" type="button" onClick={insert}><Check size={16}/> Inserir no relato</button>
    <button className="btn outline" type="button" onClick={()=>{setAudio(null);setText('');}}><Trash2 size={14}/> Descartar</button></div>}
   {message&&<p className="q-feedback" role="status">{message}</p>}
 </div>;
}
