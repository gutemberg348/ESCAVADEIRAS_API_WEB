# Usuários e configurações do painel

## Acessos

O menu **Usuários** mostra as contas reais da empresa: administradores, gerentes e motoristas. Motoristas continuam sendo cadastrados em **Motoristas**, onde ficam os cartões RFID e os vínculos com escavadeiras. O tipo da conta não pode ser trocado diretamente, para não romper esses vínculos.

Um administrador da empresa pode criar um gerente em **Usuários → Novo gerente**. Um superadministrador escolhe a empresa. O gerente acessa dashboard, escavadeiras, mapa, telemetria, alertas, a lista de usuários e suas próprias configurações em modo de leitura. Ele não cadastra pessoas/placas, não altera cartões, não envia comandos e não modifica a identidade visual da empresa. Essas restrições são verificadas também pela API.

Administradores podem corrigir nome/e-mail, ativar ou desativar gerentes e definir nova senha de outra pessoa em **Editar conta**. Para a própria conta, use **Configurações**. A senha deve ter pelo menos 10 caracteres. Ao trocar ou redefinir uma senha, tokens antigos deixam de funcionar e a pessoa precisa entrar novamente.

## Aparência

**Configurações → Meu perfil** altera nome, e-mail e foto do usuário. A foto aparece no canto superior do painel. **Logo e cor principal** altera a marca da empresa, visível para quem pertence a ela. As imagens PNG/JPG/WebP são reduzidas no navegador e armazenadas no PostgreSQL; o limite por imagem enviada é 180 KB em base64. **Claro/Escuro** é uma preferência local do navegador, não da empresa.

## Implantação na VPS

Estas funções exigem as migrações `20261001160000_user_management_branding` e `20261001161000_user_session_version`. O container da API executa `prisma migrate deploy` ao iniciar. Após enviar o código para a VPS, no diretório do projeto:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build api admin
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

Não execute `prisma db push` nem apague o volume do PostgreSQL em produção. Após atualizar, as sessões anteriores precisarão de novo login porque os tokens passaram a ter versão de sessão.
