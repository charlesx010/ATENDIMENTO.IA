# Importar o projeto no GitHub e implementar

Este ZIP é **código-fonte**, não um arquivo que o GitHub executa ou extrai automaticamente. O repositório de destino é `charlesx010/ATENDIMENTO.IA`. Use sua própria conta com acesso a ele. Nenhuma chave privada está incluída.

## Pelo navegador, sem outro usuário

1. Extraia o ZIP no computador.
2. Entre no GitHub com a conta dona do repositório e abra `ATENDIMENTO.IA`.
3. Use **Add file → Upload files**.
4. Envie o **conteúdo extraído**, deixando `package.json`, `src`, `netlify.toml` e `README.md` na raiz. Não envie somente o ZIP e não crie uma pasta extra envolvendo o projeto.
5. Inclua `.github/workflows/validate-build.yml`, `.gitignore` e `.env.example`. Ative a visualização de arquivos ocultos no gerenciador de arquivos. Se a interface web ignorar `.github`, use GitHub Desktop ou Git.
6. Confira a lista e confirme o commit. Não carregar `node_modules`, `dist`, `.env`, chaves, bases privadas ou dados de pacientes.
7. Abra **Actions** para acompanhar a validação. O workflow executa instalação por lockfile, testes, build, navegador, banco descartável e auditoria.

## Por GitHub Desktop

Extraia o projeto; no GitHub Desktop autenticado na sua conta, crie/adicione um repositório local usando essa pasta. Confirme que só código e documentos estão incluídos. Publique para o destino correto ou clone o destino vazio antes e copie o conteúdo extraído para ele. Não substituir alterações existentes sem revisão.

## Por terminal

Com Git e Node.js 22 instalados, a partir da pasta extraída:

```bash
npm ci
npm test
npm run build
git init -b main
git add .
git commit -m "Reconstrói fluxo de documentação, IA e sincronização"
git remote add origin https://github.com/charlesx010/ATENDIMENTO.IA.git
git push -u origin main
```

Se já houver `.git` ou `origin`, não repetir os comandos de inicialização; confira o estado e preserve alterações. Se o destino já tiver commits, use uma branch de importação e pull request. **Não usar `--force`.** Autentique pelo mecanismo seguro do GitHub/GitHub Desktop da sua conta; não colocar token no arquivo, URL ou chat. Se Git pedir nome/e-mail do autor, configure os seus dados localmente.

## Implementar o webapp

GitHub armazena o projeto; as Functions e a sincronização não passam a existir só por enviar arquivos. **GitHub Pages sozinho não executa este backend.**

1. Crie/importa um projeto de testes no Netlify apontando para este repositório. O `netlify.toml` já define o build, `dist`, Functions e rotas.
2. Crie um Supabase de testes separado e siga `README.md` e a migração SQL fornecida. Não executar sobre banco produtivo sem revisar.
3. Configure URL/chave pública de Supabase para build. Configure service_role, chave de login e Groq **somente nas Functions**, por entrada segura no painel.
4. Mantenha os flags de IA desligados até configurar o provedor. Use dados fictícios; confirme plano/cotas antes de habilitar transcrição e resumo.
5. Teste login, MFA, microfone em HTTPS e a mesma consulta no celular e PC.
6. Homologue erros e conflitos antes de usar além dos testes. Não há certificação clínica/LGPD neste pacote.

## Guardar e retomar

Guarde este ZIP junto do arquivo opcional `.bundle` fornecido separadamente. O ZIP restaura os arquivos; o bundle restaura o histórico Git local. Leia `docs/RETOMADA.md` em outra sessão/IA. Para restaurar o bundle em pasta nova:

```bash
git clone /caminho/ATENDIMENTO.IA-v2.bundle ATENDIMENTO.IA
cd ATENDIMENTO.IA
npm ci
```

Credenciais não são incluídas. Dependências e serviços externos precisam ser preparados separadamente; guardar código offline não torna Groq/Supabase utilizáveis sem internet.
