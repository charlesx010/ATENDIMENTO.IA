# Correção 2.1.1 — restaurar o aplicativo existente

## Problemas confirmados no código

A versão nova substituiu o QuickWorkspace e ocultou os modos e documentos anteriores. Também mudou a sessão de `clinical_sessions/schema1` para `workspace_sessions/schema2`, exigiu cotas novas nas rotas antigas e deixou de reconhecer a flag legada no endpoint novo. O perfil dependia de colunas financeiras opcionais, e as preferências antigas faziam UPDATE que a migração nova revogava. Essas mudanças eram incompatíveis com uma instalação anterior funcionando.

Esses achados não comprovam quais commits foram publicados em `deploy-preview-3--iaidoutor.netlify.app`: o domínio está bloqueado na rede desta sessão, não há credencial Netlify disponível e o repositório ATENDIMENTO.IA não apresenta um PR3. Identificar o repositório vinculado ao site é requisito para implantar a correção no endereço certo.

## O que foi restaurado

- `/demo` e `/<usuário>` abrem o QuickWorkspace original: Simplificado, Completo, receituário, complementos e documentos.
- A área 2.1 permanece opcional em `/demo/novo` ou `/<usuário>/novo`. A troca exige confirmação e não converte dados entre schemas.
- O fluxo clássico usa exclusivamente `clinical_sessions` existente. Não recria tabelas, não lê a consulta antiga como schema2 e não faz conversão destrutiva.
- Groq/Whisper clássicos não exigem a tabela nova de cotas até `AI_USAGE_ENFORCEMENT=true` ser explicitamente ativado. Autenticação, consentimento, perfil habilitado e MFA continuam obrigatórios. Com fiscalização ativa, qualquer erro na reserva continua bloqueando o provedor, sem fallback.
- `FREE_TRANSCRIPTION_ENABLED=true` é respeitado quando as flags específicas novas estiverem ausentes; um `false` explícito prevalece.
- O novo `/api/organize-note` continua exigindo sua quota; isso não bloqueia o atendimento clássico.
- A consulta de perfil usa as colunas básicas do aplicativo existente.
- Preferências passam por `/api/preferences`, autenticado, que atualiza somente as preferências do proprietário. Não é necessário conceder UPDATE irrestrito de profiles ao navegador.

## Conexão pública em runtime

O cliente primeiro utiliza VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY válidos. Quando ausentes ou inválidos, consulta `/api/public-config`, servido pelas Functions, antes de montar o app. Esse endpoint pode utilizar SUPABASE_URL e SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY de runtime. Assim, não é obrigatório que os valores públicos já estivessem no build se estiverem disponíveis nas Functions.

Só URL e chave publicável/anon chegam ao navegador. Chaves service_role/secret são rejeitadas como credencial pública; service_role/Groq nunca entram na projeção JSON. Respostas são no-store. URL/key inválidos não derrubam o módulo inteiro; a demonstração permanece acessível.

A rota não cria credenciais. Se as variáveis também estiverem ausentes no Netlify, é preciso cadastrá-las seguramente no contexto de Deploy Previews/Functions. Não copiar valores ao chat/Git. O fato de não existirem neste executor não prova ausência no site hospedado.

## Instalação já existente

Para restaurar o fluxo clássico, publicar o código corrigido no mesmo repositório/branch que o site usa, preservando as variáveis do Supabase/Groq já funcionais. **Não reexecutar a migração de criação da base e não recriar banco ou usuários.**

- Configuração de acesso: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (ou SUPABASE_PUBLISHABLE_KEY) nas Functions.
- Frontend: as variáveis VITE públicas continuam aceitas; runtime público é alternativa quando o build não as recebeu.
- IA clássica: GROQ_API_KEY + FREE_TRANSCRIPTION_ENABLED=true, ou flags específicas equivalentes.
- Cotas novas: deixar AI_USAGE_ENFORCEMENT ausente/false no ambiente anterior até aplicar e homologar a migração de cotas. Não mudar uma instalação com cotas explicitamente habilitadas para false sem decisão administrativa.
- A área opcional nova e a biblioteca na conta continuam exigindo suas migrações próprias. Não confundir isso com a disponibilidade das funções anteriores.

## Testes e limites da verificação

Testes unitários cobrem projeção pública sem vazamento, configuração ausente, chaves privadas rejeitadas, flags legadas, rollout de quota e preferências autenticadas. E2E usa Supabase simulado com somente profiles e clinical_sessions, configuração pública em runtime, login, INSERT/UPDATE de sessão e preferências sem UPDATE direto de perfil. Outros cenários verificam modos e documentos clássicos em PC/celular e preservam os testes da área nova em /novo.

Nenhum dado de paciente ou credencial real foi usado. Testes simulados e código enviado ao GitHub não provam que o endereço Netlify recebeu a versão, nem que as credenciais reais são válidas. A validação final exige acesso ao site correto, login de teste por canal seguro e confirmação do repositório/commit do deploy.
