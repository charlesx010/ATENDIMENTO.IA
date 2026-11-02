import React from 'react';
export default function RevisionPanel({revisions,onRestore}) {
  return <section className="w-card" aria-label="Versões do rascunho"><h3>Versões do rascunho</h3><p className="w-muted">Até 8 pontos de recuperação nesta aba, criados antes de substituir conteúdo. Não são histórico de pacientes e desaparecem ao sair.</p>
    {!revisions.length ? <p className="w-muted">A primeira versão será guardada ao organizar, aplicar IA ou importar um backup sobre um rascunho.</p> : <ol className="w-revisions">{revisions.map(entry=><li key={entry.id}><div><strong>{entry.label}</strong><small>{new Date(entry.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></div><button className="w-button" onClick={()=>onRestore(entry)}>Restaurar</button></li>)}</ol>}
  </section>;
}
