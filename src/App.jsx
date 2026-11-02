import React, { useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Info, KeyRound, ShieldCheck } from 'lucide-react';
import { configured, supabase } from './supabase.js';
import WorkspaceRouter from './workspace/WorkspaceRouter.jsx';
import AccessGate from './workspace/AccessGate.jsx';

const READINESS_TIMEOUT = 15000;
function withTimeout(operation, ms = READINESS_TIMEOUT) {
  let timer;
  return Promise.race([
    operation,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('readiness_timeout')), ms); })
  ]).finally(() => clearTimeout(timer));
}
function Logo() {
  return <div className="brand"><span className="brand-mark"><Activity size={23}/></span><span>Prontuário<span className="brand-blue">.IA</span></span></div>;
}
function Notice({ children, error = false }) {
  return <div className={`alert ${error ? 'error' : 'info'}`} role={error ? 'alert' : 'status'}>{error ? <AlertTriangle size={18}/> : <Info size={18}/>}<div>{children}</div></div>;
}
function Field({ label, value, onChange, ...props }) {
  return <label>{label}<input value={value} onChange={event => onChange(event.target.value)} {...props}/></label>;
}
function Recovery({ title, message, retry, onSignOut, onDemo, signingOut }) {
  return <div className="center-page"><Logo/><section className="gate-card"><h2>{title}</h2><Notice error>{message}</Notice><button className="btn primary full" onClick={retry}>Tentar novamente</button><button className="btn subtle full" onClick={onDemo}>Abrir demonstração</button><button className="btn subtle full" disabled={signingOut} onClick={onSignOut}>{signingOut ? 'Saindo…' : 'Sair'}</button></section></div>;
}
function Loading({ message, onDemo }) {
  return <div className="center-page"><Logo/><p role="status">{message}</p><button className="btn subtle" onClick={onDemo}>Abrir demonstração</button></div>;
}

function MFA({ onVerified, onSignOut, signingOut }) {
  const [state, setState] = useState('checking');
  const [enroll, setEnroll] = useState(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true), verified = useRef(onVerified);
  verified.current = onVerified;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let alive = true;
    setState('checking'); setError(''); setEnroll(null); setFactorId(''); setCode('');
    (async () => {
      try {
        const { data: assurance, error: assuranceError } = await withTimeout(supabase.auth.mfa.getAuthenticatorAssuranceLevel());
        if (!alive) return;
        if (assuranceError) throw assuranceError;
        if (assurance?.currentLevel === 'aal2') { verified.current(); return; }
        const { data: factors, error: factorError } = await withTimeout(supabase.auth.mfa.listFactors());
        if (!alive) return;
        if (factorError) throw factorError;
        const existing = (factors?.totp || []).find(factor => factor.status === 'verified');
        if (existing) { setFactorId(existing.id); setState('challenge'); return; }
        const { data: enrollment, error: enrollmentError } = await withTimeout(supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Prontuário.IA Administrador' }));
        if (!alive) return;
        if (enrollmentError || !enrollment?.id || !enrollment?.totp) throw enrollmentError || new Error('invalid_enrollment');
        setFactorId(enrollment.id); setEnroll(enrollment.totp); setState('enroll');
      } catch {
        if (alive) { setError('Não foi possível preparar a autenticação em duas etapas. Confira a conexão e tente novamente.'); setState('error'); }
      }
    })();
    return () => { alive = false; };
  }, [attempt]);
  async function verify(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await withTimeout(supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() }));
      if (!mounted.current) return;
      if (result.error) throw result.error;
      const { data, error: assuranceError } = await withTimeout(supabase.auth.mfa.getAuthenticatorAssuranceLevel());
      if (!mounted.current) return;
      if (assuranceError || data?.currentLevel !== 'aal2') throw assuranceError || new Error('second_factor_pending');
      verified.current();
    } catch {
      if (mounted.current) setError('Não foi possível validar o código. Confira o autenticador, a conexão e tente novamente.');
    } finally { if (mounted.current) setBusy(false); }
  }
  return <div className="center-page"><Logo/><section className="gate-card"><div className="auth-icon"><ShieldCheck size={23}/></div><h2>Proteção da conta</h2><p>Este acesso exige um segundo fator por aplicativo autenticador.</p>
    {state === 'checking' && <p role="status">Verificando autenticação…</p>}
    {state === 'enroll' && <div className="mfa-setup"><p>Escaneie o QR code no aplicativo autenticador e informe o código abaixo.</p>{enroll?.qr_code && <img className="mfa-qr" src={enroll.qr_code} alt="QR para ativar autenticação"/>}<p className="hint">Se necessário, adicione manualmente a chave <code>{enroll?.secret}</code>. Guarde-a em segurança e não compartilhe.</p></div>}
    {state === 'challenge' && <p>Abra seu aplicativo autenticador e informe o código atual.</p>}
    {['enroll', 'challenge'].includes(state) && <form onSubmit={verify}><Field label="Código de segurança" value={code} onChange={setCode} placeholder="000000" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required/><button className="btn primary full" disabled={busy}>{busy ? 'Validando…' : 'Validar código'}</button></form>}
    {error && <Notice error>{error}</Notice>}{state === 'error' && <button className="btn primary full" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button>}<button className="btn subtle full" disabled={signingOut || busy} onClick={onSignOut}>Sair da conta</button></section></div>;
}

function PasswordChange({ onChanged, onSignOut, signingOut }) {
  const [value, setValue] = useState(''), [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const mounted = useRef(true), abort = useRef(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; abort.current?.abort(); }; }, []);
  async function change(event) {
    event.preventDefault(); if (busy) return;
    if (value.length < 12 || value.length > 128 || value !== confirm) { setMessage('A senha deve ter de 12 a 128 caracteres e coincidir com a confirmação.'); return; }
    setBusy(true); setMessage('');
    const controller = new AbortController(); abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const { data, error } = await withTimeout(supabase.auth.getSession());
      if (!mounted.current) return;
      if (error || !data?.session?.access_token) throw error || new Error('missing_session');
      const response = await fetch('/api/change-password', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify({ password: value }), signal: controller.signal });
      if (!mounted.current) return;
      if (!response.ok) throw new Error('password_change_failed');
      setValue(''); setConfirm(''); onChanged();
    } catch {
      if (mounted.current) setMessage('Não foi possível concluir a troca de senha. Tente novamente; se o problema persistir, contate o administrador.');
    } finally { clearTimeout(timer); if (mounted.current) setBusy(false); abort.current = null; }
  }
  return <div className="center-page"><Logo/><section className="gate-card"><div className="auth-icon"><KeyRound size={23}/></div><h2>Defina sua senha pessoal</h2><p>Sua conta usa uma senha temporária. Escolha uma senha forte antes de continuar.</p><form onSubmit={change}><Field label="Nova senha (12+ caracteres)" value={value} onChange={setValue} type="password" autoComplete="new-password" required minLength={12} maxLength={128}/><Field label="Confirmar nova senha" value={confirm} onChange={setConfirm} type="password" autoComplete="new-password" required minLength={12} maxLength={128}/><button className="btn primary full" disabled={busy}>{busy ? 'Atualizando…' : 'Atualizar senha'}</button></form>{message && <Notice error>{message}</Notice>}<button className="btn subtle full" disabled={busy || signingOut} onClick={onSignOut}>Sair</button></section></div>;
}

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [user, setUser] = useState(null), [profile, setProfile] = useState(null);
  const [authPhase, setAuthPhase] = useState(configured ? 'loading' : 'ready');
  const [profilePhase, setProfilePhase] = useState('idle'), [mfaPhase, setMfaPhase] = useState('idle');
  const [mfaReady, setMfaReady] = useState(false), [problem, setProblem] = useState('');
  const [retry, setRetry] = useState(0), [signingOut, setSigningOut] = useState(false), [logoutError, setLogoutError] = useState('');
  const mounted = useRef(true);
  const demoMode = /^\/demo(?:\/novo)?\/?$/.test(pathname);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { const changed = () => setPathname(window.location.pathname); window.addEventListener('popstate', changed); return () => window.removeEventListener('popstate', changed); }, []);
  const navigate = path => { history.pushState({}, '', path); setPathname(path); };
  const openDemo = () => navigate('/demo');

  useEffect(() => {
    if (!configured || demoMode) { setAuthPhase('ready'); return; }
    let alive = true, eventRevision = 0;
    setAuthPhase('loading'); setProblem('');
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive || event === 'INITIAL_SESSION') return;
      eventRevision += 1;
      setUser(session?.user || null); setAuthPhase('ready'); setProblem('');
    });
    const revision = eventRevision;
    (async () => {
      try {
        const { data, error } = await withTimeout(supabase.auth.getUser());
        if (!alive || eventRevision !== revision) return;
        if (error && error.name !== 'AuthSessionMissingError') throw error;
        setUser(data?.user || null); setAuthPhase('ready');
      } catch {
        if (alive && eventRevision === revision) { setAuthPhase('error'); setProblem('Não foi possível verificar sua sessão. Confira a conexão e tente novamente. A demonstração continua disponível.'); }
      }
    })();
    return () => { alive = false; subscription?.subscription.unsubscribe(); };
  }, [demoMode, retry]);

  useEffect(() => {
    if (!configured || !user || authPhase !== 'ready' || demoMode) { setProfile(null); setProfilePhase('idle'); setMfaReady(false); setMfaPhase('idle'); return; }
    let alive = true;
    const controller = new AbortController();
    setProfile(null); setProfilePhase('loading'); setProblem('');
    (async () => {
      try {
        const result = await withTimeout(supabase.from('profiles').select('user_id,username,display_name,role,enabled,must_change_password,preferences').eq('user_id', user.id).maybeSingle().abortSignal(controller.signal));
        if (!alive) return;
        if (result.error || !result.data || !result.data.enabled) {
          setProblem('Sua conta não está habilitada ou não foi possível consultar o perfil. Tente novamente ou contate o administrador.'); setProfilePhase('error'); return;
        }
        setProfile(result.data); setProfilePhase('ready');
        const base = `/${result.data.username}`;
        const route = window.location.pathname === `${base}/novo` || window.location.pathname === `${base}/novo/` ? `${base}/novo` : base;
        if (window.location.pathname !== route) { history.replaceState({}, '', route); setPathname(route); }
      } catch {
        if (alive) { setProblem('Não foi possível carregar sua conta. Seu acesso não foi liberado; confira a conexão e tente novamente.'); setProfilePhase('error'); }
      }
    })();
    return () => { alive = false; controller.abort(); };
  }, [user?.id, authPhase, demoMode, retry]);

  useEffect(() => {
    if (!profile || !configured || demoMode) return;
    let alive = true;
    setMfaPhase('loading'); setMfaReady(false);
    (async () => {
      try {
        const { data, error } = await withTimeout(supabase.auth.mfa.getAuthenticatorAssuranceLevel());
        if (!alive) return;
        if (error || !data) throw error || new Error('missing_assurance');
        setMfaReady(data.currentLevel === 'aal2' || (profile.role !== 'admin' && data.nextLevel !== 'aal2'));
        setMfaPhase('ready');
      } catch {
        if (alive) { setProblem('Não foi possível verificar a proteção da conta. Tente novamente antes de continuar.'); setMfaPhase('error'); }
      }
    })();
    return () => { alive = false; };
  }, [profile?.user_id, profile?.role, demoMode, retry]);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true); setLogoutError('');
    try {
      if (configured) { const result = await withTimeout(supabase.auth.signOut()); if (result.error) throw result.error; }
      if (!mounted.current) return;
      setUser(null); setProfile(null); setProblem(''); setAuthPhase('ready'); navigate('/');
    } catch {
      if (mounted.current) setLogoutError('Não foi possível confirmar a saída da conta. A sessão não foi descartada nesta tela. Confira a conexão e tente sair novamente.');
    } finally { if (mounted.current) setSigningOut(false); }
  }
  const recover = () => { setProblem(''); setRetry(value => value + 1); };
  const recovery = title => <Recovery title={title} message={problem} retry={recover} onSignOut={logout} onDemo={openDemo} signingOut={signingOut}/>;
  let content;
  // A demonstração nunca depende da disponibilidade de Auth, perfil ou MFA.
  if (demoMode) content = <WorkspaceRouter key="demo" demo profile={{ display_name: 'Demonstração' }} pathname={pathname} onNavigate={navigate} onLogout={() => navigate('/')}/>;
  else if (authPhase === 'loading') content = <Loading message="Verificando sua sessão…" onDemo={openDemo}/>;
  else if (authPhase === 'error') content = recovery('Não foi possível abrir sua conta');
  else if (user && (profilePhase === 'loading' || profilePhase === 'idle')) content = <Loading message="Carregando sua conta…" onDemo={openDemo}/>;
  else if (user && profilePhase === 'error') content = recovery('Acesso à conta indisponível');
  else if (user && profile) {
    if (mfaPhase === 'loading' || mfaPhase === 'idle') content = <Loading message="Verificando proteção da conta…" onDemo={openDemo}/>;
    else if (mfaPhase === 'error') content = recovery('Verificação de segurança indisponível');
    else if (!mfaReady) content = <MFA onVerified={() => setMfaReady(true)} onSignOut={logout} signingOut={signingOut}/>;
    else if (profile.must_change_password) content = <PasswordChange onChanged={() => setProfile(value => value ? { ...value, must_change_password: false } : value)} onSignOut={logout} signingOut={signingOut}/>;
    else content = <WorkspaceRouter key={user.id} profile={profile} pathname={pathname} onNavigate={navigate} onLogout={logout}/>;
  } else content = <AccessGate pathname={pathname} onLogin={setUser} onDemo={openDemo}/>;
  return <>{logoutError && <div className="alert error" role="alert"><AlertTriangle size={18}/><div>{logoutError}<button className="btn subtle" disabled={signingOut} onClick={logout}>Tentar sair novamente</button></div></div>}{signingOut && <p role="status">Encerrando sessão…</p>}{content}</>;
}
