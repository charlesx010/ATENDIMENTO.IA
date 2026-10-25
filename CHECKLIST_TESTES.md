# Checklist — módulo 1 (somente ambiente de testes)

Execute com duas contas fictícias, um administrador com TOTP e dois dispositivos.

- [ ] `/` pede nome de usuário e encaminha para `/<usuario>`.
- [ ] Login com senha inválida não concede acesso nem revela se conta existe.
- [ ] Senha temporária de novo usuário obriga troca no primeiro acesso.
- [ ] Administrador sem TOTP não visualiza painel nem tem acesso a endpoints administrativos.
- [ ] Criar usuário via painel; acesso só ocorre na própria URL.
- [ ] Conta bloqueada não lê nem altera sessões através da API Supabase.
- [ ] Conta A não consegue ler, atualizar, excluir ou recuperar sessões da conta B via API.
- [ ] Preferências da conta A não alteram preferências da conta B.
- [ ] Consulta começa sem identificação obrigatória e salva após alteração.
- [ ] Abrir a mesma conta em outro navegador recupera rascunho confirmado.
- [ ] Edição simultânea com versões divergentes exibe conflito; não sobrescreve silenciosamente.
- [ ] Queda de conexão exibe status pendente e tenta novamente ao retornar.
- [ ] Encerrar sessão apaga a linha do banco; carregar novamente não retorna conteúdo.
- [ ] Simular expiração de 72h em ambiente isolado: dados vencidos não aparecem na API.
- [ ] Executar/verificar job pg_cron: sessão expirada é fisicamente excluída até 15 minutos após expirar.
- [ ] Verificar limites gratuitos e política de backup/log antes de qualquer uso real.
- [ ] Modo demonstração não grava dados clínicos no navegador nem na nuvem.
- [ ] Confirmar `SUPABASE_SERVICE_ROLE_KEY` ausente do bundle público e do repositório.
- [ ] Conferir desempenho em smartphone intermediário e Chrome/Safari/Edge.
- [ ] Validar LGPD, termos e segurança antes de considerar entrada de dados reais.

**Status da entrega:** código-fonte preparado e análise de sintaxe executada; integração real, autenticação, banco, job de limpeza e homologação completa **não executados neste ambiente** por ausência de credenciais e de instalação de pacotes npm com acesso à rede.
