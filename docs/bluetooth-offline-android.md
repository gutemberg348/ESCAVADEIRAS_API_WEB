# Coleta Bluetooth com Android

## Fluxo implementado

ESP32 (GPS/RC522/sensores) → BLE criptografado com pareamento → app Android → SQLite local → API HTTP → PostgreSQL/Socket.IO → painel web.

O ESP32 não precisa de Wi-Fi neste modo. O celular precisa alcançar o servidor somente no primeiro login/preparo e na sincronização. O nome anunciado é `EMP-DEV-ESC-001` para a placa de bancada. A identidade precisa ser provisionada; o token não é transmitido por Bluetooth. Cada pacote é assinado por HMAC-SHA256 e o backend verifica a assinatura usando uma credencial criptografada no banco. A chave de armazenamento deriva de `JWT_SECRET`: sua rotação exige migração das credenciais BLE ou novo provisionamento.

O pareamento BLE usa Secure Connections/Just Works (sem código exibido na placa). Há criptografia de enlace, mas não confirmação física por PIN nem proteção MITM por passkey. Só pareie em bancada/controlado. Comandos de relé continuam indisponíveis.

## Testar no aparelho

1. Instale o APK de teste no Android. Expo Go não carrega `react-native-ble-plx`.
2. Na primeira abertura, mantenha celular e computador na mesma rede. Entre com o operador ou administrador. O app salva a sessão no armazenamento seguro e o cadastro de dispositivos localmente.
3. Grave o firmware BLE provisionado no ESP32. Na configuração Arduino, `EMP_USE_BLE=1` seleciona Bluetooth; `0` mantém o modo Wi-Fi/MQTT anterior.
4. Ative Bluetooth e localização e, em **Máquina por Bluetooth**, escolha **Procurar ESP32**. Autorize dispositivos próximos e localização precisa e aceite o pareamento.
5. Selecione `EMP-DEV-ESC-001`. Confira tensão, GPS e UID lido no cartão. A leitura local é exibida antes da validação do servidor; isso não significa liberação da máquina.
6. Desligue somente a internet/Wi-Fi do celular, mantendo Bluetooth ativo e o app aberto. O contador de leituras locais deve crescer. Reative a conexão e confira o contador diminuir com a confirmação do servidor.
7. Para testar persistência, receba leituras offline, feche o app e abra novamente. A fila permanece, mas durante o fechamento nenhuma coleta contínua é garantida. Reconecte o Bluetooth e sincronize.

O APK local aponta para `http://192.168.0.3:3000/api/v1` e admite HTTP apenas para a bancada. Não alcança esse servidor pela rede móvel fora de casa. Para campo, é necessário publicar a API em HTTPS e recompilar com sua URL.

## Comportamento offline e limites

### RFID sem precisar apertar EN (firmware 3.0.1-ble)

O `HELLO` enviado pelo app ao conectar rearma o RC522 no loop principal, sem reiniciar o ESP32 ou apagar a fila BLE. O app prepara a recepção antes de enviar esse comando. O leitor verifica periodicamente a comunicação SPI, a antena e a configuração; se detectar falha, reinicializa somente o RC522 e tenta novamente a cada dois segundos enquanto estiver indisponível.

A leitura usa WUPA para reconhecer também um cartão que ficou em HALT após a leitura anterior. Manter o cartão encostado gera uma única apresentação; retirar por pelo menos 400 ms e aproximar novamente gera outra. Uma nova conexão pelo app também permite ler o cartão que permaneceu encostado. A autorização continua dependendo da resposta do servidor.

Teste em bancada após atualizar o firmware e o app:

1. Ligue o conjunto sem apertar EN, conecte pelo app e apresente o cartão cadastrado. Confira o bip e a identificação no app.
2. Mantenha o cartão no leitor por dez segundos: deve haver somente uma apresentação, sem bips contínuos.
3. Desconecte e reconecte pelo app com o cartão ainda encostado. Confira uma nova leitura e validação, sem EN.
4. Retire por um segundo e reapresente o mesmo cartão; repita também com outro cartão.
5. Deixe a placa ligada sem celular por alguns minutos e repita a conexão/leitura.
6. Se houver falha, confira no serial os registros `[RFID] Leitor pronto`, `[RFID] UID lido` ou `[RFID] Falha no leitor`. Ausência de UID indica problema na leitura; UID com validação pendente exige conferir BLE e acesso ao servidor.

O binário-base do painel precisa acompanhar esta versão. Gravar pelo painel apaga o provisionamento: configure novamente a identidade pela USB depois da gravação. Os testes simulados de recuperação estão em `firmware/tests`.

### Coleta e sincronização

- O app precisa ficar aberto/em primeiro plano durante a coleta. Este incremento não implementa serviço Android de coleta em segundo plano. Bloquear a tela, fechar o app ou o Android suspendê-lo pode interromper o BLE.
- Telemetria BLE a cada cinco segundos. O telefone grava em SQLite antes de confirmar o pacote ao ESP32.
- Fila persistente por usuário e URL de servidor. Limite de 100.000 registros; quando cheio, a coleta alerta e para de confirmar em vez de apagar histórico silenciosamente.
- Reenvio periódico enquanto o app está ativo. Confirmações HTTP removem apenas registros aceitos. Pacotes recusados ficam preservados e contados para revisão; **Sincronizar agora** tenta novamente.
- Sessão expirada precisa de novo login para enviar; o histórico permanece no celular. Sair não apaga a fila de outro usuário.
- O ESP32 tem um buffer RAM de 16 pacotes (quatro slots reservados para RFID). Não substitui um datalogger: falta de celular por longo tempo ou desligamento da placa pode perder leituras ainda não confirmadas.
- Pacotes persistidos no celular sobrevivem ao fechamento do app. O servidor deduplica por dispositivo e ID do evento.
- Não desinstale o app nem limpe seus dados antes de sincronizar: isso apaga a fila local. Atualize com a mesma assinatura e `adb install -r`; se houver conflito de assinatura, preserve a instalação e resolva antes de remover.
- A hora de coleta é estimada pelo relógio do celular menos a idade do pacote informada e assinada pela placa. Mantenha data/hora automática no Android.
- Leituras com mais de 30 segundos entram como histórico; não marcam a máquina online nem sobrescrevem a posição atual. Cartões antigos entram no histórico de auditoria, não alteram a identificação atual do operador.
- Para identificar um motorista ou capturar um cartão no admin, precisa haver servidor alcançável. Sem conexão, o cartão fica pendente/histórico e nunca é tratado como autorização.
- O modo BLE desta versão só coleta leituras: BEEP/REQUEST_STATUS remotos continuam disponíveis apenas no modo MQTT. Não há comandos de relé/partida/corte.
- Mapa-base não é offline. Sem chave Google Maps, o APK mostra coordenadas; o mapa OpenStreetMap está disponível no painel web.

## Build de bancada (Windows)

```powershell
cd driver-app
$env:EMP_LOCAL_TEST='1'
npx expo prebuild --platform android --no-install
$env:ANDROID_HOME='C:\Users\GUTOO\AppData\Local\Android\Sdk'
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot'
$env:EXPO_PUBLIC_API_URL='http://192.168.0.3:3000/api/v1'
$env:EXPO_PUBLIC_SOCKET_URL='http://192.168.0.3:3000'
$env:NODE_ENV='production'
cd android
.\gradlew.bat assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a
```

Saída: `driver-app/android/app/build/outputs/apk/release/app-release.apk`. Essa build usa a assinatura de desenvolvimento gerada pelo Expo, para teste local, não publicação na loja. Ela contém o bundle JavaScript e não depende do Metro.

Para instalar por USB: habilite depuração USB no Android, aceite a chave RSA do computador e use `adb install -r <arquivo.apk>`. O aparelho precisa aparecer como `device` em `adb devices`.

Sem cabo, após o build execute `node scripts/serve-android-apk.mjs` na raiz. No celular conectado ao mesmo Wi-Fi, abra `http://192.168.0.3:8082/Empimecatronic.apk` e permita a instalação desse APK de teste. Esse servidor expõe somente o APK (não as pastas do projeto). Encerre-o depois do download; não publique essa porta na internet. Se o firewall impedir o acesso, prefira copiar o APK por USB.

Firmware: `node firmware/tools/prepare-local-ble.mjs DEV-ESC-001` prepara apenas dispositivo ainda não provisionado. Para dispositivos existentes, use o manifesto do admin com `node firmware/tools/provision.mjs <manifesto.json> --ble`. Manifesto e cabeçalho contêm segredos e estão ignorados pelo Git.

Testes: `npm run test:integration --workspace=backend` verifica API/MQTT/BLE assinado, duplicações, manipulação de assinatura e histórico offline; `node --test driver-app/tests/ble-protocol.test.mjs` verifica fragmentação e recuperação de pacotes BLE. O teste de pareamento, sensores e operação física requer o aparelho e a placa.
