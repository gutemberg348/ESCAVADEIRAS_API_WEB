# Checklist de instalação em campo

Este checklist deve ser executado para cada escavadeira antes de liberar o equipamento.

## 1. Bancada

- Confirme o modelo: ESP32 Dev Module/WROOM, GPS NEO-6M, RFID MFRC522, divisor VCC <25 V, ACS758LCB e buzzer passivo.
- Alimente ESP32, MFRC522, GPS e sensores conforme o datasheet de cada módulo. Esta versão usa Wi-Fi e não integra o SIM800L.
- Use fusível, proteção contra inversão, TVS e conversor automotivo/industrial na alimentação vinda da máquina.
- Garanta que nenhuma entrada do ESP32 ultrapasse 3,3 V.
- Mantenha saída de corte/bloqueio fisicamente desconectada; este firmware não a aciona.

## 2. Servidor

- Em `backend/.env`, use em `MQTT_URL` o IP ou domínio alcançável pelo ESP32, nunca `localhost`.
- Em produção, configure `ALLOW_UNPROVISIONED_DEVICES=false` e use `mqtts://` com TLS.
- Execute migrations e confirme `/health` antes de provisionar.

## 3. Identidade e gravação

- Cadastre a máquina no painel.
- Vincule o dispositivo em **Dispositivos** e baixe o JSON uma única vez.
- Execute `node tools/provision.mjs arquivo.json` dentro de `firmware/`.
- Ajuste GPIOs e constantes em `TechCode_Escavadeira/src/config/config.h` e a calibração no provisionamento.
- Na Arduino IDE, selecione `ESP32 Dev Module`; a partição padrão é suficiente.
- Abra `TechCode_Escavadeira.ino`, selecione a porta COM e clique em **Carregar**.
- Apague `TechCode_Escavadeira/src/config/provisioned_config.h` da estação após gravar o lote.

## 4. Testes de aceitação

1. O serial deve mostrar rede e MQTT conectados.
2. O dispositivo deve aparecer online no painel em até 30 segundos.
3. A tensão exibida deve ser comparada com multímetro e a escala ajustada.
4. Confirme aproximadamente 0,39 V no OUT1 do ACS758 sem carga. Não libere amperagem até identificar a variante e calibrar a sensibilidade.
5. Ao ar livre, GPS deve informar coordenadas e satélites; confirme o ponto no mapa.
6. Um RFID cadastrado deve atualizar o operador da máquina.
7. Um RFID desconhecido deve criar alerta, sem autorizar operador.
8. O comando `BEEP` deve mudar de `PUBLISHED` para `RECEIVED` e `EXECUTED`.
9. Ao remover rede/alimentação, a máquina deve ficar offline após `OFFLINE_AFTER_SECONDS`.
10. Reinicie o conjunto três vezes e confirme reconexão automática.

Registre por equipamento: serial da placa, UID do RFID, versão do firmware, calibração, fotos da instalação, data e responsável técnico.
