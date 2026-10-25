# Retomada de desenvolvimento — Prontuário.IA 2.0

## Intenção do usuário

Webapp para PC/celular, com prioridade em microfone, transcrição por IA, resumo e organização do prontuário, revisão humana e sincronização entre dispositivos. Deseja independência do chat/conta conectada ao GitHub, importação por arquivo e fluxo com tarefas delegáveis. Esclareceu que “offline” significa guardar o projeto completo e retomar o desenvolvimento depois, não exigir IA ou sincronização sem internet.

## Estado entregue

- Novo workspace ativo em `src/workspace`, fluxo Capturar/Organizar/Revisar e tela de entrada nova.
- Domínio versionado `schema:2`, relato original preservado, revisão invalidada em alterações e exportação final controlada.
- Microfone do navegador e Whisper com revisão; reprodução do áudio, descarte e proteção de transcrição pendente.
- Endpoint novo `/api/organize-note`, somente documentação factual, resposta estruturada e validação. Chamadas reais não executadas.
- Sincronização nova por RPC com CAS/UUID, leitura periódica, bloqueio de conflitos, retenção fixa de 24h e exclusão versionada. Supabase do usuário não foi configurado nem validado.
- SQL e testes de PostgreSQL, testes unitários/API/controlador e navegador. Build e dependências atualizados.
- Catálogo clínico herdado e OCR preservados. Não houve expansão/importação de material clínico nem validação de doses.
- Documentação e prompt mestre incluídos. Nenhum deploy ou push autorizado foi concluído neste ambiente.

## Fontes de verdade

1. `README.md`: instalação e comportamento atual.
2. `docs/AUDITORIA_V2.md`: achados, mudanças e limitações.
3. `docs/VALIDACAO.md`: resultados da rodada final de testes.
4. `docs/FLUXO_DESENVOLVIMENTO.md`: organização de funções e trabalho paralelo.
5. `docs/PROMPT_RECONSTRUCAO.md`: briefing para uma implementação nova.
6. `IMPORTAR_NO_GITHUB.md`: envio manual/CLI e implantação.

Documentos legados podem mencionar outra hospedagem, retenção antiga e serviços supostamente criados. Não assumir que existam nesta instalação. Não tocar no projeto anterior `charlesx010/prontuario-ia`.

## Como continuar

```bash
node --version   # usar Node 22 >=22.12
npm ci
npm test
npm run build
npm run dev
```

Use `/demo`. Functions requerem Netlify Dev ou hospedagem configurada; Vite sozinho não executa APIs.

Leia as pendências antes de promover a versão: banco/Supabase de testes, variáveis seguras, homologação de mic em aparelhos físicos e sincronização da mesma conta em PC/celular. Depois priorizar quotas e proteção de login. Nunca pedir segredos pelo chat nem declarar a aplicação homologada para pacientes reais.

O GitHub da sessão anterior negou push porque a conta conectada não tinha permissão. O usuário prefere enviar com sua própria conta. Não adicionar colaboradores desconhecidos, não forçar push e não prometer que um commit local já foi publicado.

## Checkpoint ao encerrar sessões futuras

Atualize este arquivo com: commit base, mudanças verificadas, comandos executados, falhas, requisitos externos e próxima tarefa concreta. Inclua somente contexto técnico e dados fictícios. Salve código e documentos juntos; contexto de chat não substitui checkpoint versionado.
