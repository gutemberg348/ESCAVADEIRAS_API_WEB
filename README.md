# Empimecatrônic IoT

Plataforma de campo para escavadeiras conectadas: API Express/Prisma, PostgreSQL, Redis, Mosquitto MQTT, Socket.IO, painel Next.js, app Expo e firmware Arduino para ESP32.

Publicação em VPS Ubuntu com Docker e HTTPS: [guia de implantação](docs/deploy-vps-ubuntu.md).

## Executar localmente

1. Instale Node.js 20+, Docker Desktop e Arduino IDE 2.x com o pacote ESP32 da Espressif.
2. Copie `backend/.env.example` para `backend/.env`.
3. Execute `docker compose up -d`.
4. Execute `npm install`.
5. Execute `npm run prisma:generate --workspace=backend` e `npm run prisma:migrate --workspace=backend`.
6. Execute `npm run seed --workspace=backend`.
7. Em terminais separados, execute `npm run dev:api`, `npm run dev:admin` e `npm run dev:driver`.

Painel: `http://localhost:3001`. API: `http://localhost:3000/api/v1`.

- Admin: `admin@demo.local` / `Demo@123`
- Operador: `motorista@demo.local` / `Demo@123`

## Instalar um dispositivo

1. Cadastre a escavadeira no painel.
2. Em **Dispositivos**, selecione a máquina, informe o código do ESP32 e baixe o JSON gerado.
3. Siga [firmware/README.md](firmware/README.md) para configurar a rede, calibrar entradas, compilar e gravar.
4. A primeira telemetria válida posicionará a máquina no mapa OpenStreetMap. O painel e o app recebem as próximas leituras via Socket.IO.

Cada dispositivo provisionado possui token próprio. Em produção use `ALLOW_UNPROVISIONED_DEVICES=false`, `mqtts://`, TLS e credenciais individuais também no broker.

## Teste sem hardware

Execute `npm run simulate --workspace=backend`. O simulador publica latitude, longitude, tensão, corrente, velocidade, sinal e heartbeat nos mesmos tópicos usados pelo ESP32.

Veja [docs/architecture.md](docs/architecture.md) para o fluxo de dados e as regras de segurança.
Antes da instalação física, execute o [checklist de comissionamento](docs/commissioning.md).
