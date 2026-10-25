# Prontuário.IA — Revisão do fluxo clínico v4.3 (prévia)

## Escopo aprovado
Opção 2: priorizar a revisão clínica do Modo Completo, mantendo o Modo Simplificado e o mesmo contexto da consulta. Alterações apenas em preview-testes-gratuitos; nunca mesclar à produção sem aprovação. Todos os testes usam casos fictícios.

## Problemas identificados
1. A IA do Modo Completo podia usar uma evolução desatualizada e ignorar correções posteriores na transcrição.
2. O sinalizador de propostas antigas não cobria alterações no texto da evolução editado pelo médico.
3. Documentos rápidos ainda podiam reutilizar propostas da IA após novas informações clínicas.
4. A validação de HDA permitia preenchimentos genéricos como 'NÃO INFORMADO' em respostas que estruturalmente tinham o cabeçalho correto.
5. Avisos de segurança não abrangiam perda de duração ou inserção de negativas não registradas na fonte.

## Correções
- O relato original/transcrição corrigida passa a ser a fonte principal para a análise, tanto no modo Completo quanto no Simplificado.
- A evolução editada pode complementar o relato somente quando houve intervenção manual, ou quando ela é a única fonte de texto.
- A saída anterior da IA não vira automaticamente novo fato clínico em pedidos posteriores.
- O contexto utiliza um fingerprint consistente: transcrição, complemento e evolução editada manualmente, para detectar modificações após a geração.
- Ao solicitar novo documento no modo Completo após mudar o contexto, sugestões antigas da IA não entram no documento recriado.
- Antes de copiar proposta desatualizada no modo Simplificado, a interface apresenta confirmação explícita.
- A validação de HDA rejeita texto vazio, placeholders e negações genéricas de informação.
- A revisão sinaliza perda de duração clínica e negativas introduzidas sem correspondência literal na fonte.
- Prompts Groq e OpenAI reforçam separação entre relato, texto editado, hipóteses e sugestões; divergências relevantes devem ser apontadas e não resolvidas por suposição.

## Custo e privacidade
- Não foram executadas solicitações de IA nem transcrição externas durante esta revisão.
- Nenhum dado real de paciente foi usado ou salvo; testes realizados com histórias inventadas.
- Continuam sem chamadas automáticas pagas. A OpenAI segue opt-in, com orçamento interno apenas estimado; Groq segue sujeita ao plano/cotas de sua conta.
- Não foram modificadas chave, variáveis de produção, configuração de faturamento, autenticação ou o banco Supabase.

## Verificações e pendências
- Executados 16 testes locais de lógica clínica e preservação de contexto; todos aprovados.
- A compilação do Netlify ainda deve confirmar publicação da prévia após o último commit.
- Uma compilação bem-sucedida não valida precisão clínica do modelo, o áudio real do dispositivo nem o tratamento LGPD.
- Próxima validação manual: caso fictício de joelho direito após entorse há 3 dias, com negação de febre e exame físico informado; corrigir a transcrição, complementar e gerar uma vez com o provedor escolhido.
- Verificar separação entre achados, hipóteses e condutas; não usar propostas como prescrições, laudos ou atestados emitidos automaticamente.

**Estado:** experimental, apenas casos fictícios. Produção inalterada.
