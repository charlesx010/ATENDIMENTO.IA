# Validação — piloto profissional 2.1 — 02/11/2026

| Verificação | Resultado |
|---|---|
| Runtime | Node.js 22.23.4; dependências e lockfile preservados, versão 2.1.0 |
| Testes unitários/API/controlador | 191 aprovados, 0 falhas, 0 ignorados |
| Build | Vite 8.3.5 concluído |
| Playwright/Chromium | 22 testes aprovados |
| Responsividade | Fluxo de consulta em 1440, 390 e 360px; biblioteca em 390px sem overflow |
| Quotas | API rejeita falta de auth, quota, falhas de reserva e configuração; teste PostgreSQL de limites e isolamento |
| Biblioteca | CRUD/export/import, CAS entre aparelhos, exclusão com versão, limites em UTF-8; leitura/gravação lentas preservam edições locais |
| Microfone | Fixtures para concorrência de permissão, cancelamento, resposta tardia, limpeza e transcrição inválida preservando áudio |
| Recuperação | Checkpoints, nova consulta limpa OCR antigo, revisão reinvalidada, pausa de sync e proteção de conteúdo auxiliar |
| Documento | Saída SOAP/narrativa e impressão apenas do documento revisado, sem shell do aplicativo |
| Auth | Fluxo de recuperação/timeout e ErrorBoundary; demo acessível sem dependência de Auth |
| Banco | Script aplica base + cotas + biblioteca em PostgreSQL17 descartável; testes de isolamento, permissões, CAS, TTL, conta bloqueada e políticas |
| Dependências | npm audit: 0 vulnerabilidades reportadas |
| Patch | git diff --check sem erros |

Os testes de Auth/provedor/áudio no navegador utilizam fixtures. O banco de testes usa auxiliares `auth.uid()` e `auth.jwt()` simulados. Não foram usadas credenciais do usuário, não foram enviadas consultas/áudios reais à IA e não foi alterado um banco hospedado.

As verificações locais não substituem teste em Android/iPhone físicos, serviços reais, revisão clínica/jurídica e segurança operacional. O domínio do preview externo permanece bloqueado na rede deste ambiente. A CI da branch será independente desta validação local; só afirmar sucesso remoto após observar sua conclusão.

Critérios e comandos de ativação: `docs/PILOTO_COMERCIAL.md` e `README.md`.
