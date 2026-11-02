import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy, EyeOff, LockKeyhole, RotateCcw, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { supabase } from './supabase.js';

const SECRET_DISPLAY_MS = 120000;
const REQUEST_TIMEOUT_MS = 20000;
const requestError = status => status === 401 ? 'Sua sessão expirou. Entre novamente.'
  : status === 403 ? 'Acesso administrativo não autorizado. Verifique sua conta e o segundo fator.'
  : status === 409 ? 'A operação não pôde ser concluída. Confira se o usuário já existe e atualize a lista.'
  : status === 429 ? 'Há muitas solicitações. Aguarde antes de tentar novamente.'
  : 'Não foi possível concluir a operação. Confira a conexão e tente novamente.';

export default function AdminPanel() {
  const [users, setUsers] = useState([]), [loading, setLoading] = useState(false), [loaded, setLoaded] = useState(false);
  const [username, setUsername] = useState(''), [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [secret, setSecret] = useState(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true), requests = useRef(new Set()), refreshRevision = useRef(0);

  async function admin(action, data = {}) {
    const controller = new AbortController();
    requests.current.add(controller);
    let timer;
    try {
      return await Promise.race([
        (async () => {
          const { data: session, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session?.session?.access_token) throw Error(requestError(401));
          const response = await fetch('/api/admin', {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.session.access_token}` },
            body: JSON.stringify({ action, ...data }), signal: controller.signal
          });
          if (!response.ok) throw Error(requestError(response.status));
          try { return await response.json(); } catch { throw Error('Resposta administrativa inválida. Tente atualizar a lista.'); }
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('A operação demorou demais. Confira a conexão e tente novamente.')); }, REQUEST_TIMEOUT_MS); })
      ]);
    } finally { clearTimeout(timer); requests.current.delete(controller); }
  }
  async function refresh() {
    const revision = ++refreshRevision.current;
    setLoading(true); setError('');
    try {
      const result = await admin('list');
      if (!mounted.current || revision !== refreshRevision.current) return;
      if (!Array.isArray(result.users)) throw Error('A lista de contas não foi recebida corretamente.');
      setUsers(result.users.filter(user => typeof user?.user_id === 'string'));
      setLoaded(true);
    } catch (cause) { if (mounted.current && revision === refreshRevision.current) setError(cause.name === 'AbortError' ? 'Solicitação cancelada. Tente atualizar a lista.' : cause.message || requestError()); }
    finally { if (mounted.current && revision === refreshRevision.current) setLoading(false); }
  }
  useEffect(() => {
    mounted.current = true; refresh();
    return () => { mounted.current = false; refreshRevision.current += 1; requests.current.forEach(controller => controller.abort()); requests.current.clear(); };
  }, []);
  useEffect(() => {
    if (!secret) return;
    const timer = setTimeout(() => {
      setSecret(null); setNotice('A credencial temporária foi ocultada desta tela. A senha não foi revogada; redefina-a se não conseguiu entregá-la com segurança.');
    }, SECRET_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [secret]);
  function showSecret(account, password) {
    if (typeof password !== 'string' || !password || typeof account !== 'string') throw Error('A conta foi atualizada, mas a credencial não foi recebida. Atualize a lista e redefina a senha, se necessário.');
    setSecret({ username: account, password });
  }
  async function create(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice(''); setSecret(null);
    try {
      const result = await admin('create', { username: username.trim().toLowerCase(), displayName: displayName.trim() });
      if (!mounted.current) return;
      showSecret(result.username, result.temporaryPassword); setUsername(''); setDisplayName('');
      setNotice('Conta criada. Entregue a senha temporária por canal seguro; a troca será solicitada no primeiro acesso.');
      await refresh();
    } catch (cause) { if (mounted.current) setError(cause.message || requestError()); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function toggleAccess(user) {
    if (busy || (user.enabled && !window.confirm(`Bloquear novos acessos e operações da conta /${user.username}?`))) return;
    setError(''); setNotice(''); setBusy(true);
    try {
      await admin('update', { userId: user.user_id, enabled: !user.enabled });
      if (!mounted.current) return;
      setNotice(user.enabled ? 'Conta bloqueada para novas operações. Isso não remove textos já abertos na memória de outro aparelho.' : 'Conta reativada.');
      await refresh();
    } catch (cause) { if (mounted.current) setError(cause.message || requestError()); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function reset(user) {
    if (busy || !window.confirm(`Gerar uma nova senha temporária para /${user.username}? A senha anterior será substituída.`)) return;
    setBusy(true); setError(''); setNotice(''); setSecret(null);
    try {
      const result = await admin('reset_password', { userId: user.user_id });
      if (!mounted.current) return;
      showSecret(user.username, result.temporaryPassword);
      setNotice('Senha redefinida. Entregue a nova credencial por canal seguro.');
    } catch (cause) { if (mounted.current) setError(cause.message || requestError()); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function copySecret() {
    if (!secret) return;
    try {
      if (!navigator.clipboard?.writeText) throw Error('clipboard_unavailable');
      await navigator.clipboard.writeText(secret.password);
      if (mounted.current) { setError(''); setNotice('Senha copiada. Entregue-a por canal seguro e limpe sua área de transferência depois.'); }
    } catch { if (mounted.current) setError('O navegador não permitiu copiar. Selecione a senha exibida e copie manualmente por um canal seguro.'); }
  }
  function dismissSecret() { setSecret(null); setNotice('Credencial ocultada nesta tela. Isso não revoga a senha.'); }
  const count = predicate => loaded ? users.filter(predicate).length : '—';
  return <div className="admin-panel stack-lg">
    <div className="section-intro"><div className="eyebrow"><ShieldCheck size={15}/> ADMINISTRAÇÃO</div><h2>Gestão de contas</h2><p>Crie contas individuais e controle o acesso. Relatos, prontuários e outros conteúdos clínicos não aparecem neste painel.</p></div>
    {error && <div className="alert error" role="alert"><AlertTriangle size={17}/>{error}</div>}{notice && <div className="alert success" role="status"><Check size={17}/>{notice}</div>}
    <div className="stat-grid admin-stat-grid"><div className="stat"><span>Contas cadastradas</span><strong>{loaded ? users.length : '—'}</strong></div><div className="stat"><span>Contas habilitadas</span><strong>{count(user => user.enabled)}</strong></div><div className="stat"><span>Contas bloqueadas</span><strong>{count(user => !user.enabled)}</strong></div></div>
    <section className="panel admin-create"><div className="panel-heading"><div><h3><UserPlus size={18}/> Adicionar profissional</h3><p>Somente administradores podem criar contas. O novo usuário deve trocar a senha temporária.</p></div></div>
      <form className="form-grid" onSubmit={create}>
        <label>Nome de exibição<input value={displayName} onChange={event => setDisplayName(event.target.value)} required minLength={2} maxLength={90} placeholder="Ex.: Dra. Maria Silva" autoComplete="off"/></label>
        <label>Nome de usuário<input value={username} onChange={event => setUsername(event.target.value.toLowerCase())} required pattern="[a-z][a-z0-9_-]{2,29}" maxLength={30} placeholder="Ex.: maria" autoComplete="off"/><small>O endereço da conta será /maria.</small></label>
        <button className="btn primary" type="submit" disabled={busy || loading}>Criar conta e senha temporária</button>
      </form>
    </section>
    {secret && <section className="alert secret admin-secret" aria-label="Credencial temporária recém-gerada"><LockKeyhole size={19}/><div><strong>Credencial temporária</strong><p>Conta: /{secret.username}</p><p>Senha: <code tabIndex={0}>{secret.password}</code></p><p>Exibição limitada a dois minutos nesta tela. Isso não é um prazo de validade da senha. Entregue por canal seguro; se perder o acesso a esta exibição, redefina a senha.</p><div className="w-actions"><button className="btn primary" onClick={copySecret}><Copy size={17}/> Copiar senha</button><button className="btn subtle" onClick={dismissSecret}><EyeOff size={17}/> Ocultar credencial</button></div></div></section>}
    <section className="panel"><div className="panel-heading"><div><h3><Users size={18}/> Contas existentes</h3><p>Bloqueio, reativação e redefinição de senha. Administradores não podem ser alterados por esta lista.</p></div><button onClick={refresh} className="btn subtle" disabled={loading || busy}><RotateCcw size={15}/> Atualizar</button></div>
      {loading && <p role="status">Atualizando contas…</p>}
      {!loading && loaded && users.length === 0 && <p>Nenhuma conta foi encontrada.</p>}
      <div className="user-list admin-user-list">{users.map(user => <div className="user-item" key={user.user_id}><div className="user-avatar" aria-hidden="true">{user.display_name?.charAt(0)?.toUpperCase() || 'P'}</div><div className="user-info"><strong>{user.display_name}</strong><span>/{user.username} · {user.role === 'admin' ? 'Administrador' : 'Profissional'} · {user.enabled ? 'Ativo' : 'Bloqueado'}</span></div>{user.role !== 'admin' && <div className="user-actions"><button className="btn subtle small" disabled={busy || loading} onClick={() => toggleAccess(user)}>{user.enabled ? 'Bloquear' : 'Reativar'}</button><button className="btn subtle small" disabled={busy || loading} onClick={() => reset(user)}>Redefinir senha</button></div>}</div>)}</div>
    </section>
    <div className="alert info"><ShieldCheck size={18}/><div><strong>Uso da IA e acesso</strong><p>O painel exige segundo fator TOTP validado (AAL2). Consulte as tentativas e cotas operacionais em “Meu uso”. Cotas do aplicativo não são assinatura, cobrança nem garantia de teto financeiro no provedor.</p></div></div>
  </div>;
}
