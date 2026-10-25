import React,{useEffect,useRef,useState} from 'react';
import {Camera,FileText,Paperclip,Trash2,ScanText,LoaderCircle,AlertTriangle} from 'lucide-react';
import {extractLocalText,extractionMessage,validateExamFile} from './localOcr.js';

export {validateExamFile} from './localOcr.js';

export default function ExamAttachments({onInsertText=()=>{}}){
 const [file,setFile]=useState(null);
 const [preview,setPreview]=useState('');
 const [reportText,setReportText]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [progress,setProgress]=useState(0);
 const [lowConfidence,setLowConfidence]=useState(false);
 const job=useRef(0);
 useEffect(()=>{
  if(!file?.type?.startsWith('image/')){setPreview('');return;}
  const url=URL.createObjectURL(file);setPreview(url);
  return()=>URL.revokeObjectURL(url);
 },[file]);

 async function readFile(selected,currentJob){
  setBusy(true);setProgress(0);setLowConfidence(false);
  setMessage('Preparando leitura local. O arquivo não será enviado para outro serviço.');
  try{
   const result=await extractLocalText(selected,event=>{
    if(currentJob!==job.current)return;
    setProgress(Number(event?.progress||0));
    if(event?.stage==='page')setMessage('Lendo página '+event.page+' de '+event.total+' localmente...');
    else if(event?.stage==='render')setMessage('Preparando página '+event.page+' de '+event.total+'...');
    else if(event?.stage==='pdf-text')setMessage('Extraindo texto da página '+event.page+' de '+event.total+'...');
    else setMessage('Reconhecendo texto localmente... '+Number(event?.progress||0)+'%');
   });
   if(currentJob!==job.current)return;
   setReportText(result.text);
   setLowConfidence(Number.isFinite(result.confidence)&&result.confidence<70);
   setMessage(extractionMessage(result));
  }catch(error){
   if(currentJob!==job.current)return;
   setReportText('');
   setMessage(error?.message||'Não foi possível ler o arquivo. Cole o texto manualmente.');
  }finally{
   if(currentJob===job.current)setBusy(false);
  }
 }

 async function selectFile(event){
  const selected=event.target.files?.[0]||null;
  const error=validateExamFile(selected);
  job.current+=1;
  if(error){setFile(null);setPreview('');setReportText('');setMessage(error);return;}
  setFile(selected);setReportText('');setMessage('');
  await readFile(selected,job.current);
 }

 function removeFile(){
  job.current+=1;setFile(null);setPreview('');setReportText('');setMessage('');setProgress(0);setBusy(false);setLowConfidence(false);
 }
 function insert(){
  const text=reportText.trim();
  if(!text){setMessage('Revise ou digite o texto do laudo antes de inserir.');return;}
  onInsertText('EXAME ANEXADO — '+(file?.name||'sem arquivo')+'\n'+text);
  setMessage('Exame inserido no atendimento. Ao gerar com a Groq Free, ele entrará no resumo clínico. Revise o conteúdo.');
 }
 return <section className="q-box q-simple-card q-exam-attachments" aria-busy={busy}>
  <h2><Paperclip size={17}/> Exame ou laudo — OCR local</h2>
  <p>Tire uma foto ou anexe JPG, PNG, WEBP, PDF ou TXT. A leitura acontece neste navegador; o arquivo não é salvo no banco nem enviado à IA.</p>
  <p className="q-clinical-review"><strong>Limites de segurança:</strong> somente exames fictícios neste preview. O OCR transcreve texto, mas não interpreta radiografias, tomografias ou outras imagens diagnósticas.</p>
  <label className={'btn outline q-file-button'+(busy?' disabled':'')}><Camera size={16}/> Tirar foto ou escolher arquivo
   <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" capture="environment" disabled={busy} onChange={selectFile}/>
  </label>
  {file&&<div className="q-attachment-summary"><FileText size={16}/><span>{file.name} · {(file.size/1024/1024).toFixed(2)} MB</span>
   <button type="button" className="q-icon" aria-label="Remover anexo" disabled={busy} onClick={removeFile}><Trash2 size={15}/></button></div>}
  {preview&&<img className="q-exam-preview" src={preview} alt="Pré-visualização local do exame anexado"/>}
  {busy&&<div className="q-ocr-progress" role="status"><LoaderCircle className="q-spin" size={17}/>
   <span>{message}</span><progress max="100" value={progress}/></div>}
  {lowConfidence&&<p className="q-clinical-review" role="alert"><AlertTriangle size={14}/> Leitura com baixa confiança. Compare cuidadosamente com o documento original.</p>}
  <label className="q-simple-field">Texto extraído — revisar antes de inserir
   <textarea rows={7} value={reportText} disabled={busy} onChange={event=>setReportText(event.target.value)}
    placeholder="O OCR preencherá este campo automaticamente. Você também pode colar ou corrigir o texto."/>
  </label>
  <button className="btn primary" type="button" onClick={insert} disabled={busy||!reportText.trim()}>
   <ScanText size={16}/> Inserir exame no atendimento</button>
  {!busy&&message&&<p className="q-feedback" role="status">{message}</p>}
 </section>;
}
