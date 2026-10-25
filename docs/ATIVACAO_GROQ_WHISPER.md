# Ativação segura da transcrição por IA gratuita — Groq Whisper

Este checklist documenta somente o ambiente de testes. Nenhuma chave é armazenada neste repositório.

## Ambiente Netlify — Deploy Previews / Functions
- Variável privada `GROQ_API_KEY` com a chave criada no GroqCloud.
- Variável `FREE_TRANSCRIPTION_ENABLED` com valor exato `true`.
- Salvar no contexto de prévia, não liberar produção.
- Novo deploy da branch `preview-testes-gratuitos` carrega a configuração.

## Verificação
1. Fazer login no Prontuário.IA na URL de deploy preview.
2. Escolher **Simplificado**.
3. Confirmar que a opção **Whisper por IA — cota grátis** aparece no seletor acima do microfone.
4. Autorizar gravação somente com **texto fictício**.
5. Gravar um trecho de 10–20 segundos; clicar **Parar**, depois **Transcrever (cota grátis)**.
6. Comparar o texto com o que foi falado. Corrigir especialmente lateralidade, negações, medicamentos e doses.
7. Clicar **Inserir no relato**. O resultado deve aparecer em **O que foi transcrito**.
8. Nenhuma chamada à OpenAI deve ocorrer durante a transcrição. A geração clínica separada só ocorre após outro clique e está sujeita a custo.

## Segurança e orçamento
- Chave somente no Netlify Functions, nunca no frontend, GitHub ou conversas.
- Requisição de transcrição precisa de sessão e de consentimento fictício.
- Gravação limitada a 100 segundos e arquivo de até 3,6 MB.
- O plano Groq Free possui cotas; caso o fornecedor informe esgotamento, usar microfone do navegador. Não fazer upgrade sem decisão expressa.
- Não há certificação para dados reais de pacientes. Exige análise de segurança, LGPD e contratos antes de uso real.
