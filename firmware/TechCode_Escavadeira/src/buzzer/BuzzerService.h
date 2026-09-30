#pragma once

#include <Arduino.h>
#include "../model/TelemetryState.h"

enum class BuzzerPattern { OFF, SHORT_BEEP, DOUBLE_BEEP, ALERT };

class BuzzerService {
 public:
  void begin();
  void update(TelemetryState& state);
  void shortBeep();
  void doubleBeep();
  void alert();
  void stop();
  bool active() const;

 private:
  void start(BuzzerPattern pattern);
  void setOutput(bool enabled);
  const char* name() const;

  BuzzerPattern pattern_ = BuzzerPattern::OFF;
  uint8_t phase_ = 0;
  uint32_t phaseStartedAt_ = 0;
};
