# Teste local: motorista, cartão e GPS

## Serviços

Depois de instalar as dependências e aplicar as migrações, o Windows pode iniciar API, painel e Expo em segundo plano com `powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1`. Os logs ficam em `.local-logs/`. O script preserva portas já ocupadas e não inicia o simulador. Depois de alterar código do painel, use `npm run dev:admin` ou refaça a build antes de iniciar a versão compilada.

O computador de teste usa `192.168.0.3`. API: porta 3000; painel: 3001; MQTT: 1883; PostgreSQL: 55432; Redis: 6380. Celular e ESP32 precisam alcançar esse computador pela rede local. Se o IP mudar, atualize `MQTT_PUBLIC_URL` no backend e gere novamente a configuração da placa. O app em Expo Go encontra o host do Metro; `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_SOCKET_URL` permitem definir outro servidor.

```powershell
# Na raiz do projeto, com Docker Desktop ativo:
docker compose up -d
npm run prisma:generate --workspace=backend
npm exec --workspace=backend -- prisma migrate deploy
# Em terminais separados:
npm run start --workspace=backend
npm run dev:admin
npm run dev:driver
```

O simulador deve ficar parado durante testes físicos. Os cadastros e posições antigos de demonstração continuam no banco; uma máquina offline mostra a última posição conhecida, não uma posição atual.

## Cadastro pelo leitor USB

1. Abra `http://localhost:3001/admin/drivers` e escolha **Cadastrar motorista**.
2. Preencha nome, e-mail, senha inicial e empresa. O motorista usará esse e-mail e senha no app.
3. Em **Leitor USB / UID manual**, clique em **Ler pelo USB** e aproxime o cartão.
4. Confira o UID e salve. Também é possível criar o motorista sem cartão e usar **Ler ou vincular cartão** depois.

Esta entrada suporta leitores USB que funcionam como teclado (HID). O leitor precisa transmitir o UID hexadecimal do mesmo cartão usado no RC522, mantendo os zeros à esquerda. O sistema aceita UIDs de 4, 7 e 10 bytes (8, 14 e 20 caracteres). Não converte silenciosamente números decimais nem inverte a ordem dos bytes. Para confirmar compatibilidade, compare a leitura USB com `[RFID] UID lido` no Monitor Serial do ESP32. Leitores seriais e leitores de outra tecnologia/frequência dependem do modelo e não estão integrados por esse campo.

O Enter enviado pelo leitor não salva automaticamente o formulário: confira a pessoa antes de confirmar.

## Cadastro pelo RC522 da máquina

1. O ESP32 deve estar provisionado, conectado e exibido como online.
2. Na tela de cartões, selecione o motorista e **Leitor de uma máquina**.
3. Selecione a escavadeira e clique em **Aguardar cartão na máquina**.
4. Aproxime o cartão no RC522. A captura dura dois minutos e conserva apenas a primeira leitura.
5. Confira o UID e clique em **Vincular cartão**. O salvamento encerra a captura.

Durante a captura o leitor é reservado ao cadastro: as leituras não trocam o motorista, nem geram alertas de cartão desconhecido. Cancelar, sair da tela ou aguardar o prazo libera o leitor. Uma segunda captura simultânea no mesmo leitor é recusada.

## Identificar quem está na máquina

Após o cadastro, aproxime novamente o cartão na máquina, fora do modo de captura. O fluxo é:

```text
RC522 → ESP32 → machines/<dispositivo>/events
      → API valida dispositivo, cartão e empresa
      → vínculo/histórico no PostgreSQL
      → Socket.IO atualiza painel e app
      → machines/<dispositivo>/rfid-result confirma ao ESP32
```

- `AUTHORIZED`: operador identificado. O app desse motorista descobre a máquina automaticamente, mesmo se estava sem vínculo.
- `DENIED`: cartão desconhecido, desativado ou de outra empresa. A máquina fica sem operador identificado e um alerta é registrado.
- `CAPTURED`: UID reservado para o cadastro aberto no painel; não representa autorização operacional.
- Aproximar outro cartão válido transfere a identificação. O motorista anterior perde acesso REST e deixa de receber a telemetria dessa máquina pelo socket.
- Desativar um cartão encerra a identificação feita por ele. O administrador também pode atribuir uma máquina manualmente; esse vínculo é marcado como manual, não como uma leitura física de cartão.
- Reiniciar o ESP32 gera um novo `bootId` e exige nova apresentação. Desconexão de Wi-Fi, por si só, não é tratada como desligamento do motor.
- O firmware repete a transmissão por até 15 segundos aguardando confirmação. Eventos repetidos com o mesmo ID são deduplicados por dez minutos. Sem rede, aproxime de novo depois de reconectar; leituras antigas não são guardadas para autorizar posteriormente.
- O bip imediato indica leitura física. O resultado do servidor aparece no Monitor Serial como `[RFID] Servidor: ...`.

O hardware atual não tem entrada de ignição. Portanto, o sistema identifica o cartão e o reinício do ESP32, mas não comprova o instante em que o motor foi ligado. Se o ESP32 permanece alimentado com a máquina desligada, a próxima partida não gera automaticamente novo `bootId`.

## GPS e mapas

O GPS NEO-6M fornece latitude e longitude ao ESP32. MQTT transporta as leituras para o backend, que alimenta o mapa. O mapa não substitui o receptor GPS.

- Painel e app web: OpenStreetMap (Leaflet no painel). Requer internet para carregar o mapa-base, mesmo com a API local. Mantenha a atribuição e observe a [política de tiles](https://operations.osmfoundation.org/policies/tiles/).
- App Android: Google Maps via `react-native-maps`; iOS: mapa nativo. No Expo Go não é necessária configuração extra. Para o APK Android, configure `GOOGLE_MAPS_API_KEY`, habilite Maps SDK for Android e restrinja a chave ao pacote `com.empimecatronic.operador` e à assinatura da build, conforme a [documentação do Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/map-view/).
- `driver-app/app.config.js` lê a chave do ambiente durante a build.
- Sem fix válido, o backend conserva a última coordenada e informa `gpsValid=false`; `gpsUpdatedAt` indica quando o GPS realmente foi atualizado. Coordenadas vazias nunca viram um ponto em 0,0.

## Peças conferidas com o código de bancada enviado

GPS RX: GPIO16; RC522 SS/RST/SCK/MISO/MOSI: 5/4/18/19/23; sensor de tensão: 34; ACS758: 35; buzzer: 25. O divisor mantém fator nominal 5 e o zero inicial do ACS758 é 0,39 V. A amperagem permanece ausente até confirmar a variante e calibrar sua sensibilidade.

O relé automotivo de 4 pinos continua indisponível. Falta o modelo, tensão da bobina, circuito acionado e interface elétrica. Nenhum GPIO de relé nem comando de corte foi habilitado. Uma bobina de relé automotivo não deve ser alimentada diretamente pelo ESP32.

## Validações automatizadas e limites

```powershell
npm run test:integration --workspace=backend
```

Esse teste cria registros temporários exclusivos, usa API, MQTT, Socket.IO, PostgreSQL e Redis reais, e remove somente os próprios registros ao terminar. Valida cadastro com cartão, duplicidade/rollback, captura, confirmação MQTT, identificação, troca de operador, desativação, reinício, GPS inválido e isolamento entre empresas.

Compilar o firmware e exportar o bundle Android não valida fiação, leitura física USB, fix do GPS nem acionamento de hardware. A conferência em bancada permanece necessária. O MQTT desta versão é local, sem TLS; o provisionador recusa `mqtts://` até existir suporte com certificados no firmware.
