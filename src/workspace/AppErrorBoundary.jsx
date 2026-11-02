import React from 'react';

export default class AppErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  // Não registrar detalhes da exceção: podem conter texto do atendimento ou credenciais.
  reload = () => {
    if (window.confirm('Recarregar pode descartar o rascunho que não foi sincronizado ou exportado. Deseja recarregar o aplicativo?')) window.location.reload();
  };
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="center-page"><section className="gate-card" role="alert"><h1>O aplicativo encontrou um problema</h1><p>Não recarregamos a página automaticamente.</p><p>Antes de continuar, preserve qualquer texto ainda visível e mantenha os backups já exportados. O conteúdo não sincronizado pode ser perdido ao recarregar.</p><button className="btn primary full" onClick={this.reload}>Recarregar aplicativo</button></section></main>;
  }
}
