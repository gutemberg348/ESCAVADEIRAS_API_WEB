#include "RelayService.h"

void RelayService::begin(TelemetryState& state) {
  state.relayAvailable = false;
  Serial.println("[SYSTEM] Relé indisponível: nenhum GPIO reservado e nenhum acionamento habilitado");
}

void RelayService::update(TelemetryState& state) {
  state.relayAvailable = false;
}
