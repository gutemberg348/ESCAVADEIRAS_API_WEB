#include "BuzzerService.h"
#include "../config/config.h"

void BuzzerService::begin() {
  pinMode(Config::BUZZER_PIN, OUTPUT);
  noTone(Config::BUZZER_PIN);
  Serial.printf("[BUZZER] Buzzer passivo no GPIO%d, controle não bloqueante\n", Config::BUZZER_PIN);
}

void BuzzerService::shortBeep() { start(BuzzerPattern::SHORT_BEEP); }
void BuzzerService::doubleBeep() { start(BuzzerPattern::DOUBLE_BEEP); }
void BuzzerService::alert() { start(BuzzerPattern::ALERT); }
bool BuzzerService::active() const { return pattern_ != BuzzerPattern::OFF; }

void BuzzerService::stop() {
  pattern_ = BuzzerPattern::OFF;
  phase_ = 0;
  setOutput(false);
  Serial.println("[BUZZER] Desligado");
}

void BuzzerService::start(BuzzerPattern pattern) {
  pattern_ = pattern;
  phase_ = 0;
  phaseStartedAt_ = millis();
  setOutput(true);
  Serial.printf("[BUZZER] Padrão iniciado: %s\n", name());
}

void BuzzerService::update(TelemetryState& state) {
  const uint32_t elapsed = millis() - phaseStartedAt_;
  if (pattern_ == BuzzerPattern::SHORT_BEEP && elapsed >= 120) stop();
  else if (pattern_ == BuzzerPattern::DOUBLE_BEEP) {
    if (phase_ == 0 && elapsed >= 100) { setOutput(false); phase_ = 1; phaseStartedAt_ = millis(); }
    else if (phase_ == 1 && elapsed >= 100) { setOutput(true); phase_ = 2; phaseStartedAt_ = millis(); }
    else if (phase_ == 2 && elapsed >= 100) stop();
  } else if (pattern_ == BuzzerPattern::ALERT) {
    if (elapsed >= 250) { phase_++; phaseStartedAt_ = millis(); setOutput((phase_ % 2) == 0); }
    if (phase_ >= 7) stop();
  }
  state.buzzerState = name();
}

void BuzzerService::setOutput(bool enabled) {
  if (enabled) tone(Config::BUZZER_PIN, Config::BUZZER_FREQUENCY_HZ);
  else noTone(Config::BUZZER_PIN);
}

const char* BuzzerService::name() const {
  switch (pattern_) {
    case BuzzerPattern::SHORT_BEEP: return "SHORT_BEEP";
    case BuzzerPattern::DOUBLE_BEEP: return "DOUBLE_BEEP";
    case BuzzerPattern::ALERT: return "ALERT";
    default: return "OFF";
  }
}
