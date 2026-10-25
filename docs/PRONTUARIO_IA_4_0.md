# Prontuário.IA v4.0 — Experiência dupla, IA clínica em contexto único

## Escopo da prévia
- Modo Simplificado (padrão): microfone, transcrição editável, campo de complemento e um botão para produzir evolução, hipóteses e propostas de tratamento.
- Modo Completo: mantém HDA estruturada, exame físico, condutas e documentos rápidos, que reutilizam os rascunhos de IA já recebidos.
- A evolução principal é aplicada automaticamente ao editor quando nenhuma edição aconteceu durante a requisição; há botão Desfazer.
- Se houver edição durante o processamento, a proposta permanece separada para o médico decidir se deseja aplicá-la.
- O texto clínico não é salvo no banco; o aplicativo só trabalha com dados fictícios.

## Custos
- Sem chamadas IA na inicialização, ao trocar modo, ao ditar pelo navegador, ao abrir/corrigir/copiar documentos ou ao complementar manualmente.
- Uma chamada opcional à OpenAI ao clicar em Gerar com IA. O pacote usa GPT-5 mini com 4.000 tokens máximos de saída e esforço mínimo.
- Pacote estruturado possui evolução, hipóteses, tratamento, laudo, fisioterapia, medicações, afastamento, orientações, encaminhamento, exames e pendências. Alguns podem ficar vazios quando não se aplicam.
- O teto interno de reserva no Supabase segue a estimativa fixa US$0,02 por chamada, não o custo real. O orçamento da OpenAI pode ser só alerta; não é garantia de corte.
- Não há segunda chamada ao abrir ou editar qualquer rascunho.

## Voz
- O microfone do navegador funciona sem chave externa paga, mas pode usar servidores do fornecedor do navegador e não garante precisão.
- Foi adicionada transcrição opcional Groq Whisper Large V3 Turbo, conforme o plano gratuito do provedor. Ela permanece DESATIVADA até o responsável definir:
  - GROQ_API_KEY no Netlify (Functions, Deploy Previews, valor privado)
  - FREE_TRANSCRIPTION_ENABLED=true (Functions, Deploy Previews)
- Nunca prefixar chave com VITE_; nunca colar em chats, código ou repositório.
- A API Groq Free está sujeita a cotas e a mudanças de termos. Se a conta sair do plano gratuito, a integração poderá gerar cobranças; verificar modalidade antes de habilitar.
- Áudio por gravação limitado no cliente a 100 segundos e no servidor a 3,6 MB. Não existe gravação contínua automática.
- Nenhum áudio clínico é gravado no banco do aplicativo. Áudio é transmitido ao provedor mediante clique explícito e consentimento.
- Groq pode reter dados para monitoramento de abuso e confiabilidade por até 30 dias, conforme seus controles. Para dados reais, exigir análise de LGPD e contratos antes de qualquer ativação.

## Qualidade e segurança
- Rascunhos não são decisões tomadas, laudos assinados, receitas emitidas ou atestados válidos.
- Hipóteses, medicamentos, exames, fisioterapia e afastamento são avaliações sugeridas; conferir achados, contraindicações, contexto ocupacional e lateralidade.
- Em caso de HDA incompleta, o médico deve corrigir transcrição e informações antes de novo pedido pago, nunca solicitar repetidamente por tentativa.
- Testes funcionais devem usar somente casos inventados: frase curta, HDA multilinha, lateralidade, negativa, exame incompleto, dados insuficientes, caso traumático.
- Não habilitar produção nem uso com pacientes reais sem validação clínica, segurança, privacidade e aprovação explícita.
