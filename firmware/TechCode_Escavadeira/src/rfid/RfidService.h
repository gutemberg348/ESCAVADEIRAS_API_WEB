#pragma once

#include <Arduino.h>
#include <MFRC522.h>
#include "../model/TelemetryState.h"

class RfidService {
 public:
  RfidService();
  void begin();
  bool update(TelemetryState& state);

 private:
  MFRC522 reader_;
  uint32_t presentUntil_ = 0;
};
