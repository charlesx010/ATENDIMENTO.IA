# Prontuário.IA — correção de compatibilidade 2.1.1

**Fluxo padrão restaurado:** `/demo` e `/<usuário>` oferecem novamente Simplificado, Completo, receituário e documentos, utilizando a sessão existente em `clinical_sessions`. A área nova é opcional em `/demo/novo` ou `/<usuário>/novo`. Leia [a correção de compatibilidade](docs/CORRECAO_COMPATIBILIDADE.md) antes de implantar sobre um ambiente já existente. Não recrie banco/usuários nem reexecute migrações de criação para recuperar as funções clássicas.

Webapp responsivo de documentação clínica: **capturar → organizar → revisar**. O fluxo principal foi reconstruído; autenticação, ditado, OCR, catálogo e bibliotecas úteis do projeto original foram preservados. Não é uma implementação integralmente nova de todos os módulos.

Versão de testes: use somente casos fictícios. IA produz rascunhos, não atendimento autônomo. O projeto não está homologado para pacientes reais.

Leia [o plano de ativação do piloto](docs/PILOTO_COMERCIAL.md) antes de distribuir. Esta versão adiciona biblioteca pessoal de roteiros, versões anteriores do rascunho, impressão revisada e cotas atômicas de IA. Cobrança e assinatura ainda não estão habilitadas.

## O que funciona sem serviços externos

- Demonstração em `/demo`, edição de relato original e identificador fictício.
- Organização literal SOAP, sem modelo de IA, com preservação dos trechos não classificados.
- Edição do resumo, SOAP e pendências; comparação com o original e revisão obrigatória.
- Cópia e download TXT após revisão; qualquer edição invalida a aprovação.
- Backup JSON de rascunho e restauração com validação e revisão novamente obrigatória.
- Catálogo existente com pesquisa e bloqueio de cópia até a confirmação humana; conteúdo clínico não foi ampliado nem homologado nesta reconstrução.
- OCR local com ativos Tesseract/PDF gerados pelo build. O texto precisa ser revisado antes de inserido. Não interpreta imagens diagnósticas.

O rascunho clínico fica **na memória da aba**. Não há gravação clínica em localStorage, armazenamento offline ou histórico permanente. Tokens de login são administrados pelo SDK do Supabase. Exporte um backup antes de fechar a aba.

## O que depende de configuração externa

- Login, perfis e administração: Supabase Auth + tabela `profiles` + Functions Netlify.
- Sincronização PC/celular: tabela `workspace_sessions` e RPCs da migração nova. Mesma conta em ambos, ativação explícita e consulta a cada 4 segundos na aba ativa. Não é WebSocket nem garantia de execução em segundo plano no celular.
- Transcrição Whisper: microfone via HTTPS, conta autenticada, autorização explícita e `GROQ_TRANSCRIPTION_ENABLED=true` no servidor.
- Resumo e SOAP por IA: `GROQ_CLINICAL_ENABLED=true`, Groq e conta autenticada. O endpoint novo `/api/organize-note` somente organiza fatos informados; não sugere diagnósticos nem prescreve.
- Ditado do navegador depende da Web Speech API e pode processar áudio no serviço do fabricante. Não prometer suporte universal ou processamento offline.

Não foram fornecidas credenciais de Supabase/Groq. Chamadas reais de IA e sincronização contra o projeto do usuário **não foram executadas**. Testes usam casos fictícios, provedor simulado, PostgreSQL descartável e Chromium.

## Instalar e executar

Pré-requisito: Node.js **22**, versão mínima 22.12 para Vite 8. Versão usada na validação: 22.23.4.

```bash
npm ci
npm test
npm run build
npm run dev
```

Abra `/demo` no servidor de desenvolvimento. A alternativa de organização literal funciona sem chaves. `npm run dev` inicia somente Vite: ele **não** executa `/api/*`.

Para testar Functions localmente, use Netlify CLI de confiança e `netlify dev` na raiz, com variáveis seguras disponíveis ao processo. Para hospedar, importe o projeto no Netlify: `netlify.toml` já define build, publicação de `dist` e Functions. O acesso pelo celular precisa de HTTPS e permissão para o microfone. Nenhuma configuração da hospedagem anterior foi copiada ou alterada automaticamente.

`npm run build` gera `public/ocr/` e `dist/`. Ambos são ignorados no Git. O `package-lock.json` permite instalar com `npm ci` sem resolver versões a cada instalação.

## Banco em uso: Prontuario-IA

O atendimento clássico usa o projeto Supabase `Prontuario-IA`. O esquema aplicado nele está em `supabase/migrations/` e as diferenças conhecidas estão em [supabase/README.md](supabase/README.md). Contas reais usam somente o atendimento clássico; a área nova (`/novo`) fica restrita à demonstração até que as migrations de `supabase/pendentes-area-nova/` sejam revisadas e aplicadas.

## Banco de testes para a área nova

1. Crie um **projeto Supabase de testes separado**. Não execute a migração às cegas em banco existente.
2. Leia e execute `supabase/pendentes-area-nova/20261025_workspace_v2.sql`. Ela cria `profiles` se ausente, a tabela nova e RPCs protegidas. Em instalação existente, revise colunas, permissões e políticas anteriores: políticas permissivas preexistentes em `profiles` não são automaticamente removidas.
3. Desative cadastros públicos. Crie a primeira conta no Supabase Auth com senha forte.
4. Insira um perfil em `profiles`, vinculando o UUID real dessa conta, um `username` válido, `display_name`, `role='admin'`, `enabled=true` e `must_change_password=false`. Faça isso pela administração segura do banco; não versionar senhas.
5. Habilite TOTP no provedor e conclua o segundo fator no primeiro acesso. Administradores precisam de AAL2, também nas RPCs.
6. Habilite `pg_cron` e agende a limpeza descrita no final do SQL. Valide que o job está ativo.
7. Acesse `/seu-username`, crie contas de teste pelo painel administrativo e teste dois aparelhos com a mesma conta.

A tabela antiga `clinical_sessions` não é alterada nem importada automaticamente. Consultas antigas usam outro formato; não há migração silenciosa.

## Variáveis

Use `.env.example` como referência de nomes; configure valores pelas ferramentas seguras da hospedagem. Nunca envie `.env` ou credenciais no ZIP/Git/chat.

| Nome | Escopo | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | Build/frontend | URL pública do projeto |
| `VITE_SUPABASE_ANON_KEY` | Build/frontend | Chave publicável/anon, protegida por RLS |
| `SUPABASE_URL` | Functions | URL do mesmo projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Somente Functions | Validação de acesso/admin, nunca frontend |
| `SUPABASE_ANON_KEY` | Functions | Login |
| `GROQ_API_KEY` | Somente Functions | Credencial do provedor |
| `GROQ_TRANSCRIPTION_ENABLED` | Functions | `true` habilita Whisper |
| `GROQ_CLINICAL_ENABLED` | Functions | `true` habilita documentação por IA |
| `GROQ_NOTE_MODEL` | Functions, opcional | Padrão `openai/gpt-oss-120b` no endpoint da Groq |
| `TEXT_AI_ENABLED` | Functions, legado | Manter `false`; recursos pagos antigos não são usados pela interface nova |

`GROQ_*` fica desativado por padrão. O aplicativo não verifica faturamento da conta do provedor; confirmar plano e cotas no painel da Groq. Não há promessa de gratuidade ilimitada. Não há fallback pago automático no fluxo novo. `FREE_TRANSCRIPTION_ENABLED` é compatibilidade de endpoints legados e não habilita o novo endpoint de documentação.

## Biblioteca pessoal e limites de IA

As migrações `20261102_ai_usage.sql` e `20261102_personal_templates.sql` (em `supabase/pendentes-area-nova/`) devem ser aplicadas após a base. A biblioteca tem salvamento/carregamento explícito e comparação de versão, separada da consulta; sua retenção é até exclusão, não 24 horas. Não colocar dados de pacientes nos roteiros.

O painel Meu uso consulta apenas o consumo da própria conta. A reserva de tentativa é atômica no servidor; o novo endpoint organiza-note exige a migração. As rotas clássicas só exigem a nova tabela quando AI_USAGE_ENFORCEMENT=true é explicitamente ativado; sem essa ativação, mantêm a configuração anterior e os limites do provedor. Defaults: 30 tentativas de documentação/dia, 40 de transcrição/dia e 3/minuto/operação, ajustáveis pelas variáveis `AI_DOCUMENTATION_DAILY_LIMIT`, `AI_TRANSCRIPTION_DAILY_LIMIT`, `AI_BURST_LIMIT`. Tentativas autorizadas contam inclusive em falha do provedor, sem relação com cobrança financeira.

## Sincronização e retenção

Uma consulta temporária por conta, expiração fixa **24 horas desde a criação**, sem renovação a cada tecla. UUID de versão novo a cada escrita; RPC serializa operações da mesma conta e rejeita versão obsoleta. Escrita direta via REST é proibida. RLS isola usuários e recusa leitura de sessão vencida, conta bloqueada e admin sem AAL2.

Se ambos editarem, há conflito: não mesclar texto clínico automaticamente. Baixe o backup local antes de carregar a nuvem. A UI mantém o rascunho local durante falhas, mas não o preserva após fechar a aba. Não exibe “sincronizado” quando uma gravação fica pendente. Processos móveis em segundo plano podem ser suspensos; reconecte e confira o estado antes de trocar de aparelho.

“Nova consulta” exige confirmação e, com nuvem ativa, exclui a versão corrente por RPC antes de limpar a tela. Se houver conflito ou falha, a limpeza não prossegue. A exclusão em outro aparelho não apaga silenciosamente o texto que já estava na memória dele. Retenção de backups/logs de infraestrutura precisa de análise separada: TTL não é garantia de eliminação em todos os sistemas.

## Verificação

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:db   # opcional: exige Docker e usa apenas banco descartável
npm audit
```

Para Chromium instalado no sistema: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e`.

Os testes de banco criam um PostgreSQL sem porta exposta, simulam os auxiliares `auth.uid()`/`auth.jwt()` do Supabase, aplicam o SQL e verificam isolamento, CAS, expiração, privilégios, bloqueio e MFA. Isso não substitui homologar o projeto real do Supabase.

Leia `docs/AUDITORIA_V2.md` para achados e limites e `docs/PROMPT_RECONSTRUCAO.md` para iniciar uma implementação nova em outra IA. Documentação anterior fica em `docs/README_LEGADO.md` e demais arquivos históricos; suas afirmações sobre serviços existentes não comprovam configuração nesta instalação.
