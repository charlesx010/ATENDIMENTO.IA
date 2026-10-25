# Estratégia de evolução — Prontuário.IA 4.4.1

## O que foi revisado
- Dois motores de IA já instalados: Groq (Free, condicionado às cotas e plano) e OpenAI (cobrança por tokens). Não fazer troca automática para a API paga.
- A versão anterior exigia 11 campos JSON na mesma requisição, causando respostas breves e repetitivas. O perfil aprofundado usa cinco campos: evolução, hipóteses, tratamento, sinais de alerta e pendências. O pacote de documentos continua disponível como alternativa.
- O português brasileiro é exigido pelos prompts e algumas variantes europeias são normalizadas nas saídas. O texto original do relato não é alterado.
- Uma pesquisa opcional no PubMed envia apenas consulta por TEMA GENÉRICO, não o caso clínico. Busca no máximo duas referências com resumos, exibe o PMID e URL oficial, e não é usada quando o usuário não marca a opção.
- A geração com Groq, OpenAI ou PubMed não ocorre em segundo plano. Tudo exige clique e consentimento para dados fictícios.

## Sequência recomendada de trabalho
1. **Qualidade clínica e prontuários fictícios**: criar 25-30 cenários anotados, inclusive joelho, tornozelo, mão, coluna, fraturas, emergência, com laterais, negações, duração, exames inexistentes e eventos adversos. Acompanhar taxa de omissões, repetições, sugestões sem respaldo e linguagem pt-BR.
2. **Transcrição**: medir taxa de erro de termos ortopédicos, nomes de testes, números, lateralidade, doses e negativas, comparando Groq Whisper com reconhecimento do navegador. Corrigir primeiro o texto transcrito antes da geração clínica.
3. **Contexto técnico**: usar as referências PubMed como literatura complementar (evidência variável), distinguir artigo e guideline, não inventar citações. Incorporar diretrizes brasileiras verificadas por curadoria e com versão/data antes de usá-las como suporte decisório.
4. **Custo**: Groq Free enquanto houver cotas, sem fallback automático pago. OpenAI apenas por ação explícita. Não confundir a reserva fixa de US$0,02 com gasto real. Medir tokens por caso e monitorar faturamento.
5. **Segurança e LGPD**: só permitir dados reais após avaliação legal, proteção de dados, segurança, contrato com cada provedor, consentimentos adequados, trilha de auditoria e validação clínica estruturada. O projeto atual é demonstrativo.

## Limites
- Publicações obtidas por consulta PubMed podem ter baixa pertinência clínica e não equivalem a diretrizes vigentes. A pesquisa indisponível não deve bloquear a evolução nem gerar fonte inventada.
- Medicações, diagnóstico e afastamento são possibilidades para análise profissional, não ordens, receitas ou atestados assinados.
- Testes de compilação e unitários não comprovam precisão clínica real dos modelos. Precisamos comparar respostas de casos fictícios com gabarito elaborado por médico.
