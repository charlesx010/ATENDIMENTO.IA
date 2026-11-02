import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '../supabase.js';
import {exportTemplateLibrary,parseTemplateLibrary} from './templates.js';
export default function TemplateCloudPanel({active,demo,templates,setTemplates,onStatus}){
  const [state,setState]=useState({phase:'idle',server:null}),alive=useRef(true),controller=useRef(null),latest=useRef(templates);latest.current=templates;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort()}},[]);
  async function call(method,body){
    const abort=new AbortController();controller.current=abort;const timer=setTimeout(()=>abort.abort(),15000);
    try{
      const {data}=await supabase.auth.getSession();if(!data?.session?.access_token)throw Error('Entre novamente para acessar seus modelos.');
      const response=await fetch('/api/personal-templates',{method,headers:{authorization:'Bearer '+data.session.access_token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:abort.signal});
      const result=response.status===204?null:await response.json().catch(()=>({}));
      if(response.status===409){const error=Error('Os modelos foram alterados em outro aparelho. Seu conteúdo local foi preservado. Carregue a versão da conta ou exporte antes de continuar.');error.conflict=true;throw error;}
      if(!response.ok)throw Error(result?.error||'Não foi possível acessar os modelos da conta.');
      if(result&&result.library)parseTemplateLibrary(result.library);
      return result;
    }finally{clearTimeout(timer);if(controller.current===abort)controller.current=null;}
  }
  async function read(load=false){
    if(load&&!window.confirm('Carregar os modelos da conta substitui a biblioteca desta aba. Exporte primeiro se quiser preservar suas alterações locais.'))return;
    const localSnapshot=exportTemplateLibrary(latest.current);
    setState(s=>({...s,phase:'loading'}));
    try{const result=await call('GET');if(!alive.current)return;
      if(!result||!Object.hasOwn(result,'version'))throw Error('Resposta de modelos inválida.');
      if(load&&exportTemplateLibrary(latest.current)!==localSnapshot){setState({phase:'conflict',server:result,message:'A biblioteca local mudou durante o carregamento. Suas alterações foram preservadas. Exporte-as antes de carregar novamente.'});return;}
      setState({phase:'ready',server:result});
      if(load){if(result.library){setTemplates(parseTemplateLibrary(result.library));onStatus('Biblioteca da conta carregada.');}else onStatus('Sua conta ainda não possui modelos salvos. A biblioteca local foi preservada.');}
    }catch(e){if(alive.current)setState(s=>({...s,phase:e.conflict?'conflict':'error',message:e.name==='AbortError'?'A conexão demorou demais. Tente novamente.':e.message}));}
  }
  useEffect(()=>{if(active&&!demo&&state.phase==='idle')read();},[active,demo,state.phase]);
  async function save(){
    if(state.phase!=='ready')return;
    if(state.server?.version&&!window.confirm('Substituir os modelos da conta por esta biblioteca? Uma versão alterada em outro aparelho será protegida contra sobrescrita.'))return;
    let snapshot;try{snapshot=JSON.parse(exportTemplateLibrary(templates));}catch(e){setState(s=>({...s,phase:'error',message:e.message}));return;}setState(s=>({...s,phase:'saving'}));
    try{const result=await call('PUT',{expectedVersion:state.server?.version??null,library:snapshot});if(!alive.current)return;setState({phase:'ready',server:result});onStatus(exportTemplateLibrary(latest.current)!==JSON.stringify(snapshot,null,2)?'A versão enviada foi salva na conta. Há alterações mais recentes somente nesta aba; salve novamente para incluí-las.':'Modelos salvos na conta. Para continuar em outro aparelho, escolha Carregar da conta.');}
    catch(e){if(alive.current)setState(s=>({...s,phase:e.conflict?'conflict':'error',message:e.name==='AbortError'?'Tempo excedido. Confira a versão da conta antes de tentar salvar novamente.':e.message}));}
  }
  async function remove(){
    if(!state.server?.version||!window.confirm('Excluir a biblioteca salva na conta? Os modelos desta aba serão preservados.'))return;
    setState(s=>({...s,phase:'saving'}));
    try{await call('DELETE',{expectedVersion:state.server.version});if(!alive.current)return;setState({phase:'ready',server:{version:null,library:null}});onStatus('Biblioteca removida da conta. Exporte ou salve novamente se desejar.');}
    catch(e){if(alive.current)setState(s=>({...s,phase:e.conflict?'conflict':'error',message:e.message}));}
  }
  if(demo)return <section className="w-pilot-summary"><strong>Seus roteiros em outro aparelho</strong><p>Entre com sua conta para salvar e carregar a biblioteca entre PC e celular. Na demonstração, exporte o arquivo de modelos para guardá-lo.</p></section>;
  const busy=['loading','saving'].includes(state.phase);
  return <section className="w-card w-template-cloud" aria-label="Modelos na conta"><h2>Biblioteca na sua conta</h2><p>Guarde apenas roteiros e perguntas reutilizáveis. Não inclua nomes, resultados ou dados de pacientes. A biblioteca permanece na conta até ser excluída, separada da consulta temporária.</p>
    {busy&&<p role="status">{state.phase==='saving'?'Salvando alterações…':'Consultando a biblioteca…'}</p>}
    {['error','conflict'].includes(state.phase)&&<p className="w-alert" role="alert">{state.message}</p>}
    <div className="w-actions"><button className="w-button primary" disabled={state.phase!=='ready'} onClick={save}>Salvar modelos na conta</button><button className="w-button" disabled={busy} onClick={()=>read(true)}>Carregar da conta</button>{state.server?.version&&<button className="w-button" disabled={busy} onClick={remove}>Excluir da conta</button>}</div>
    <p className="w-muted">Salvamento explícito, com proteção de versão. Alterar um modelo nesta aba não muda automaticamente o que está salvo na conta.</p>
  </section>;
}
