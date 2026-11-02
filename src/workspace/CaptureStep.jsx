import React,{lazy,Suspense} from 'react';
import {Mic,ArrowRight} from 'lucide-react';
import {MAX_SOURCE,sourceChanged} from './model.js';
const BrowserDictation=lazy(()=>import('../BrowserDictation.jsx'));
const GroqRecorder=lazy(()=>import('../GroqRecorder.jsx'));
const ExamAttachments=lazy(()=>import('../ExamAttachments.jsx'));
export default function CaptureStep({doc,guide,onDismissGuide,patch,voice,onVoiceChange,captureKey,demo,insert,onVoicePending,onAttachmentPending,setDoc,onExample,onNext}){
 return <><div className="w-section-heading"><div><h2>O atendimento começa pelo relato</h2><p>Fale como costuma registrar. Você confere a transcrição antes de inserir.</p></div><Mic size={22}/></div>
            {guide&&<section className="w-capture-guide"><div><strong>{guide.title} · roteiro</strong><button className="w-text-button" onClick={()=>onDismissGuide()}>Fechar roteiro</button></div><pre>{guide.body}</pre><p>Guia de perguntas. Registre apenas o que foi informado ou realizado.</p></section>}
            <label className="w-field">Identificador fictício da consulta<input value={doc.patient} maxLength={100} placeholder="Ex.: Caso de teste 001" onChange={e=>patch({patient:e.target.value})}/></label>
            <div className="w-segmented"><button className={voice==='browser'?'active':''} onClick={()=>onVoiceChange('browser')}>Ditado do navegador</button><button className={voice==='ai'?'active':''} onClick={()=>onVoiceChange('ai')}>Microfone com IA</button></div>
            <Suspense key={captureKey} fallback={<p>Preparando microfone…</p>}>{voice==='browser'?<BrowserDictation onInsertTranscript={insert} onPendingChange={onVoicePending}/>:demo?<div className="w-empty"><Mic/><h3>Whisper precisa de uma conta</h3><p>Gravação por IA usa Groq no servidor. A demonstração oferece ditado do navegador e edição de texto.</p></div>:<GroqRecorder onInsertTranscript={insert} onPendingChange={onVoicePending}/>}</Suspense>
            <details className="w-attachments"><summary>Anexar exame ou laudo fictício · OCR local</summary><Suspense fallback={<p>Preparando leitura local…</p>}><ExamAttachments key={captureKey} onInsertText={insert} onPendingChange={onAttachmentPending}/></Suspense></details>
            <div className="w-section-divider"/><label className="w-field">Relato original · editável<textarea aria-label="Relato original" rows={9} value={doc.source} maxLength={MAX_SOURCE} placeholder="Digite ou insira a transcrição do atendimento aqui…" onChange={e=>{setDoc(d=>sourceChanged(d,e.target.value))}}/></label>
            <div className="w-field-footer"><span>{doc.source.length.toLocaleString('pt-BR')} / 6.000 caracteres</span>{!doc.source&&<button onClick={onExample}>Carregar exemplo fictício</button>}</div>
            <button className="w-button primary w-next" disabled={!doc.source.trim()} onClick={onNext}>Organizar prontuário <ArrowRight size={17}/></button>
          </>;
}
