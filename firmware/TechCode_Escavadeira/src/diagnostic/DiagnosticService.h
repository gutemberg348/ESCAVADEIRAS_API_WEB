#pragma once

#include <Arduino.h>
#include "../model/TelemetryState.h"

class DiagnosticService {
 public:
  void begin();
  void update(const TelemetryState& state);

 private:
  uint32_t lastReportAt_ = 0;
  bool previousGpsValid_ = false;
  String previousConnection_;
};
