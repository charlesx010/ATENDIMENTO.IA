import React,{lazy,Suspense,useEffect,useState} from 'react';
import BrowserDictation from './BrowserDictation.jsx';

const GroqRecorder=lazy(()=>import('./GroqRecorder.jsx'));
export default function VoiceInput({onInsertTranscript=()=>{}}){
 const [groqEnabled,setGroqEnabled]=useState(false);
 const [selected,setSelected]=useState('browser');
 useEffect(()=>{
  let mounted=true;
  fetch('/api/free-transcription',{method:'GET',cache:'no-store'})
   .then(r=>r.json()).then(v=>{if(mounted&&v?.available){setGroqEnabled(true);setSelected('groq');}})
   .catch(()=>{});
  return()=>{mounted=false;};
 },[]);
 return <div className="q-voice-hub">
  {groqEnabled&&<div className="q-voice-tabs" role="group" aria-label="Escolher forma de transcrição">
    <button type="button" className={selected==='groq'?'selected':''}
      onClick={()=>setSelected('groq')}>Whisper por IA — cota grátis</button>
    <button type="button" className={selected==='browser'?'selected':''}
      onClick={()=>setSelected('browser')}>Microfone do navegador</button>
  </div>}
  {groqEnabled&&selected==='groq'?
    <Suspense fallback={<p>Preparando gravador...</p>}><GroqRecorder onInsertTranscript={onInsertTranscript}/></Suspense>:
    <BrowserDictation onInsertTranscript={onInsertTranscript}/>}
  {!groqEnabled&&<p className="q-voice-explain">Whisper gratuito opcional ainda não configurado neste ambiente. O microfone do navegador continua disponível.</p>}
 </div>;
}
