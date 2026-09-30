# Publicação na VPS Ubuntu

Esta implantação publica a API e o painel em HTTPS. PostgreSQL, Redis e MQTT ficam isolados na rede Docker, sem portas públicas. O ESP32 continua falando com o Android por Bluetooth; o aplicativo envia a fila à API HTTPS quando tiver internet.

## Pré-requisitos

- Ubuntu 22.04 ou 24.04 com acesso SSH;
- Docker Engine com o plugin `docker compose`;
- portas TCP 80 e 443 liberadas no firewall da VPS;
- `api-escavadeira.techcodesoftwares.com` e `admin-escavadeira.techcodesoftwares.com` apontando para a VPS.

Não publique a porta 1883. Ela é usada somente entre a API e o Mosquitto dentro do Docker.

## Preparar

Transfira o repositório para a VPS por Git privado ou SCP. O firmware não entra nas imagens Docker porque está excluído em `.dockerignore`. No diretório do projeto:

```bash
cp .env.production.example .env.production
nano .env.production
```

Preencha os dois domínios, e-mail, senha do PostgreSQL e `JWT_SECRET`. Para gerar os segredos:

```bash
openssl rand -hex 32
openssl rand -hex 48
```

Use o primeiro resultado como senha alfanumérica do PostgreSQL e o segundo como `JWT_SECRET`. Guarde ambos fora do Git. A chave JWT também protege as credenciais BLE armazenadas; não a troque depois sem planejar uma migração ou reprovisionar os dispositivos.

Valide e suba:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml config
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs -f api admin
```

O container da API executa `prisma migrate deploy` automaticamente antes de iniciar. API e painel ficam disponíveis somente no próprio servidor, em `127.0.0.1:13000` e `127.0.0.1:13001`. PostgreSQL, Redis e MQTT não publicam portas.

## Nginx e certificados HTTPS

A VPS `187.127.5.118` já responde com Nginx. Não substitua esse serviço. Instale o Certbot, copie a configuração fornecida e valide antes de recarregar:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
sudo cp docker/nginx-empimecatronic.conf /etc/nginx/sites-available/empimecatronic
sudo ln -s /etc/nginx/sites-available/empimecatronic /etc/nginx/sites-enabled/empimecatronic
sudo nginx -t
sudo systemctl reload nginx
```

Primeiro confira `http://api-escavadeira.techcodesoftwares.com/health`. Depois solicite os dois certificados:

```bash
sudo certbot --nginx \
  -d api-escavadeira.techcodesoftwares.com \
  -d admin-escavadeira.techcodesoftwares.com
```

Informe um e-mail real ao Certbot e escolha o redirecionamento automático para HTTPS. Verifique a renovação sem modificar certificados:

```bash
sudo certbot renew --dry-run
```

## Dados iniciais para teste

O banco novo começa vazio. Somente para o primeiro teste, execute:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec api npm run seed
```

Isso cria contas e máquinas demonstrativas, incluindo a senha conhecida `Demo@123`. Não use esses dados em produção real: troque as credenciais administrativas antes de cadastrar clientes ou equipamentos reais.

## Verificações e atualização

```bash
curl https://api-escavadeira.techcodesoftwares.com/health
docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=100 api
```

Para atualizar após enviar uma nova versão do projeto:

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Faça backup do volume PostgreSQL antes de atualizações importantes. Nunca execute `down -v`, pois `-v` remove os dados persistentes.

## Aplicativo Android

Depois que `https://api-escavadeira.techcodesoftwares.com/health` responder, gere um novo APK com:

```powershell
$env:EXPO_PUBLIC_API_URL='https://api-escavadeira.techcodesoftwares.com/api/v1'
$env:EXPO_PUBLIC_SOCKET_URL='https://api-escavadeira.techcodesoftwares.com'
$env:NODE_ENV='production'
cd driver-app/android
.\gradlew.bat assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a
```

O APK local atual aponta para `192.168.0.3` e não passará automaticamente a usar a VPS. É obrigatório recompilá-lo com o domínio real.

## Firmware

Não é necessário enviar o firmware para a VPS nem colocá-lo em uma rota pública. Grave o firmware no ESP32 pela Arduino IDE. O arquivo `provisioned_config.h` contém uma credencial única e está ignorado pelo Git e pelo Docker.

Se preferir não copiar a pasta `firmware` para a VPS, pode removê-la apenas da cópia destinada ao servidor. Mantenha a versão original no computador de desenvolvimento e em backup privado.
