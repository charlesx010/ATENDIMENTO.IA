import React,{useEffect,useState} from 'react';
import {Activity,ArrowLeft,ArrowRight,Eye,EyeOff,Mic,MonitorSmartphone,Sparkles} from 'lucide-react';
import {configured,supabase,validUsername} from '../supabase.js';
export default function AccessGate({pathname,onLogin,onDemo}){
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  let route='';try{route=decodeURIComponent(pathname.slice(1).split('/')[0]||'').toLowerCase()}catch{}
  const target=validUsername(route)&&route!=='demo'?route:null;
  useEffect(()=>{setPassword('');setError('')},[target]);
  function go(path){history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));}
  async function submit(event){
    event.preventDefault();setError('');
    if(!target){const name=username.trim().toLowerCase();if(!validUsername(name)){setError('Use de 3 a 30 caracteres: letras, números, hífen ou sublinhado; comece com uma letra.');return;}go('/'+name);return;}
    if(!configured||busy)return;
    setBusy(true);
    try{
      const response=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:target,password}),signal:AbortSignal.timeout(20000)});
      const result=await response.json().catch(()=>({}));
      if(response.status===503)throw Error('O serviço de acesso está indisponível neste ambiente. Sua senha não foi confirmada. Peça à administração que confira a conexão do servidor.');
      if(!response.ok||!result.access_token||!result.refresh_token)throw Error('Não foi possível entrar. Confira usuário e senha ou tente novamente mais tarde.');
      const {data,error:authError}=await supabase.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
      if(authError||!data?.user)throw Error('Não foi possível confirmar a sessão.');
      setPassword('');onLogin(data.user);
    }catch(e){setError(e.name==='TimeoutError'?'O acesso demorou demais. Tente novamente.':e.message)}finally{setBusy(false)}
  }
  return <div className="auth-v2"><section className="a-story"><a className="a-brand" href="/" onClick={e=>{e.preventDefault();go('/')}}><Activity/> Prontuário.IA</a><div className="a-story-body"><span className="a-kicker">SEU ASSISTENTE DE DOCUMENTAÇÃO</span><h1>Fale no celular.<br/>Revise no computador.<br/><em>Volte ao que importa.</em></h1><p>Transforme o relato do atendimento em um prontuário organizado, com o original sempre disponível para sua revisão.</p><div className="a-feature"><Mic/><div><strong>Capture com sua voz</strong><span>Ditado e transcrição por IA, com revisão do texto.</span></div></div><div className="a-feature"><Sparkles/><div><strong>Organize sem perder o contexto</strong><span>Resumo factual, SOAP e informações a confirmar.</span></div></div><div className="a-feature"><MonitorSmartphone/><div><strong>Continue em outro aparelho</strong><span>Uma consulta temporária, na mesma conta.</span></div></div></div><footer>Versão de testes · use somente dados fictícios.</footer></section>
    <main className="a-access"><div className="a-mobile-brand"><Activity/> Prontuário.IA</div><section className="a-card"><span className="a-kicker">BEM-VINDO AO SEU ESPAÇO</span><h2>{target?`Entrar como ${target}`:'Uma consulta mais simples.'}</h2><p>{target?'Use a senha da sua conta para continuar.':'Entre com seu usuário ou conheça o fluxo na demonstração.'}</p><form onSubmit={submit}>{!target?<label>Nome de usuário<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Ex.: charles" autoComplete="username" required maxLength={30}/></label>:<label>Senha<div className="a-password"><input type={visible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" minLength={8} maxLength={128} required/><button type="button" onClick={()=>setVisible(v=>!v)} aria-label={visible?'Ocultar senha':'Mostrar senha'}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>}<button className="a-primary" disabled={busy||Boolean(target&&!configured)}>{busy?'Entrando…':target?'Entrar na minha conta':'Continuar'}<ArrowRight size={17}/></button></form>{error&&<p className="a-error" role="alert">{error}</p>}{target&&<button className="a-back" onClick={()=>go('/')}><ArrowLeft size={14}/> Trocar usuário</button>}{!configured&&<p className="a-config-note">O acesso à conta depende da configuração do Supabase. Você pode testar a demonstração agora, sem login.</p>}<div className="a-or">OU EXPLORE PRIMEIRO</div><button className="a-demo" onClick={onDemo}><Sparkles size={17}/> Abrir demonstração gratuita</button><small>A demonstração funciona nesta aba. Para sincronizar e usar IA, configure os serviços e entre na sua conta.</small></section><footer>Prontuário.IA 2.1.1 · Documentação com revisão humana.</footer></main></div>;
}
