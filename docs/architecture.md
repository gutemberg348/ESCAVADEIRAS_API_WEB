# Arquitetura Empimecatrônic IoT

```text
GPS / RFID / sensores -> ESP32 -> Mosquitto -> MQTT consumer
                                                |-> PostgreSQL (histórico)
                                                |-> Redis (estado atual)
                                                |-> Socket.IO -> Admin / App
```

O banco é multiempresa: toda máquina pertence a uma `Company`. `SUPER_ADMIN` atravessa empresas, `COMPANY_ADMIN` só acessa sua empresa e `DRIVER` só acessa a máquina vinculada ao seu perfil. A mesma restrição é aplicada às salas Socket.IO.

## Identidade e vínculo

O painel cria `empresa -> máquina -> dispositivo` e entrega uma credencial aleatória individual, exibida apenas uma vez. O hash fica no PostgreSQL e todo payload MQTT provisionado precisa trazer o token do dispositivo. O pacote baixado alimenta `firmware/tools/provision.mjs`, que gera a configuração privada usada na gravação do ESP32.

Em desenvolvimento, `ALLOW_UNPROVISIONED_DEVICES=true` mantém os dispositivos antigos e o simulador funcionando. Em produção essa opção deve ser `false`, o broker deve usar TLS e o usuário/senha individual do manifesto precisa ser cadastrado no provedor MQTT.

## Telemetria, mapa e disponibilidade

Coordenadas válidas atualizam `MachineCurrentState`, PostgreSQL, Redis e Socket.IO. O painel usa Leaflet/OpenStreetMap para posicionar a frota nas coordenadas recebidas. Um monitor compara `lastSeenAt` com `OFFLINE_AFTER_SECONDS`, altera a máquina para `OFFLINE` e transmite a mudança em tempo real.

## Comandos

O backend permite `REQUEST_STATUS` e `BEEP`. O ESP32 confirma cada transição em `machines/{deviceCode}/ack`; o servidor só marca execução depois do ACK. Ações físicas críticas permanecem bloqueadas até haver validação elétrica e intertravamentos da máquina.
