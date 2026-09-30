#pragma once

#include <Arduino.h>
#include "../model/TelemetryState.h"

class RelayService {
 public:
  void begin(TelemetryState& state);
  void update(TelemetryState& state);
};
