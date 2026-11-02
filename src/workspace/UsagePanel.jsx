import React,{useCallback,useEffect,useState} from 'react';
import {supabase} from '../supabase.js';
function validUsage(body) {
  if(body?.enforced===false&&body?.accounting==='provider-limits'&&body.operations===null)return true;
  return body?.accounting === 'attempts' && typeof body.resetsAt==='string' && Number.isFinite(Date.parse(body.resetsAt)) && ['documentation','transcription'].every(key=>{
    const item=body.operations?.[key];
    return item && ['used','limit','remaining','burstLimit'].every(k=>Number.isSafeInteger(item[k])&&item[k]>=0);
  });
}
export default function UsagePanel({demo}) {
  const [state,setState]=useState({phase:'idle'}),[reload,setReload]=useState(0);
  useEffect(()=>{
    if(demo)return;
    const controller=new AbortController();let alive=true;
    const timer=setTimeout(()=>controller.abort(),15000);
    setState({phase:'loading'});
    (async()=>{try{
      const {data}=await supabase.auth.getSession();if(!data?.session?.access_token)throw Error('Entre novamente para consultar o consumo.');
      const r=await fetch('/api/account-usage',{headers:{authorization:'Bearer '+data.session.access_token},cache:'no-store',signal:controller.signal});
      const body=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(body.error||'Não foi possível consultar os limites.');
      if(!validUsage(body))throw Error('O servidor não informou o consumo em um formato válido.');
      if(alive)setState({phase:'ready',data:body});
    }catch(e){if(alive)setState({phase:'error',message:e.name==='AbortError'?'A consulta demorou demais. Tente novamente.':e.message});}
    finally{clearTimeout(timer);}})();
    return()=>{alive=false;controller.abort();clearTimeout(timer)};
  },[demo,reload]);
  return <section aria-label="Meu uso"><div className="w-heading"><div><div className="w-eyebrow">TRANSPARÊNCIA NA SUA CONTA</div><h1>Meu uso e recursos</h1><p>Acompanhe os limites operacionais, sem cobrança automática pelo aplicativo.</p></div>{!demo&&<button className="w-button" disabled={state.phase==='loading'} onClick={()=>setReload(n=>n+1)}>Atualizar consumo</button>}</div>
    {demo?<section className="w-card"><h2>Conheça antes de ativar</h2><p>A demonstração oferece edição, organização literal, roteiros, backup e impressão revisada sem acessar sua conta. Consumo real de IA aparece após configurar os serviços e entrar.</p><p>Não há assinatura, pagamento ou renovação ativados nesta versão. Os limites de uso não representam um plano comercial contratado.</p></section>:state.phase==='loading'?<p role="status">Consultando os limites da conta…</p>:state.phase==='error'?<div className="w-alert" role="alert">{state.message} Seu rascunho continua nesta aba.</div>:state.phase==='ready'&&state.data.enforced===false?<section className="w-card"><h2>Configuração anterior preservada</h2><p>O controle de cotas do aplicativo ainda não foi ativado. Os recursos anteriores continuam sujeitos aos limites do provedor e à autenticação da conta.</p><p>Não há saldo nem contagem local disponíveis. A nova área de documentação exige a ativação de suas cotas antes do primeiro pedido.</p></section>:state.phase==='ready'?<>
      <div className="w-usage-grid">{[['documentation','Resumo e prontuário'],['transcription','Transcrição de áudio']].map(([key,label])=>{const item=state.data.operations[key];return <section className="w-card" key={key}><h2>{label}</h2><p className="w-usage-number">{item.remaining}<span>tentativas restantes hoje</span></p><progress aria-label={label+' utilizado'} value={Math.min(item.used,item.limit)} max={Math.max(item.limit,1)}/><p>{item.used} de {item.limit} tentativas utilizadas.</p><p className="w-muted">Até {item.burstLimit} tentativas por minuto. {state.data.features?.[key]?'Recurso configurado.':'Recurso ainda não habilitado.'}</p></section>})}</div>
      <section className="w-card"><h3>Como o uso é contabilizado</h3><p>Tentativas autorizadas são contabilizadas antes do envio, inclusive se o provedor falhar. Pedidos rejeitados por limite não consomem nova tentativa. Não há troca automática para um serviço pago.</p><p>Renovação dos limites: {new Date(state.data.resetsAt).toLocaleString('pt-BR')}.</p><p className="w-muted">A franquia é por conta e vale entre seus aparelhos. Cotas e faturamento do provedor são independentes; confirme-os com quem administra o acesso.</p></section>
    </>:null}
  </section>;
}
