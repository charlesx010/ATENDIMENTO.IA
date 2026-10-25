# Roteiro de transferência - Prontuário.IA

## Download do modelo atual

Baixe a versão de testes atual (sem chaves e sem dados de pacientes):

https://github.com/charlesx010/prontuario-ia/archive/refs/heads/preview-testes-gratuitos.zip

Repositório: https://github.com/charlesx010/prontuario-ia

Branch de trabalho: `preview-testes-gratuitos`.

Produção/main não deve ser alterada durante os testes.

## Estado atual do projeto

- Aplicação publicada em preview: https://deploy-preview-1--prontuario-ia-charles.netlify.app/charles
- Navegação principal: `Simplificado | Completo | Receituário pronto`.
- Modo Simplificado: gravação/transcrição por Groq/Whisper já testada somente com conteúdo fictício.
- Variáveis configuradas no Netlify somente para Functions e Deploy Previews: `GROQ_API_KEY` e `FREE_TRANSCRIPTION_ENABLED=true`. Nunca expor, copiar ou versionar a chave.
- Há sincronização temporária de uma consulta entre dispositivos, com expiração de 24 horas. Não é histórico permanente.
- OCR de exames/anexos foi testado no preview e o conteúdo pode ser inserido na consulta temporária.
- A aba Receituário pronto tem busca, filtros, contraste e layout para computador ajustados.
- O receituário exige confirmação explícita de revisão antes de liberar a cópia.
- O catálogo estático do preview foi iniciado em `src/prescriptionCatalogData.js`; não usar produção para importar conteúdo ainda.
- O primeiro registro organizado é Faringoamigdalite, oriundo do material validado pelo usuário. Outros itens permanecem como `Em organização`.

## Commits relevantes

- `8eb288ef53ae34c5709a818f0d4af304cda3412c` - sincronização temporária.
- `fdf76b5dd155d9f5592e3af4e9ed58f8e45ad057` - aba de receituário.
- `4f263e86459b68fb36e12d2d5983f46f0e5313b3` - navegação e layout.
- `ba2f6356fb10eee63fdeff9c6aa2f7c93c58381d` - correção do campo de pesquisa.
- `d05fdb02158901ed3eea1813052ef6547b36b573` - detalhe do receituário.
- `d1b160e6830893aecf8500389d2adec0f5f6ba5e` - primeiro lote revisável.
- `1d045fb6232c8fcb5abd71e2b1cd53d9dc4feb1b` - catálogo separado e faringoamigdalite organizada a partir do material do usuário.

## Base local já criada

Arquivo local: `catalogo_prescricoes_previa.sqlite`.

- 7 fontes indexadas.
- 2.738 trechos pesquisáveis, com fonte e página.
- Não enviar esse arquivo ao GitHub ou ao Netlify: ele serve para organizar e localizar rapidamente os conteúdos antes de publicar apenas os protocolos aprovados no catálogo de teste.

## Fontes fornecidas pelo usuário

- Guia de Prescrições Plantão e UBS.
- Guia de Prescrições em Pediatria.
- Prescrições Emergência.
- Drogas vasoativas.
- Prescrição Pediatria.
- Prescrição Atenção Básica.
- Receitas tudo em um.docx.

O usuário informou que os conteúdos foram validados por ele. Organizar e padronizar não significa criar, alterar ou inferir doses. Se houver texto truncado, ilegível, ambíguo ou incoerente, manter fora do catálogo copiável e sinalizar para confirmação do usuário.

## Roteiro de revisão passo a passo

1. Clonar/abrir a branch `preview-testes-gratuitos` e confirmar que `main` não será alterada.
2. Rodar o projeto localmente e testar o preview sem usar dados reais de pacientes.
3. Confirmar que as chaves ficam somente nas configurações de preview/Functions, nunca no código, `.env` versionado ou frontend.
4. Testar a transcrição somente com áudio fictício e confirmar que o fluxo gratuito continua habilitado.
5. Revisar sincronização temporária: abrir no celular e no computador, inserir um exame fictício, confirmar que expira e que não vira histórico permanente.
6. Revisar OCR com imagem de exame fictícia: conferir extração, resumo, edição humana e inserção na consulta atual.
7. Revisar desktop e celular: contraste, largura da busca, filtros, cartões, botões e cópia.
8. Usar a base SQLite local para encontrar os protocolos por doença/cenário/público e normalizá-los no formato do catálogo.
9. Importar em lotes grandes no arquivo estático do preview, preservando por item: condição, público, cenário, fonte/página, aviso, opções e texto copiável.
10. Para cada protocolo importado, exigir a confirmação de revisão antes da cópia. Não liberar bloco ambíguo.
11. Testar busca, filtro, seleção de opção e cópia do texto em cada lote.
12. Só depois de todos os testes e aprovação explícita do usuário, discutir uma migração para um banco definitivo. Não alterar produção antes disso.

## Prompt para continuar em outro chatbot

```text
Você vai continuar o projeto Prontuário.IA. Seja objetivo, trabalhe em etapas grandes e não desperdice mensagens. Use português do Brasil.

Contexto técnico:
- Repositório: charlesx010/prontuario-ia
- Branch exclusiva de trabalho: preview-testes-gratuitos
- Produção/main é proibida: não fazer commits, deploys, variáveis nem alterações nela.
- Preview atual: https://deploy-preview-1--prontuario-ia-charles.netlify.app/charles
- Netlify usa GROQ_API_KEY e FREE_TRANSCRIPTION_ENABLED=true somente em Functions e Deploy Previews. Nunca revelar, copiar para o código ou expor no navegador.
- Nunca realizar chamadas pagas de IA. Usar apenas dados fictícios para testes de áudio, OCR e consulta.

O que já existe:
- Modos Simplificado e Completo.
- Aba Receituário pronto ao lado dos modos.
- Sincronização temporária entre celular e computador para uma única consulta, expira em 24 horas e não é histórico permanente.
- OCR/anexo de exame e inserção manual na consulta temporária.
- Transcrição com Groq/Whisper no modo Simplificado.
- Interface desktop com contraste corrigido e busca/filtro ajustados.
- Catálogo estático em src/prescriptionCatalogData.js. Há uma condição organizada (Faringoamigdalite) e as demais estão em organização.
- A cópia do receituário só é habilitada após a caixa de revisão clínica ser marcada.

Fontes clínicas:
- O usuário forneceu apostilas/PDFs e um DOCX, declarados por ele como validados.
- Já existe uma base local SQLite de preparação com 7 fontes e 2.738 trechos pesquisáveis, com referência de fonte e página.
- Não publique PDFs, DOCX, texto bruto, dados de pacientes ou a base SQLite no GitHub/Netlify.
- Não invente, altere, complete ou deduza doses/indicações. Transforme somente textos claros do material do usuário em registros estruturados. Marque qualquer trecho ambíguo como pendente, sem cópia disponível.

Objetivo:
Organizar em massa, sem trabalho manual de uma doença por vez, as patologias e opções terapêuticas do material enviado. Preparar e publicar somente no preview um catálogo pesquisável e rápido para copiar textos de receita, mantendo confirmação de revisão humana antes da cópia.

Formato obrigatório de cada item do catálogo:
{
  id,
  name,
  setting,
  audience,
  status,
  source,
  gate,
  options: [{ id, title, note, prescription }]
}

Plano de execução:
1. Auditar a branch e o preview sem tocar na produção.
2. Fazer uma importação automatizada em massa para uma área de preparação local, mantendo fonte/página e status de cada item.
3. Gerar lotes grandes de catálogo estruturado apenas para entradas claras; itens truncados ou duvidosos ficam pendentes.
4. Salvar o catálogo do preview em arquivos estáticos versionados, não no banco produtivo.
5. Testar no navegador: busca, filtros, seleção, checklist obrigatório e cópia.
6. Fazer deploy apenas do preview e informar um link curto de teste.
7. Depois da aprovação explícita do usuário, planejar (sem executar automaticamente) a migração para um banco definitivo.

Forma de comunicação:
- Antes de agir, informe em uma frase o que será feito.
- Durante o trabalho, mande atualizações curtas.
- Não envie relatórios extensos nem peça confirmações desnecessárias.
- Ao concluir, diga o que mudou, o link do preview e um único próximo passo.
```
