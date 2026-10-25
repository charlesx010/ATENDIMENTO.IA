# Auditoria e reconstrução — 25/10/2026

## Escopo e evidência

Revisão estática do ZIP fornecido, fluxo de interface, persistência, áudio, endpoints de IA, documentação e dependências. Implementação e testes locais com dados fictícios. Nenhuma inspeção da conta Netlify/Supabase anterior, nenhum uso de dados de pacientes e nenhuma chamada real à Groq. Não é pentest nem homologação clínica/jurídica.

## Achados e ações

| Achado | Impacto | Ação |
|---|---|---|
| README dizia 72h, sincronizador usava 24h renovadas em cada escrita | Retenção imprevisível | V2 define 24h fixas desde a criação; leitura bloqueada pelo banco após expirar; job de exclusão documentado |
| SQL mencionado no README não veio no ZIP | Instalação independente não reproduzível | Migração completa para banco de testes novo, com perfis, RLS e RPCs |
| Sincronização antiga sem leitura periódica/Realtime | Outro aparelho não recebe atualização sem ação manual | Controlador novo lê periodicamente, aplica remoto só quando não há edição local |
| Gravações podiam concorrer dentro da mesma aba | Falsos conflitos e perda de alterações em trânsito | Operações serializadas, snapshot e fila de alterações pendentes |
| Conflito oferecia restaurar substituindo local | Risco de perda de relato | Backup local explícito, confirmação para aplicar nuvem e proibição de mescla automática |
| Versões numéricas e reset de sessão | Risco de reutilização de versão após recriação | UUID a cada escrita; lock transacional por conta e comparação no banco |
| Interface principal de 777 linhas com modos e ações sobrepostos | Dificuldade de uso, manutenção e teste | Novo workspace em três etapas; domínio e controlador separados do React |
| IA misturava documentação e sugestões de conduta | Sugestões podem ser confundidas com fatos executados | Endpoint novo de documentação factual com schema validado; não usa modo clínico profundo para escrever a nota |
| Ausência de lockfile | Instalação variável | `package-lock.json`, `npm ci` e versões diretas fixadas |
| Vite 6.0.5 e cadeia esbuild com alertas conhecidos | Risco no servidor de desenvolvimento | Vite 8.3.5 e plugin React 6.1.2; audit inicial 3 alertas, após atualização 0 |
| Áudio Whisper sem reprodução no próprio componente | Revisão difícil | Playback local, descarte explícito e liberação do microfone na falha/saída |
| Navegação podia descartar transcrição não inserida | Perda silenciosa | Confirmação ao mudar etapa/área/método com conteúdo de voz pendente |
| Inserção longa podia exceder limite do novo documento | Falha de sincronização ou truncamento | Recusa explícita de inserção >6.000, mantendo transcrição no gravador |
| Estado de revisão podia continuar após alteração | Exportação de nota desatualizada | Edição invalida revisão; texto de origem vinculado ao rascunho; IA é proposta antes de aplicar |
| Campos clínicos em textos densos e interface escura | Uso móvel e contraste prejudicados | Workspace claro, botões de toque, navegação inferior móvel, foco visível, modal com teclado |

## Arquitetura nova e reaproveitamento

`src/workspace/Workspace.jsx` é a interface ativa, com CSS próprio. `model.js` valida o documento e controla revisão; `sync.js` implementa o protocolo; `useConsultationSync.js` conecta Supabase. `organize-note.mjs` e `documentation.mjs` formam o novo serviço de documentação. Migração em `supabase/migrations/20261025_workspace_v2.sql`.

Reaproveitados: autenticação/MFA, administração, Web Speech, GroqRecorder, OCR e receituário existente. Os componentes antigos permanecem no pacote para rastreabilidade e seus testes, mas `QuickWorkspace` não é a entrada ativa. Endpoints antigos também permanecem; não habilitar recursos pagos legados por engano. A reconstrução do fluxo principal não significa reescrita integral de todas as bibliotecas.

## Limites que permanecem

1. **Serviços externos não homologados:** faltam credenciais e um banco de testes escolhido pelo usuário. O SQL foi verificado em PostgreSQL isolado, com auxiliares de Auth simulados; a pareação PC/celular no Supabase real ainda precisa ser testada.
2. **IA real não testada:** schema e falhas foram exercitados com respostas simuladas. Modelo, cotas e suporte do provedor podem mudar. Confirmar plano gratuito; o código não consegue garantir custo zero na conta externa.
3. **Segurança operacional:** login herdado precisa de proteção adicional contra força bruta por IP/conta no gateway, monitoramento sem conteúdo clínico, revisão de sessões e política de recuperação. Não declarar segurança de produção só pela presença de RLS.
4. **Limites de IA:** validação de JSON não prova fidelidade clínica. O modelo pode omitir ou distorcer fatos; a revisão humana continua indispensável. Não há verificação clínica por outro modelo nem garantia contra prompt injection.
5. **Taxas e abuso:** endpoints autenticam, limitam tamanho e têm timeout, mas não há quota diária transacional por usuário implementada. Uma conta habilitada pode consumir a cota do provedor. Implementar antes de uso compartilhado ampliado.
6. **Mobile real:** Chromium em 360/390px não comprova Safari/iPhone, teclado virtual, chamadas telefônicas, bloqueio de tela ou captura em segundo plano. Testar fisicamente Android e iOS em HTTPS.
7. **Retenção:** expiração lógica e exclusão física são distintas. Agendar/monitorar `pg_cron`; revisar backups e logs dos provedores. Sem job, linhas vencidas ficam inacessíveis ao usuário, mas podem existir fisicamente.
8. **OCR:** preservado; TXT exercitado no navegador. Imagens/PDFs grandes, uso de memória e precisão precisam de validação adicional. Não serve para interpretar exames de imagem. Trabalhador OCR pode terminar processamento já iniciado após desmontar o componente, embora o resultado seja ignorado.
9. **Catálogo:** conteúdo herdado, sem adição ou validação de doses. Não há base SQLite, PDFs ou DOCX das fontes no ZIP. Não foi feita importação em massa nem revisão clínica dos protocolos.
10. **Offline:** edição em memória durante falha é possível; não há armazenamento durável offline nem restauração após fechamento sem backup/nuvem.
11. **Migração:** não aplicar sobre produção sem revisar políticas e dados existentes. Não importa `clinical_sessions` automaticamente.
12. **GitHub:** o envio segue bloqueado pela conta conectada sem permissão. Artefato ZIP é a entrega independente; nenhuma publicação/deploy foi executada.

## Fluxo de aceite para homologação externa

Criar Supabase/Netlify de testes → aplicar migração → criar conta e MFA → configurar variáveis por canal seguro → testar login e bloqueio → abrir mesma conta em PC e celular → ativar nuvem → editar alternadamente → provocar conflito → salvar backup e restaurar → testar exclusão e 24h com relógio controlado em banco descartável → testar microfone e transcrição com áudio inventado → conferir resumo/ SOAP → revisar antes de copiar. Depois avaliar LGPD, contratos, retenção, backups, segurança e adequação clínica antes de qualquer dado real.
