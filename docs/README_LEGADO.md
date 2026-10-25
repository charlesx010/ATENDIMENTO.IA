# Prontuário.IA — Módulo 1 (V0.1)

**Primeira etapa de desenvolvimento modular.** A interface está pronta, mas o aplicativo **não deve receber dados reais de pacientes** até homologação técnica, jurídica, de segurança e clínica. Use somente dados fictícios.

## O que já está implementado

- Layout grafite e azul responsivo (celular e computador), acesso somente pelo navegador.
- Página principal e endereço individual `/usuario` com solicitação de senha (inspirado na simplicidade do ProtectedText, sem copiar o sistema de criptografia dele).
- Autenticação pelo nome /usuario e senha: a Netlify Function de login consulta internamente o email real ou técnico cadastrado no Supabase Auth, sem revelá-lo ao visitante. Exige proteção contra força bruta e testes de segurança antes de uso real.
- Cadastro de contas **somente pelo administrador**. Senha temporária segura gerada no backend, trocada no primeiro acesso.
- **MFA TOTP obrigatória para administradores**; verificação AAL2 no frontend e em toda operação administrativa na Function.
- Controle de contas habilitadas/bloqueadas, redefinição de senhas de médicos pelo administrador.
- Preferências individuais persistentes em Supabase.
- Uma sessão clínica temporária por usuário, com edição de notas e rascunho, sincronização automática após alterações, controle de versão e detecção de conflito entre dispositivos.
- Expiração lógica após 72 horas de inatividade e agendamento de exclusão física no servidor a cada 15 minutos (após instalar job de limpeza).
- Modo de demonstração local **somente na memória da aba** (sem API nem armazenamento persistente de dados clínicos); usuário deve usar dados fictícios.
- Arquitetura para Netlify + Supabase, sem servidor local em produção e sem IA paga.

## O que ainda NÃO está implementado

GPT/OpenAI, transcrição de voz, Copiloto Clínico, análise multimodal, criação de PDFs, prontuário SOAP automático, fluxo médico completo, teto financeiro da API e validação jurídica/LGPD. São módulos posteriores. Não confundir a demonstração com assistência clínica real.

## Como publicar — passo a passo

### 1. Criar projeto Supabase

1. O projeto Supabase `Prontuario-IA` **já foi criado em São Paulo** e conectado pelo ChatGPT.
2. As tabelas `profiles`, `clinical_sessions`, as regras de acesso (RLS), as funções protegidas e o job de exclusão já foram instalados e verificados. **NÃO execute os arquivos SQL novamente no projeto existente.**
3. Os arquivos SQL anexos são apenas referência para uma instalação nova em outro projeto.
4. Em **Authentication > Providers > Email**, **desative a criação pública de contas (signups)**. Caso o menu tenha mudado, localize a opção de impedir novos cadastros públicos em Auth Settings. O administrador criará os usuários.
5. Em **Authentication > Users > Add user**, crie a primeira conta:
   - Email: o e-mail real cadastrado para o administrador (ou um endereço técnico criado pelo administrador). No projeto existente, a conta de Charles já foi criada e vinculada ao perfil administrador; **não crie novamente**.
   - Senha: senha forte e exclusiva, de pelo menos 12 caracteres.
   - Marque a confirmação manual do usuário, se solicitado.
6. No projeto existente, **o perfil /charles já foi criado como administrador**. Não execute novamente o SQL de bootstrap. Para novas instalações, vincule a conta corretamente após criá-la.
7. Em **Authentication > Multi-Factor Authentication**, confirme que TOTP está habilitado. Na primeira entrada, o administrador verá a configuração obrigatória do autenticador.

**Importante:** o endereço `@login.prontuario.invalid` é propositalmente não entregável. Por isso, recuperação de senha deve ser feita pelo administrador; e-mails de recuperação automáticos não funcionarão para essas contas. O administrador inicial precisa resguardar a própria senha e o segundo fator. Uma estratégia de recuperação administrativa segura é pré-requisito para produção.

### 2. Copiar as chaves do Supabase

Em Supabase > Project Settings > API (ou Connect, dependendo do painel), obtenha:

- **Project URL** — `https://xxxxx.supabase.co`
- **publishable/anon key** — usada no navegador, com regras RLS do banco.
- **service_role/secret key** — chave de servidor. **Nunca exponha, publique ou use com prefixo `VITE_`**.

### 3. Publicar no Netlify

1. Coloque os arquivos do projeto em um repositório Git privado (por exemplo GitHub). **Não** envie `.env` nem a chave `service_role` ao Git.
2. No https://app.netlify.com, use **Add new project > Import an existing project** e conecte o repositório.
3. O arquivo `netlify.toml` já define `npm run build`, a pasta `dist` e a Netlify Function administrativa.
4. Em **Project configuration > Environment variables**, cadastre quatro variáveis:

| Variável | Valor | Escopo |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do projeto | Build |
| `VITE_SUPABASE_ANON_KEY` | Chave anon/publishable | Build |
| `SUPABASE_URL` | URL do projeto | Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role/secret | Functions **apenas** |
| `SUPABASE_ANON_KEY` | Chave pública anon/publishable | Functions **apenas** |

> É fundamental que `SUPABASE_SERVICE_ROLE_KEY` não seja configurada como variável pública de build, nem tenha prefixo `VITE_`. Ajuste os escopos conforme o painel Netlify.

5. Publique. Acesse `https://seu-site.netlify.app/charles` para entrar.
6. Após o login, configure TOTP e teste criação de contas no painel de administração.
7. Teste a mesma conta no celular e computador, com **dados fictícios**, verificando sincronização, bloqueios e expiração.

### 4. Testes locais opcionais (somente desenvolvimento)

`npm install` e `npm run dev` após criar `.env` com as duas variáveis **públicas** de Vite. Operações de administração via função exigem `netlify dev` com as variáveis privadas acessíveis ao processo; o Vite isolado não executa Netlify Functions. Produção não exige nenhum servidor local.

## Política de retenção (V1)

- Preferências, conta e autenticação: persistentes na nuvem.
- Sessão clínica: no máximo 72 horas **desde a última alteração sincronizada**, seguida de expiração. A consulta não deve ser usada com pacientes reais sem validação.
- Exclusão manual: remove imediatamente a sessão do banco pelo usuário.
- Cron: varre linhas vencidas a cada 15 minutos para exclusão física.
- O navegador pode manter tokens de autenticação em armazenamento próprio; **dados clínicos ficam somente na memória enquanto a aba está aberta**, além do armazenamento temporário protegido no Supabase.
- É necessário validar também **backups, logs e mecanismos de retenção dos provedores**, que podem ter ciclos diferentes de exclusão física; não há garantia de apagamento dos backups em 72 horas.

## Segurança e limitações

- O login via `/usuario` usa uma Netlify Function. Antes de uso real, é obrigatório implementar e verificar controles adicionais contra tentativas repetidas de senha no endpoint, além dos limites aplicados pelo Supabase Auth.

- As RLS do Supabase isolam as linhas de cada usuário. O campo `/usuario` apenas seleciona a conta; **não** oferece acesso aos dados sem autenticação.
- HTTPS e criptografia de armazenamento no provedor não significam criptografia ponta a ponta. Administradores de infraestrutura do banco podem ter acesso técnico em circunstâncias autorizadas.
- O painel administrativo exige MFA TOTP verificada; quando a conta é bloqueada pelo admin, operações clínicas futuras são negadas no banco. Revogação imediata de todos os tokens é trabalho adicional para produção.
- Supabase Auth aplica proteções próprias, mas proteção adaptativa a *novos dispositivos e acessos suspeitos* ainda exige implementação e validação adicionais.
- Não há integração OpenAI neste módulo: custo de IA **US$ 0**.
- A interface é 100% web (não é PWA); não há funcionamento clínico offline.
- Planos gratuitos têm limites, podem pausar projetos e sofrer mudanças comerciais.

## Próxima fase

**Módulo 2:** documentação médica (SOAP/narrativa), diferentes especialidades, campos adaptativos, modelos e editor avançado — priorizando programação convencional sem gasto com IA.

## Módulo 2.2 — transcrição opcional com GPT (em testes)

- A interface mantém somente **Iniciar / Pausar / Continuar / Parar**; não há reprodução nem opção de download do áudio.
- Antes do envio, o usuário precisa habilitar IA para sua conta, estabelecer limite mensal em **Administração** (US$ 0 por padrão), configurar uma **nova** chave privada de API no Netlify, e autorizar explicitamente o envio de **áudio fictício** para transcrição.
- Chave necessária no **servidor Netlify Functions**: `OPENAI_API_KEY`. Nunca use prefixo `VITE_`, nem a coloque no repositório, navegador ou conversa. Revogue chaves que tenham sido compartilhadas anteriormente.
- A transcrição utiliza o modelo `gpt-transcribe` (API `/v1/audio/transcriptions`). O arquivo é recebido pela Function somente em memória, enviado à OpenAI e descartado pelo aplicativo. A OpenAI mantém suas próprias políticas de tratamento e retenção; verificar contratos antes de usar dados pessoais.
- A transcrição só é incluída na consulta após o médico **revisar e clicar em "Inserir nas anotações"**. O texto inserido é identificado como transcrição bruta; não é diagnóstico, receita ou SOAP automático.
- Modelo de testes: até 120 segundos e 1,5 MB por requisição. A tabela `ai_transcription_budget` reserva **US$ 0,02 por requisição**, limitando no máximo US$ 2 por conta ao mês. É **uma estimativa conservadora do aplicativo**, não um limite garantido pela OpenAI; configure orçamento e alertas também no provedor.
- Continuação planejada: estruturação SOAP e geração de documentos por solicitação, mantendo a revisão médica e limites de custos.
- **Não utilize pacientes reais** até validação de segurança, consentimento informado, adequação à LGPD e regras profissionais aplicáveis.

## Módulo 2.3 — transcrição padrão gratuita (primeira opção)

- A tela **Atendimento** usa `BrowserDictation.jsx`, com Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`): **Iniciar, Pausar, Continuar, Parar**, campo de revisão e inserção manual no prontuário.
- Não chama OpenAI, não exige chave de API, não armazena arquivo de áudio e não apresenta reprodutor.
- O fornecedor do navegador pode processar áudio em seus servidores: **não é garantia de processamento local nem de conformidade com LGPD**. Por isso esta versão exige consentimento para testes com dados estritamente fictícios; consultas reais continuam proibidas até homologação.
- O recurso depende do suporte do navegador e de conectividade e pode interromper-se. Se não houver suporte, use o botão de ditado do teclado Android no campo de observações, também sujeito às políticas de dados do fornecedor.
- O texto fica apenas na memória da aba enquanto não for revisado e inserido manualmente; o texto incluído é salvo temporariamente junto da consulta, marcado como **DITADO DO NAVEGADOR (REVISAR)**.
- Uma alternativa futura para maior privacidade é reconhecimento local com modelo aberto (por exemplo Whisper executado no aparelho), sujeito a teste de desempenho, bateria, memória e tamanho de download.
- A integração opcional paga (`transcribe.mjs`) continua inativa sem chave e sem autorização administrativa. Na versão 2.3 ela **não aparece na tela de atendimento**. 
