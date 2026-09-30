#include "DiagnosticService.h"
#include "../config/config.h"

void DiagnosticService::begin() {
  Serial.println("[SYSTEM] Modo diagnóstico ativo");
  Serial.println("[SYSTEM] Telemetria real; valores ausentes não serão inventados");
}

void DiagnosticService::update(const TelemetryState& state) {
  if (state.gpsValid != previousGpsValid_) {
    Serial.printf("[GPS] Estado alterado: %s\n", state.gpsValid ? "FIX VÁLIDO" : "SEM FIX");
    previousGpsValid_ = state.gpsValid;
  }
  if (state.connectionStatus != previousConnection_) {
    Serial.printf("[APP] Conexão: %s\n", state.connectionStatus.c_str());
    previousConnection_ = state.connectionStatus;
  }

  const uint32_t now = millis();
  if (now - lastReportAt_ < Config::DIAGNOSTIC_INTERVAL_MS) return;
  lastReportAt_ = now;

  if (state.gpsValid) {
    Serial.printf("[GPS] lat=%.6f lng=%.6f speed=%.2f km/h sat=%lu distância=%.3f km\n",
      state.latitude, state.longitude, state.speedKmh,
      static_cast<unsigned long>(state.satellites), state.distanceKm);
  } else {
    Serial.printf("[GPS] inválido sat=%lu speed=%.2f km/h distância=%.3f km\n",
      static_cast<unsigned long>(state.satellites), state.speedKmh, state.distanceKm);
  }
  Serial.printf("[VOLTAGE] raw=%u sensor=%.3f V equipamento=%.2f V\n",
    state.voltageRawAdc, state.voltageSensorVoltage, state.voltage);
  if (state.currentCalibrated) {
    Serial.printf("[CURRENT] raw=%u sensor=%.3f V corrente=%.2f A calibrada=sim\n",
      state.currentRawAdc, state.currentSensorVoltage, state.currentAmps);
  } else {
    Serial.printf("[CURRENT] raw=%u sensor=%.3f V zero=%.3f V corrente=N/D calibrada=não\n",
      state.currentRawAdc, state.currentSensorVoltage, Config::CURRENT_ZERO_VOLTAGE);
  }
  Serial.printf("[BUZZER] estado=%s\n", state.buzzerState.c_str());
  Serial.printf("[SYSTEM] uptime=%lu ms heap=%u bytes relé=%s\n",
    static_cast<unsigned long>(state.uptimeMs), ESP.getFreeHeap(),
    state.relayAvailable ? "disponível" : "indisponível");
}
