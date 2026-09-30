#pragma once

#include <Arduino.h>
#include <TinyGPSPlus.h>
#include "../model/TelemetryState.h"

class GpsService {
 public:
  void begin();
  void update(TelemetryState& state);

 private:
  void updateDistance(TelemetryState& state);

  HardwareSerial serial_{2};
  TinyGPSPlus parser_;
  bool hasLastPosition_ = false;
  double lastLatitude_ = 0;
  double lastLongitude_ = 0;
  uint32_t lastPositionAt_ = 0;
};
