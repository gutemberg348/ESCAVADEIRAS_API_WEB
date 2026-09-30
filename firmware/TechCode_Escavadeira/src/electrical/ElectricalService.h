#pragma once

#include <Arduino.h>
#include "../model/TelemetryState.h"

class ElectricalService {
 public:
  void begin();
  void update(TelemetryState& state);

 private:
  struct AdcReading { uint16_t raw; float volts; };
  AdcReading readAveraged(int pin) const;
  uint32_t lastReadAt_ = 0;
};
