# Prontuário.IA 2.1 — piloto profissional

## Proposta de valor

Capturar um atendimento fictício por voz, preservar o relato original, produzir um rascunho factual e revisá-lo no computador com menos operações. A decisão clínica continua humana. A versão é candidata a **piloto controlado**, não um produto homologado para dados reais nem um sistema de cobrança já ativado.

## O que entrou nesta entrega

| Área | Resultado |
|---|---|
| Personalização | Biblioteca de roteiros, CRUD, busca, duplicação, importação e exportação; salvamento/carregamento explícito na conta com controle de versão |
| Qualidade do documento | Saída SOAP ou narrativa por seções; impressão/salvar PDF pelo navegador somente após revisão |
| Recuperação | Até 8 pontos anteriores do rascunho na memória da aba; restauração invalida aprovação; histórico limpo ao iniciar outra consulta |
| Continuidade | Sincronização pode ser pausada sem apagar a nuvem; conflito não substitui áudio ou anexo pendente |
| Voz | Trava de pedidos de permissão concorrentes, cancelamento de solicitação, streams obsoletos fechados, jobs de transcrição cancelados e respostas tardias descartadas |
| IA | Cotas diárias e por minuto, atômicas por conta/operação; GET de consumo próprio; erro fechado quando controle de uso não existe |
| Acesso | Auth/perfil/MFA com recuperação de falha e timeout; demo independente; nenhuma liberação de conta por falha de rede |
| Resiliência | Tela de recuperação de erro sem detalhes sensíveis e sem recarga automática; limite total UTF-8 do documento antes de sincronizar |

Os roteiros são checklists de documentação, não exames normais preenchidos, receitas ou diagnósticos predefinidos. Nada do catálogo clínico foi validado ou ampliado nesta entrega. Biblioteca na conta é persistente até exclusão; a consulta continua temporária por 24h. Versões anteriores ficam só na aba e não são um prontuário permanente.

## Ativar em ambiente de testes

Não promover esta branch diretamente a um site usado por outras pessoas. A aplicação agora recusa IA se a migração das cotas estiver ausente. Primeiro prepare banco e configuração de testes, depois faça deploy da branch/PR.

1. Use Supabase/Netlify de testes, preservando produção e o projeto anterior.
2. Aplique, em ordem, somente migrações ainda não executadas:
   - `20261025_workspace_v2.sql` (base, se instalação nova);
   - `20261102_ai_usage.sql` (contagens e reserva de cota);
   - `20261102_personal_templates.sql` (biblioteca pessoal).
3. Migrações de criação não são idempotentes: não reexecutar cegamente. Confira o histórico de schema e faça backup administrativo antes de qualquer banco já utilizado.
4. Configure as variáveis privadas da hospedagem. Defaults de tentativa: `AI_DOCUMENTATION_DAILY_LIMIT=30`, `AI_TRANSCRIPTION_DAILY_LIMIT=40`, `AI_BURST_LIMIT=3`. Limites máximos aceitos: 1000 por dia e 30 por minuto; zero desabilita novas reservas. Não são planos pagos nem saldos financeiros.
5. Confirme os flags Groq e teste GET `/api/account-usage` com usuário autenticado. GET `/api/organize-note` informa configuração de flags; não garante chave válida ou migração aplicada.
6. Habilite e monitore limpeza de consultas expiradas e das contagens antigas. A migração inclui função de expurgo após 35 dias; sem agendamento, contagens antigas não são automaticamente removidas.
7. Teste salvar/carregar/excluir roteiros em duas sessões e provoque conflito de edição. Nunca colocar dados de pacientes nos modelos. O validador verifica estrutura e tamanho; não identifica toda informação pessoal em texto livre.
8. Teste transcrição e documentação com conteúdo inventado e conta Groq confirmada. Nunca inserir chaves no frontend ou no Git.

Pedidos autorizados consomem tentativa **antes do provedor**, inclusive quando ele falha. Pedidos inválidos/rejeitados não consomem. Um timeout/cancelamento do navegador pode ocorrer depois de o servidor já reservar/enviar o pedido; não prometer estorno ou cancelamento financeiro. Faturamento do provedor é independente.

## Verificação técnica

```bash
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:db
npm audit
```

Para Chromium do sistema: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`. Testes de áudio/Auth/provedor têm fixtures; não substituem homologação física e do provedor real. `test:db` utiliza PostgreSQL descartável sem porta pública e remove o container próprio.

## Caminho comercial proposto

### Piloto acompanhado

- Convidar um pequeno grupo de profissionais, com contas criadas pelo administrador e acesso bloqueável.
- Medir sessões concluídas, tentativas com erro, esforço de revisão e problemas de sincronização **sem coletar conteúdo clínico em analytics**. Não afirmar economia de tempo até medi-la.
- Obter feedback sobre o fluxo de voz, os roteiros e a facilidade de continuar em outro aparelho.
- Registrar falhas com identificadores técnicos e tempos, sem áudio, relato ou credenciais nos logs.
- Manter canal de suporte definido por você antes de distribuir; não há endereço de suporte fictício nem envio automático de mensagens nesta versão.

### Antes de aceitar pagamento

- Homologar Android/Chrome, iPhone/Safari e desktop em HTTPS, inclusive interrupções, rede fraca e bloqueio de tela.
- Testar Supabase/Groq reais em ambiente escolhido por você, restauração de backups, retenção e limpeza agendada.
- Implementar proteção de login contra força bruta no gateway e testar recuperação de conta/MFA e revogação de sessão.
- Revisar contratos, consentimento, finalidade, retenção/logs/backups e responsabilidades com apoio jurídico/segurança e validação clínica apropriada.
- Definir limite de responsabilidade, materiais de treinamento e política de suporte/cancelamento.
- Escolher provedor de pagamento, preço, impostos e política de reembolso; implementar checkout, webhooks assinados e idempotentes e direitos de acesso definidos no servidor. Nenhuma destas etapas está fingida na UI.
- Vincular franquia ao contrato real somente após implementar assinaturas; hoje a franquia é configurada no servidor e igual por operação para as contas.

### Depois de validar demanda

Equipes, organizações e cobrança por assento exigem isolamento multiempresa adicional; não usar o campo role atual como substituto. Histórico permanente de pacientes, assinatura digital, prescrição e integrações exigem outro escopo. PWA/offline durável e inferência local também não estão implícitos nesta entrega.

## Limites atuais

- O frontend e os adaptadores estão implementados; credenciais externas continuam ausentes neste ambiente.
- O preview `deploy-preview-3--iaidoutor.netlify.app` não foi alterado nem validado nesta rodada: seu domínio está bloqueado na rede desta sessão. Enviar código a uma branch não comprova que esse site foi atualizado.
- Tokens de Auth persistem via SDK; relato, versões e áudio não foram colocados em localStorage.
- Biblioteca de roteiros pode ser salva na conta. A consulta sincronizada permanece 24h; backups de infraestrutura obedecem às regras do provedor.
- O legado de APIs pagas permanece no código por compatibilidade, não é acionado pela interface nova e deve permanecer desabilitado (`LEGACY_PAID_AI_ENABLED=false`, `TEXT_AI_ENABLED=false`, sem chave paga). Chaves/flags históricas sozinhas não ativam essas rotas. Remover definitivamente essas rotas é uma tarefa antes de distribuição ampla.
- A auditoria de dependências não é um pentest; não há atestado de conformidade LGPD nem promessa de precisão clínica.
