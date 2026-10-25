# Prontuário.IA — Etapa A: estabilização e qualidade clínica

**Escopo aprovado:** somente branch `preview-testes-gratuitos`. Sem merge e sem alterações em `main`. Produção não homologada.

## Problemas identificados e correções
1. O workflow de testes já falhava (88/89): palavras com letras acentuadas, como "Informação", podiam ser classificadas erroneamente como "informa" no campo HDA porque `\b` não trata todas as letras Unicode como letras. Foi corrigido o delimitador da expressão regular para Unicode.
2. Respostas de IA com seções presentes, porém HDA vazia, eram aceitas e podiam produzir um laudo não fundamentado. Agora uma HDA com conteúdo clínico mínimo é exigida antes de atualizar a evolução.
3. Dados de maior impacto clínico passam por revisão automática determinística **sem chamadas extras à IA**: lateralidade, negativa informada, quantidade/dose explicitada; rascunhos de medicações com doses novas, períodos de afastamento sem contexto ocupacional e CID não informado.
4. Uma resposta que chegar depois de alteração no contexto da consulta não substitui automaticamente a evolução ou os documentos: a proposta fica separada para decisão do médico. Alertas de contexto/documentos desatualizados aparecem no Simplificado e Completo.
5. A rota gratuita Groq não é substituída pela OpenAI paga quando o provedor falha ou atinge cota. O reconhecimento gratuito por navegador e o Whisper opcional continuam exigindo revisão de transcrição e não utilizam a API OpenAI.
6. Para o Netlify publicar esta branch de prévia, executa **`npm test && npm run build`**. Falha em qualquer teste impede novo deploy na prévia. O workflow GitHub também executa ambos.
7. Os textos clínicos continuam temporários nesta aba. Não foi adicionado banco, histórico clínico ou registro de áudio.

## Critérios de qualidade automatizados
- Narrativa existente e HDA efetivamente preenchida (não basta o título "HDA:").
- Histórias em múltiplas linhas, sem misturar exame físico e conduta.
- Alertas para laterais incompatíveis e perda de negativas e doses.
- Rascunhos de laudo, fisioterapia, medicação e afastamento são **propostas não validadas**.
- Novas propostas não sobrescrevem edições realizadas durante a chamada.
- Requisição a IA é explícita; os alertas e os testes não invocam IA.

## Teste manual sugerido no Android (somente caso fictício)
1. **Transcrição:** dite relato inventado com "joelho direito", "nega febre" e "5 mg" e confira palavra por palavra antes de inserir. Repita pelo reconhecedor do navegador e, se disponível, pelo Whisper Groq.
2. **Modo Simplificado:** corrija a transcrição, acrescente exame e solicite geração apenas quando desejar. Confira evolução, HDA, hipóteses, tratamento e alertas.
3. **Modo Completo:** reutilize o mesmo contexto e abra laudo e encaminhamento, sem criar segunda chamada.
4. **Alteração durante geração:** inicie geração fictícia e modifique a transcrição antes da resposta; a evolução antiga deve continuar, com proposta separada.
5. **Limpeza:** encerre a consulta e verifique que não restou texto visível ao iniciar uma nova.

## Não incluído na Etapa A
- Nenhuma mudança no branch `main` e nenhuma ativação adicional de faturamento.
- Nenhuma chamada remota com dados reais ou credenciais para testar modelos.
- Nenhuma garantia de que IA gratuita seja ilimitada ou de que os orçamentos alertas da OpenAI imponham limites rígidos.
- Não há homologação clínica, validação regulatória/LGPD ou benchmarking formal em dispositivos Android.
- Não há substituição da avaliação médica, emissão automática de receita, laudo definitivo ou atestado.
