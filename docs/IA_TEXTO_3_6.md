# Prontuário.IA 3.6 — IA opcional (estado: DESATIVADA)

## Escopo
Geração de texto clínico fictício, por ação explícita e em uma chamada.
A evolução original não é sobrescrita: a interface apresenta uma prévia editável.
O médico deve aplicar a prévia manualmente e revisá-la antes de copiar.

## Bloqueios e proteção
- `TEXT_AI_ENABLED` precisa ser exatamente `true` no ambiente das Netlify Functions.
- Sem chave privada `OPENAI_API_KEY`, a função falha sem chamada paga.
- A função exige token Supabase válido, conta habilitada, `ai_enabled=true` e `monthly_limit_usd>0`.
- A função usa o RPC **atômico** `reserve_transcription_budget` já existente antes de cada chamada.
- Esse RPC reserva **estimativa de US$ 0,02** em orçamento conjunto por solicitação (não é medição de custo real). Há um teto já aplicado pelo RPC de US$ 2 por usuário/mês. Cancelamentos e erros posteriores à reserva podem continuar consumindo a estimativa.
- Configure **também** os limites de gasto e alertas no painel da OpenAI; a reserva interna não é uma garantia de limite real por token.
- Administradores precisam de sessão MFA AAL2.
- O corpo não pode exceder 10.000 caracteres clínicos; a resposta tem máximo de 1.800 tokens de saída.
- `store:false` evita salvar respostas como estado persistente da API; isso **não** implica ausência de qualquer retenção operacional pelo provedor.
- Conteúdo clínico da consulta não é gravado no Supabase nem em banco próprio. O texto é enviado à OpenAI apenas após consentimento e clique no botão.
- A aplicação segue restrita a **dados fictícios**. Não aprovada para dados de pacientes reais.
- A chave privada nunca pode estar no Vite, no GitHub ou em mensagens de chat.

## Preparação pelo responsável (não fazer sem aprovação)
1. **Revogar a chave OpenAI que apareceu anteriormente em uma conversa.** Não reutilizá-la.
2. Criar uma chave nova exclusiva para o projeto e definir controle financeiro na plataforma OpenAI.
3. Configurar a chave nova como variável `OPENAI_API_KEY` no painel Netlify, disponível para **Functions**; não prefixar `VITE_`.
4. Autorizar orçamento e IA da conta no painel Administração do Prontuário.IA.
5. Definir no Netlify `TEXT_AI_ENABLED=true` para Functions; novo deploy pode ser necessário.
6. Validar com consultas **inventadas**: doses, laterais, negações, exame físico ausente, notas incompletas e cancelamento.
7. Para desativar imediatamente: voltar `TEXT_AI_ENABLED=false` e/ou desativar `ai_enabled` na conta.

## Endpoints e arquitetura
- Rota de front-end: `/api/ai-evolution`.
- Netlify Function: `netlify/functions/ai-evolution.mjs`.
- Validação e prompt isolados: `netlify/lib/ai-note.mjs`.
- Modelo inicial fixo do lado do servidor: `gpt-5-mini`; sem escolha de modelo pelo cliente.
- Transcrição gratuita do navegador e geração narrativa sem IA permanecem funcionais sem nenhuma chamada de API.

## Limitações clínicas
- A IA realiza organização e redação, não avaliação médica autônoma.
- Não pressupor achados negativos, RX normal, CID ou doses não informadas.
- Não gerar sugestões automáticas de tratamento, medicamentos ou alta.
- Respostas são rascunhos sujeitos a revisão. Não usar em pacientes reais até avaliação LGPD, segurança e validação clínica.

## Próxima melhoria de custo
- Reunir 20 a 30 casos fictícios para avaliação de fidelidade, negativa, doses e lateralidade.
- Medir tokens e taxa de acerto antes de escolher outro modelo.
- Usar referências locais do catálogo e enviar ao modelo somente informações relevantes quando essa integração for implementada.

## Checklist da primeira validação na prévia
- Usuário informou que definiu `OPENAI_API_KEY` somente em `Deploy Previews`, e que depois criou `TEXT_AI_ENABLED` nesse contexto; o conteúdo secreto não foi lido nem verificado por este processo.
- A publicação de uma alteração na branch de prévia inicia novo deploy para carregar variáveis atualizadas.
- Confirmar build Netlify `success` antes de abrir a prévia.
- Primeiro teste SOMENTE com consulta inteiramente fictícia; se a API indicar falta de crédito, não repetimos chamadas desnecessárias.
- Status HTTP 401 para requisições sem autenticação não prova autorização financeira nem validade da chave; execução real precisa ser validada apenas com conta autenticada e teste deliberado.
- Qualquer uso de caso real exige avaliação de privacidade, conformidade LGPD e revisão clínica antes de liberar.

