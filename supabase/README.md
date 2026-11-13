# Banco de dados — Prontuario-IA (Supabase)

Fonte única do esquema do banco usado pelo atendimento clássico.

## `migrations/`

As 12 migrations **já aplicadas** no projeto Supabase `Prontuario-IA`, exportadas em 13/11/2026 da tabela
`supabase_migrations.schema_migrations`. O conteúdo de cada arquivo foi conferido por MD5 contra o banco
(quebras de linha normalizadas para LF; comentários com acentuação corrompida foram mantidos como estão no banco).

Não reexecutar em um banco que já as possui. Em banco novo, aplicar na ordem do nome do arquivo.

## Diferenças entre as migrations e o banco real

O banco recebeu ajustes fora do histórico de migrations. Antes de recriar o banco a partir destes arquivos,
reproduzir também:

| Objeto | Nas migrations | No banco (13/11/2026) |
|---|---|---|
| `app_private.stamp_session()` | expiração de 72 horas | expiração de **24 horas** |
| `clinical_sessions.expires_at` (default) | `now() + 72 hours` | `now() + 24 hours` |
| Permissões de coluna de `authenticated` em `clinical_sessions` | INSERT `(user_id, payload)`, UPDATE `(payload)` | também INSERT/UPDATE em `version` e `expires_at` (o gatilho sobrescreve os valores enviados) |

## `pendentes-area-nova/`

Três migrations da área nova (`/novo`) que **não estão aplicadas** no Prontuario-IA: `workspace_sessions`,
`ai_daily_usage` e `personal_template_libraries`, com suas funções. Sem elas, sincronização, cotas e biblioteca
pessoal da área nova não funcionam; por isso a área nova está restrita à demonstração.

`20261025_workspace_v2.sql` foi escrita para banco novo: contém `revoke all on public.profiles` e uma política
própria de leitura. Revisar contra as políticas atuais antes de aplicar no Prontuario-IA.

Os testes de banco (`npm run test:db`) continuam exercitando estes três arquivos em PostgreSQL descartável.

## Comportamentos do banco que o código precisa respeitar

- Toda conta criada no Supabase Auth ganha um perfil automático (`app_private.handle_new_auth_user`) com nome de
  usuário gerado. O painel administrativo substitui esse perfil por upsert (`netlify/lib/admin-accounts.mjs`).
- A **primeira** conta criada vira `admin` com consulta liberada. As seguintes nascem `medico` com
  `consultation_enabled = false`. Manter o cadastro público desligado no Supabase Auth.
- Salvar a consulta temporária exige `consultation_enabled = true` (ou admin com MFA) e senha já trocada.
- `account_details`, o bucket `account-avatars` e `profiles.subscription_plan` existem no banco e não são usados
  pelo código deste repositório.
