# API Empimecatrônic

API REST versionada em `/api/v1`, com telemetria recebida diretamente por MQTT. Execute `npm run dev` após criar o banco com os comandos no README principal.

Os dispositivos publicam em `machines/{deviceCode}/telemetry` e `machines/{deviceCode}/status`. O consumidor valida cada payload antes de persistir e encaminha atualizações autorizadas pelas salas Socket.IO `machine:{machineId}`.
