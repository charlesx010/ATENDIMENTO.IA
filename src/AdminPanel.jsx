import React, {useEffect,useState} from 'react';
import { UserPlus, Users, ShieldCheck, RotateCcw, LockKeyhole, Copy, Check, AlertTriangle } from 'lucide-react';
import { supabase } from './supabase';

export default function AdminPanel() {
  const [users,setUsers]=useState([]), [loading,setLoading]=useState(false);
  const [username,setUsername]=useState(''),[displayName,setDisplayName]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[secret,setSecret]=useState(null);
  const [busy,setBusy]=useState(false);
  const [myAi,setMyAi]=useState({enabled:false,limit:0}),[aiLoading,setAiLoading]=useState(true);

  async function admin(action,data={}) {
    const {data:s} = await supabase.auth.getSession();
    if(!s?.session?.access_token) throw Error('Sessão expirada. Entre novamente.');
    const response=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${s.session.access_token}`},body:JSON.stringify({action,...data})});
    const body=await response.json();
    if(!response.ok) throw Error(body.error || 'Erro na operação.');
    return body;
  }
  async function refresh() {
    setLoading(true);setError('');
    try {setUsers((await admin('list')).users || []);} catch(e){setError(e.message);} finally{setLoading(false);}
  }
  useEffect(()=>{refresh();loadMyAi();},[]);
  async function loadMyAi(){
    setAiLoading(true);
    try{
      const r=await admin('my_ai');
      setMyAi({enabled:Boolean(r.aiEnabled),limit:Number(r.monthlyLimit)||0});
    }catch(e){setError(e.message);}
    finally{setAiLoading(false);}
  }
  async function saveMyAi(e){
    e.preventDefault();
    if(myAi.enabled && !window.confirm('Ativar transcrição paga para esta conta? O áudio de teste será enviado à OpenAI somente após sua autorização, quando você parar a gravação. O limite exibido é uma estimativa local e não substitui os limites da OpenAI.'))return;
    setBusy(true);setError('');setNotice('');
    try{
      await admin('update_self_ai',{aiEnabled:myAi.enabled,monthlyLimit:Number(myAi.limit)});
      setNotice('Configurações de IA salvas. Atualize a página para aplicar ao atendimento.');
      await refresh();
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  async function create(e) {
    e.preventDefault(); setBusy(true);setError('');setSecret(null);
    try {const r=await admin('create',{username:username.trim().toLowerCase(),displayName:displayName.trim()});setSecret({username:r.username,password:r.temporaryPassword});setUsername('');setDisplayName('');await refresh();}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function alter(u,fields){setError('');setNotice('');setBusy(true);try {await admin('update',{userId:u.user_id,...fields});setNotice('Conta atualizada.');await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function reset(u) {if(!window.confirm(`Gerar nova senha temporária para ${u.username}?`))return;setBusy(true);setError('');try{const r=await admin('reset_password',{userId:u.user_id});setSecret({username:u.username,password:r.temporaryPassword});}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div className="stack-lg">
    <div className="section-intro"><div className="eyebrow"><ShieldCheck size={15}/> ADMINISTRAÇÃO</div><h2>Gestão de usuários</h2><p>Contas individuais, controle de acesso e permissões. Conteúdos clínicos não aparecem neste painel.</p></div>
    {error && <div className="alert error"><AlertTriangle size={17}/>{error}</div>}{notice&&<div className="alert success"><Check size={17}/>{notice}</div>}
    <div className="stat-grid"><div className="stat"><span>Usuários cadastrados</span><strong>{users.length}</strong></div><div className="stat"><span>Contas habilitadas</span><strong>{users.filter(u=>u.enabled).length}</strong></div><div className="stat"><span>IA habilitada</span><strong>{users.filter(u=>u.ai_enabled).length}</strong></div></div>
    <section className="panel"><div className="panel-heading"><div><h3><ShieldCheck size={18}/> Transcrição com IA — minha conta</h3>
      <p>Desativada por padrão. Só use para testes fictícios após configurar sua nova chave privada no Netlify.</p></div></div>
      {aiLoading?<p className="hint">Verificando autorização...</p>:
      <form onSubmit={saveMyAi} className="stack-lg">
        <label className="voice-confirm"><input type="checkbox" checked={myAi.enabled}
          onChange={e=>setMyAi(v=>({...v,enabled:e.target.checked}))}/><span>Autorizar transcrição paga da minha conta</span></label>
        <label>Limite mensal estimado (US$ 0 a US$ 2)
          <input inputMode="decimal" type="number" step="0.1" min="0" max="2"
            value={myAi.limit} onChange={e=>setMyAi(v=>({...v,limit:e.target.value}))}/>
        </label>
        <p className="hint">Reserva conservadora de US$ 0,02 por transcrição. É uma proteção aproximada do aplicativo; confira também orçamento e uso reais na OpenAI. Nenhum gasto é ativado sem chave válida e autorização.</p>
        <button className="btn primary" type="submit" disabled={busy}>Salvar autorização e limite</button>
      </form>}
    </section>
    <section className="panel"><div className="panel-heading"><div><h3><UserPlus size={18}/> Adicionar médico</h3><p>Somente o administrador pode criar novos endereços.</p></div></div>
      <form className="form-grid" onSubmit={create}>
        <label>Nome de exibição<input value={displayName} onChange={e=>setDisplayName(e.target.value)} required minLength={2} maxLength={90} placeholder="Ex.: Dra. Maria Silva" /></label>
        <label>Usuário do endereço<input value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} required pattern="[a-z][a-z0-9_-]{2,29}" placeholder="ex.: maria"/><small>Exemplo: /maria</small></label>
        <button className="btn primary" type="submit" disabled={busy}>Criar conta e senha temporária</button>
      </form>
    </section>
    {secret&&<div className="alert secret"><LockKeyhole size={19}/><div><strong>Credenciais temporárias — copie agora</strong><p>Endereço: /{secret.username}</p><p>Senha: <code>{secret.password}</code></p><p>A senha não aparecerá novamente. Entregue-a por canal seguro.</p></div><button className="icon-btn" title="Copiar senha" onClick={()=>navigator.clipboard?.writeText(secret.password)}><Copy size={17}/></button></div>}
    <section className="panel"><div className="panel-heading"><div><h3><Users size={18}/> Contas existentes</h3><p>A transcrição pode ser autorizada por conta, com limite financeiro.</p></div><button onClick={refresh} className="btn subtle" disabled={loading}><RotateCcw size={15}/> Atualizar</button></div>
      <div className="user-list">{users.map(u=><div className="user-item" key={u.user_id}><div className="user-avatar">{u.display_name?.charAt(0)?.toUpperCase()||'M'}</div><div className="user-info"><strong>{u.display_name}</strong><span>/{u.username} • {u.role==='admin'?'Administrador':'Médico'} • {u.enabled?'Ativo':'Bloqueado'}</span></div>{u.role!=='admin'&&<div className="user-actions"><button className="btn subtle small" disabled={busy} onClick={()=>alter(u,{enabled:!u.enabled})}>{u.enabled?'Bloquear':'Reativar'}</button><button className="btn subtle small" disabled={busy} onClick={()=>reset(u)}>Redefinir senha</button></div>}</div>)}</div>
    </section>
    <div className="alert info"><ShieldCheck size={18}/><div><strong>Segurança administrativa</strong><p>O painel exige autenticação TOTP validada (AAL2). A transcrição exige chave privada no servidor e limite individual. O valor é uma reserva estimada e não um extrato oficial de gastos.</p></div></div>
  </div>;
}
