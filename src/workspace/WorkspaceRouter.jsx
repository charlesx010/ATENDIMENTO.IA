import React, {lazy, Suspense} from 'react';
import QuickWorkspace from '../QuickWorkspace.jsx';
import './workspace.css';

const PilotWorkspace = lazy(() => import('./Workspace.jsx'));

// O fluxo existente é o padrão. A nova área tem entrada explícita e usa outro
// formato de consulta; não converter nem substituir dados antigos ao navegar.
export default function WorkspaceRouter({profile,demo=false,onLogout,pathname,onNavigate}) {
  const base = demo ? '/demo' : `/${profile.username}`;
  const pilot = pathname.replace(/\/$/,'') === `${base}/novo`;
  function changeWorkspace() {
    if (!window.confirm('Trocar de área fecha o rascunho desta aba e não transfere conteúdo entre as versões. Copie ou exporte o que deseja preservar antes de continuar. Deseja trocar?')) return;
    onNavigate(pilot ? base : `${base}/novo`);
  }
  return <>
    <style>{`.workspace-version-switcher{display:flex;gap:16px;align-items:center;justify-content:space-between;padding:12px 20px;background:#12333b;border-bottom:1px solid #36535c;color:#edf7f7;font:12px/1.5 system-ui,sans-serif}.workspace-version-switcher p{margin:0;font-size:12px;line-height:1.5;max-width:800px}.workspace-version-switcher strong{font-size:13px}.workspace-version-switcher button{flex-shrink:0;min-height:42px;padding:8px 12px;border:1px solid #80b5b4;border-radius:8px;background:#fff;color:#14565e;font:600 12px/1.3 system-ui,sans-serif}.workspace-version-switcher.is-pilot{padding-left:270px}@media(min-width:701px) and (max-width:1100px){.workspace-version-switcher.is-pilot{padding-left:230px}}.workspace-version-switcher button:focus-visible{outline:3px solid #8fe4d4;outline-offset:3px}@media(max-width:700px){.workspace-version-switcher,.workspace-version-switcher.is-pilot{align-items:flex-start;flex-direction:column;gap:10px;padding:12px 16px}.workspace-version-switcher button{width:100%}}@media print{.workspace-version-switcher{display:none!important}}`}</style>
    <nav className={'workspace-version-switcher'+(pilot?' is-pilot':'')} aria-label="Versão da área de atendimento">
      <p><strong>{pilot?'Área nova · acesso opcional':'Atendimento original restaurado'}</strong><br/>{pilot?'Esta área usa outro formato de rascunho. A consulta anterior não foi importada nem apagada.':'Simplificado, Completo, Receituário pronto e a sessão temporária existente continuam nesta área.'}</p>
      <button type="button" onClick={changeWorkspace}>{pilot?'Voltar ao atendimento original':'Experimentar nova área'}</button>
    </nav>
    {pilot?<Suspense fallback={<p role="status">Preparando a área opcional…</p>}><PilotWorkspace key={demo?'demo-new':profile.user_id+'-new'} profile={profile} demo={demo} onLogout={onLogout}/></Suspense>:
      <QuickWorkspace key={demo?'demo-original':profile.user_id+'-original'} profile={profile} demo={demo} onLogout={onLogout}/>}
  </>;
}
