# Firmware Arduino — TechCode Escavadeira

Firmware integrado para **ESP32 Dev Module**, construído com o framework Arduino e baseado na pinagem já testada.

Fluxo de cadastro por USB/RC522, identificação do operador, GPS e testes: [guia de teste local](../docs/teste-local-rfid-gps.md).

## Comunicação Bluetooth (padrão atual)

O modo padrão agora é BLE: ESP32 → celular Android → servidor, com fila offline no celular. Consulte [Bluetooth e Android offline](../docs/bluetooth-offline-android.md). Não exige senha de Wi-Fi no ESP32. Prepare o manifesto com `--ble`. O firmware já provisionado pode sobrescrever o padrão pelo macro `EMP_USE_BLE`.

## Instalação pelo painel (fluxo recomendado)

No Chrome ou Edge do computador, abra **Admin → Firmware**:

1. conecte a placa pela USB e use **Conectar e gravar** para instalar o firmware-base;
2. em **Admin → Dispositivos ESP32**, escolha ou cadastre a escavadeira e vincule um dispositivo a ela;
3. enquanto a credencial de uso único estiver na tela, use **Configurar pela USB** na mesma placa;
4. aguarde a confirmação e desconecte a placa do computador;
5. instale o módulo na escavadeira e alimente-o por uma fonte automotiva protegida de 12/24 V para 5 V — nunca ligue 12/24 V diretamente no ESP32;
6. em operação, o ESP32 conversa por Bluetooth com o Android. O computador não acompanha a máquina.

O painel serve apenas o binário-base genérico; o navegador grava a placa pela USB. A identidade de cada máquina é salva separadamente na memória do ESP32. Regravar pelo painel apaga a configuração anterior, então repita o provisionamento USB após qualquer nova gravação.

O RC522 ligado ao ESP32 também pode ser usado para cadastrar cartões no painel. Em **Cartões RFID**, escolha o ESP32 conectado ao computador, feche o Monitor Serial da Arduino IDE, clique em **Conectar leitor** e aproxime o cartão. O UID é capturado automaticamente; a digitação manual é apenas contingência.

## Comunicação Wi-Fi/MQTT (alternativa com EMP_USE_BLE=0)

As instruções abaixo descrevem o caminho alternativo Wi-Fi/MQTT. No modo BLE, use o guia acima e o APK instalado.

- `driver-app/services/api.js`: HTTP/REST com a API para autenticação e consultas.
- `driver-app/App.js`: Socket.IO para telemetria, status, alertas, RFID e mudanças de vínculo (`assignment:changed`).
- `backend/src/infrastructure/mqtt/mqtt.consumer.js`: recebe MQTT do ESP32.

Fluxo implementado:

```text
ESP32 --Wi-Fi/MQTT--> Mosquitto --> Backend --> Socket.IO --> Aplicativo
```

O SIM800L não faz parte desta versão. O relé permanece como stub, sem GPIO reservado.

## Estrutura

```text
TechCode_Escavadeira/
├── TechCode_Escavadeira.ino
└── src/
    ├── config/config.h
    ├── model/TelemetryState.h
    ├── gps/GpsService.h + .cpp
    ├── rfid/RfidService.h + .cpp
    ├── electrical/ElectricalService.h + .cpp
    ├── buzzer/BuzzerService.h + .cpp
    ├── relay/RelayService.h + .cpp
    ├── communication/AppCommunication.h + .cpp
    └── diagnostic/DiagnosticService.h + .cpp
```

GPS, RFID e buzzer são atualizados sem pausas longas no `loop()`. As tentativas de conexão Wi-Fi/MQTT são espaçadas; a conexão TCP do PubSubClient pode bloquear durante seu timeout.

## Bibliotecas

Instale pela Arduino IDE:

- `ArduinoJson` 7.x — Benoit Blanchon;
- `PubSubClient` 2.8+ — Nick O'Leary;
- `TinyGPSPlus` 1.0.3+ — Mikal Hart;
- `MFRC522` 1.4.12+ — GithubCommunity.

`WiFi` e `SPI` já vêm com `esp32 by Espressif Systems`.

## Pinagem final

| Componente | Ligação | ESP32 |
|---|---|---|
| NEO-6M | TX | GPIO16 / RX2 |
| NEO-6M | RX | não utilizado |
| MFRC522 | SS/SDA | GPIO5 |
| MFRC522 | RST | GPIO4 |
| MFRC522 | SCK | GPIO18 |
| MFRC522 | MISO | GPIO19 |
| MFRC522 | MOSI | GPIO23 |
| Divisor VCC <25 V | saída analógica | GPIO34 |
| ACS758 OUT1 | saída analógica | GPIO35 |
| Buzzer passivo | positivo | GPIO25 |
| Relé | indisponível | nenhum GPIO |

GPIO34 e GPIO35 são somente entrada, apropriados para os sensores. Nunca aplique tensão superior a 3,3 V em qualquer GPIO.

## Medições

- GPS inválido nunca acumula distância.
- Firmware 3.0.2: velocidade de até 3 km/h é tratada como zero para filtrar a oscilação com a máquina parada. Para sair de zero, são necessárias três leituras novas consecutivas de pelo menos 4 km/h; durante movimento confirmado, valores acima de 3 km/h continuam sendo exibidos. Uma leitura de até 3 km/h volta a zero.
- Sem posição válida ou com velocidade sem atualização por mais de cinco segundos, a velocidade é zerada e a confirmação de movimento reinicia. A faixa filtrada também não acumula distância. Deslocamentos reais muito lentos ficam ocultos por esse filtro; não é uma calibração física do receptor.
- Saltos de posição incompatíveis com tempo/velocidade são descartados.
- O divisor de tensão inicia com fator 5,0 e multiplicador de calibração 1,0.
- O ACS758 informa ADC bruto e tensão do OUT1.
- Zero inicial do ACS758: 0,39 V.
- Sensibilidade inicial: `0`; portanto `currentCalibrated=false` e amperagem não é publicada.

Somente depois de confirmar a variante do ACS758, defina `currentSensitivityMvA` no provisionamento.

## Provisionamento

No admin, vincule o ESP32 à máquina e baixe o JSON. Na pasta `firmware` execute:

```powershell
node tools/provision.mjs "C:\Downloads\DEV-ESC-001-provisioning.json" --ssid "MINHA_REDE" --wifi-password "MINHA_SENHA"
```

Isso cria `TechCode_Escavadeira/src/config/provisioned_config.h`, ignorado pelo Git.

Para não colocar a senha na linha de comando, preencha `network.local.json` com `wifiSsid` e `wifiPassword` e execute `node tools/provision.mjs arquivo-provisioning.json --network-file network.local.json`. O arquivo de rede também está ignorado pelo Git. A rede deve ser de 2,4 GHz e alcançar o computador que executa o MQTT.

O host MQTT precisa ser um IP/domínio alcançável pelo ESP32; `localhost` não funciona na placa.

## Compilar e gravar

Na Arduino IDE:

1. Abra `TechCode_Escavadeira.ino`.
2. Selecione `ESP32 Dev Module`.
3. Selecione a porta COM.
4. Mantenha a partição padrão; a build BLE ocupa aproximadamente 89% (a MQTT, 74%).
5. Clique em **Carregar**.
6. Abra o Monitor Serial em `115200 baud`.

Não cole todos os módulos numa única aba. Abra o `.ino` dentro da pasta `TechCode_Escavadeira` e mantenha `src` junto dele; a IDE compila seus arquivos `.cpp` automaticamente. Não abra `src/communication/AppCommunication.cpp` como sketch isolado. Para copiar para outro computador, leve a pasta `TechCode_Escavadeira` inteira; o cabeçalho `src/config/provisioned_config.h` contém a identidade secreta da placa e não deve ser compartilhado publicamente.

Na bancada atual o dispositivo é `DEV-ESC-001`, com Bluetooth e sem senha de Wi-Fi. Após gravar, procure `EMP-DEV-ESC-001` **dentro do app**. Se a gravação indicar porta ocupada, feche outros monitores seriais/plotters ligados à COM3. A gravação substitui o sketch de teste anterior; o relé continua desabilitado.

Compilação por linha de comando:

```powershell
arduino-cli compile --fqbn esp32:esp32:esp32 TechCode_Escavadeira
```

## Teste ESP32 → aplicativo

1. Inicie PostgreSQL, Redis, Mosquitto e a API.
2. Confirme que o dispositivo baixado do admin está vinculado à máquina do operador.
3. Grave o firmware provisionado e abra o Monitor Serial.
4. Verifique os logs `[APP] MQTT conectado` e `[APP] Telemetria MQTT enviada`.
5. Abra o app e entre com o operador vinculado.
6. Confira tensão, GPS, velocidade, satélites e status online.
7. Leve o GPS a céu aberto; a posição deve aparecer no mapa após o primeiro fix válido.
8. Aproxime um cartão RFID cadastrado. O log `[RFID] UID lido` aparece; aguarde `[RFID] Servidor: AUTHORIZED` e confira o motorista no app/admin. `CAPTURED` indica cadastro e `DENIED` indica cartão recusado.
9. No admin, envie `BEEP`. O servidor deve registrar `RECEIVED` e depois `EXECUTED` após os dois bips.
10. Desligue o ESP32 ou o Wi-Fi; o LWT/timeout deve mudar a máquina para offline.

O modo diagnóstico imprime a cada cinco segundos dados reais com os prefixos `[GPS]`, `[RFID]`, `[VOLTAGE]`, `[CURRENT]`, `[BUZZER]`, `[APP]` e `[SYSTEM]`.
