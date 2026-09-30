#include "ElectricalService.h"
#include <math.h>
#include "../config/config.h"

void ElectricalService::begin() {
  analogReadResolution(12);
  analogSetPinAttenuation(Config::VOLTAGE_ADC_PIN, ADC_11db);
  analogSetPinAttenuation(Config::CURRENT_ADC_PIN, ADC_11db);
  Serial.printf("[VOLTAGE] Entrada GPIO%d, fator nominal %.3f, calibração %.3f\n",
    Config::VOLTAGE_ADC_PIN, Config::VOLTAGE_DIVIDER_FACTOR, Config::VOLTAGE_CALIBRATION);
  Serial.printf("[CURRENT] Entrada GPIO%d, zero inicial %.3f V, amperagem NÃO calibrada\n",
    Config::CURRENT_ADC_PIN, Config::CURRENT_ZERO_VOLTAGE);
}

void ElectricalService::update(TelemetryState& state) {
  const uint32_t now = millis();
  if (now - lastReadAt_ < 250) return;
  lastReadAt_ = now;

  const AdcReading voltage = readAveraged(Config::VOLTAGE_ADC_PIN);
  state.voltageRawAdc = voltage.raw;
  state.voltageSensorVoltage = voltage.volts;
  state.voltage = voltage.volts * Config::VOLTAGE_DIVIDER_FACTOR * Config::VOLTAGE_CALIBRATION;

  const AdcReading current = readAveraged(Config::CURRENT_ADC_PIN);
  state.currentRawAdc = current.raw;
  state.currentSensorVoltage = current.volts;
  state.currentCalibrated = Config::CURRENT_SENSITIVITY_VOLTS_PER_AMP > 0;
  state.currentAmps = state.currentCalibrated
    ? (current.volts - Config::CURRENT_ZERO_VOLTAGE) / Config::CURRENT_SENSITIVITY_VOLTS_PER_AMP
    : NAN;
}

ElectricalService::AdcReading ElectricalService::readAveraged(int pin) const {
  uint32_t rawTotal = 0;
  uint32_t milliVoltTotal = 0;
  for (uint8_t sample = 0; sample < Config::ADC_SAMPLES; sample++) {
    rawTotal += analogRead(pin);
    milliVoltTotal += analogReadMilliVolts(pin);
  }
  return {
    static_cast<uint16_t>(rawTotal / Config::ADC_SAMPLES),
    (milliVoltTotal / static_cast<float>(Config::ADC_SAMPLES)) / 1000.0F
  };
}
