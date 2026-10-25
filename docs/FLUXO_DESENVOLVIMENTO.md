# Fluxo para evoluir o Prontuário.IA

## Organização do trabalho

Mantenha uma versão estável em `main` e desenvolva cada melhoria em uma branch curta. Abra uma issue com objetivo, arquivos que podem ser alterados, critérios de aceite e evidência esperada. Integre por pull request depois dos testes. Uma pessoa/IA coordena decisões e integração; as demais recebem tarefas independentes.

| Função | Responsabilidade | Área preferencial |
|---|---|---|
| Coordenação | Prioridades, contratos de dados/API, revisão e integração | Issues, README, decisões |
| Interface | Responsividade, acessibilidade, experiência de captura/revisão | `src/workspace` e CSS |
| Voz e IA | Microfone, transcrição, schemas, segurança factual e erros | Gravadores, Functions e bibliotecas de IA |
| Dados | Auth, SQL, retenção, protocolo de sincronização e conflitos | `supabase`, `sync.js`, hook de transporte |
| Qualidade | Cenários independentes, regressões, navegador e banco | `tests`, CI e evidências |

É possível delegar funções ao mesmo tempo, inclusive a IAs diferentes. Cada tarefa precisa de um dono e um contrato comum. Duas IAs não devem editar os mesmos arquivos simultaneamente sem coordenação. Em uma ferramenta que compartilha o mesmo checkout, reserve caminhos por responsável e peça integração ao coordenador. Em máquinas independentes, use branches distintas e PRs. Não pedir a várias IAs que executem “melhore tudo” ao mesmo tempo.

## Modelo de tarefa

```text
Contexto: Prontuário.IA, versão/commit de base ___. Leia README e docs/RETOMADA.
Função: ___.
Objetivo verificável: ___.
Escopo permitido: ___.
Contratos que devem ser preservados: Consultation schema=2, API de documentação e RPCs de sincronização.
Não alterar: ___ (especialmente outros módulos, segredos e produção).
Critérios de aceite: ___, incluindo cenários de falha.
Verificação: comandos e evidências ___, com dados fictícios.
Entregar: mudança revisável, testes, limitações e instruções de integração.
Não publicar nem ativar serviço pago sem autorização.
```

## Ciclo recomendado

1. Criar uma issue por resultado de produto, não por arquivo. Exemplo: “transcrição no Safari sem perder áudio ao parar”.
2. Coordenador define schema/API e distribui até três tarefas independentes; qualidade pode preparar cenários paralelamente.
3. Cada responsável implementa e testa sua área, informando alterações em contratos antes de prosseguir.
4. Coordenador integra uma tarefa por vez e resolve conflitos com base nos critérios do produto.
5. Rodar `npm ci`, `npm test`, `npm run build`, `npm run test:e2e` e, quando SQL/sync mudarem, `npm run test:db`.
6. Homologar preview com casos fictícios. Testes de mic e sincronização reais precisam de serviços configurados e aparelhos físicos.
7. Atualizar `docs/RETOMADA.md`, registrar limitações e criar um commit. Publicar só com autorização e critérios cumpridos.
8. Ao encerrar uma sessão, gerar ZIP e, se possível, um Git bundle. Guardar o checklist de retomada junto do código.

## Prioridades seguintes

- P0: configurar um Supabase/Netlify de testes e homologar a mesma conta em dois aparelhos.
- P0: testar áudio fictício real no Android e iPhone e a resposta real do provedor.
- P1: quota transacional de IA por conta e proteção contra força bruta no login.
- P1: liberar recursos OCR e resultados pendentes com cancelamento efetivo ao navegar.
- P1: revisar políticas/logs/backups e validar exclusão agendada no serviço real.
- P2: decidir se é necessário funcionamento offline durável. Isso exige desenho próprio, não apenas cache do site.
- P2: avaliar TypeScript e dividir mais a interface sem interromper o fluxo testado.

## O que significa guardar offline

O ZIP e o Git bundle permitem guardar código, documentação e estado do desenvolvimento sem manter este chat aberto. Em outra máquina, extraia, leia `RETOMADA`, instale dependências e continue. O ZIP não contém segredos nem node_modules. A primeira instalação de dependências normalmente precisa de internet.

Para ter **desenvolvimento totalmente offline**, prepare previamente Node 22, dependências/cache npm, Chromium e imagem Docker do PostgreSQL. O bundle só contém objetos Git; não inclui dependências, imagens Docker nem infraestrutura hospedada. É possível arquivar esses itens separadamente na própria máquina, observando tamanho e compatibilidade de sistema operacional.

Para ter **aplicativo offline**, são necessários cache do shell/PWA, armazenamento local durável com proteção adequada, fila de operações, política de chaves/retenção e resolução de conflito ao reconectar. Esta versão mantém rascunho em memória e exporta/importa backup; não entrega esse modo durável offline. Groq e Supabase continuam dependendo de internet.

Para ter **IA offline**, é necessário outro projeto técnico: modelo local de voz e texto, hardware compatível, instalação de pesos/licenças, desempenho móvel e avaliação de precisão. Não confundir instalação local do frontend com inferência local de IA.
