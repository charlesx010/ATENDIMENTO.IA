# Prontuário.IA — Comece aqui (instruções para iniciantes)

## Situação atual
O **Módulo 1** é um projeto em desenvolvimento. Os arquivos estão preparados, mas o app ainda **não está publicado** e o banco de dados Supabase já está configurado. Ainda não há aplicativo publicado. **Não use dados reais de pacientes.** A IA, o microfone e os relatórios completos serão módulos futuros.

## O que dá para fazer só pelo celular, dentro do ChatGPT

1. **Concluído:** conectar o Supabase, criar o projeto e configurar o banco de dados.
2. **Próximo passo:** finalizar e verificar a conta administrativa inicial e verificar as opções de publicação, uma decisão por vez.
3. A aprovação de despesas é sempre sua; não é preciso contratar serviços pagos no momento.

**Importante:** nunca envie senha, código de autenticação, API secret, service_role ou outras chaves privadas pelo chat. Não precisamos delas para planejar o projeto.

## O que faremos depois

- Conectar o banco ao webapp e configurar o login individual no formato `/usuario`.
- Validar o administrador com autenticação de dois fatores.
- Publicar a primeira versão online (preferência: Netlify), com orientação de tela a tela; se algum painel ficar difícil no celular, faremos quando houver computador.
- Testar login, criação de contas, sincronização e exclusão de sessões por 72 horas com dados fictícios.

## O que o Módulo 1 deve fazer após configuração

- Tela inicial responsiva com visual grafite e azul;
- Endereço `/usuario`, seguido de senha;
- Preferências individuais e painel administrativo;
- Área de notas/r​ascunho simples com sincronização temporária;
- Demonstração sem consumo de API de IA.

## Custos
A fase de testes pode caber em planos gratuitos, sujeitos a limites. A API da OpenAI não será utilizada neste módulo. Evite cadastrar cartão ou contratar plano sem revisar a necessidade no chat.

## Transparência sobre testes
O arquivo da função administrativa passou por verificação sintática básica, e o pacote ZIP foi verificado. A compilação completa do frontend e os testes conectados à nuvem **ainda não foram executados** e dependem da instalação de dependências e configuração das contas.
