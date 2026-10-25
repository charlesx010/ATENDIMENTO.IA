import React from 'react';
import {Cloud, CloudOff, RefreshCw, ShieldCheck} from 'lucide-react';

export default function TemporarySessionPanel({sync, demo}) {
  if (demo) return <section className="temporary-sync"><CloudOff size={18}/><div><strong>Sincronização temporária</strong><p>Entre com sua conta para continuar uma consulta entre o celular e o computador.</p></div></section>;
  const until = sync.meta?.expires_at ? new Date(sync.meta.expires_at).toLocaleString('pt-BR') : null;
  if (sync.phase === 'checking') return <section className="temporary-sync"><RefreshCw size={18}/><div><strong>Verificando consulta temporária…</strong></div></section>;
  if (sync.phase === 'available') return <section className="temporary-sync"><Cloud size={18}/><div><strong>Uma consulta temporária está disponível</strong><p>Ela expira em {until}. Toque para carregá-la neste aparelho.</p><button className="btn subtle" type="button" onClick={sync.resume}>Retomar consulta</button></div></section>;
  if (sync.phase === 'conflict') return <section className="temporary-sync warning"><CloudOff size={18}/><div><strong>Outro aparelho atualizou esta consulta</strong><p>Para evitar que uma anotação seja perdida, carregue a versão mais recente antes de continuar.</p><button className="btn subtle" type="button" onClick={sync.resume}>Carregar versão mais recente</button></div></section>;
  if (sync.phase === 'error') return <section className="temporary-sync warning"><CloudOff size={18}/><div><strong>Não foi possível sincronizar agora</strong><p>Nada foi apagado. Confira a conexão e tente novamente.</p><button className="btn subtle" type="button" onClick={sync.reload}>Tentar novamente</button></div></section>;
  if (sync.active) return <section className="temporary-sync"><ShieldCheck size={18}/><div><strong>Consulta temporária sincronizada</strong><p>Salva automaticamente na sua conta e disponível por até 24 horas. Áudio e imagens não são enviados.</p></div></section>;
  return <section className="temporary-sync"><Cloud size={18}/><div><strong>Continuar em outro aparelho</strong><p>Ative para guardar somente esta consulta, por até 24 horas, na sua conta.</p><button className="btn subtle" type="button" onClick={sync.activate}>Ativar sincronização temporária</button></div></section>;
}
