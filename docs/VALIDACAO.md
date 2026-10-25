# Evidências de validação — 25/10/2026

Rodada local final desta entrega, com dados fictícios:

| Verificação | Resultado |
|---|---|
| Instalação limpa | `npm ci` concluído com lockfile |
| Runtime | Node.js 22.23.4 |
| Testes unitários/API/controlador | 151 aprovados, 0 falhas, 0 ignorados |
| Build | Vite 8.3.5, concluído |
| Navegador | 7 testes Playwright aprovados em Chromium |
| Responsividade | Fluxo local verificado em 1440, 390 e 360 pixels, sem overflow horizontal |
| Voz | Web Speech simulado: autorização, texto, parada, inserção e confirmação antes de descarte |
| Revisão | Cópia bloqueada antes de revisar; alteração do original invalida aprovação |
| Anexo | TXT fictício lido no navegador, revisado e inserido |
| Backup | JSON importado com nova revisão obrigatória |
| Acesso | Nova tela de entrada, seleção de usuário e demonstração sem credenciais |
| Banco | Migração aplicada em PostgreSQL 17 descartável; isolamento, CAS, TTL, privilégios, MFA, conta bloqueada, anonimato e exclusão verificados |
| Dependências | `npm audit`: 0 vulnerabilidades reportadas na rodada final |
| Integridade de patch | `git diff --check` sem erros |

Os testes de API usam respostas de provedor simuladas; os de banco usam auxiliares Auth simulados. Não são evidência de Groq real, do Supabase do usuário ou de microfone físico em Android/iOS. Nenhum deploy foi realizado. Auditoria automática de dependências não equivale a auditoria de segurança completa.

Comandos reproduzíveis constam no README e no workflow `.github/workflows/validate-build.yml`. A CI está fornecida no projeto, mas ainda não foi executada no GitHub deste repositório.
