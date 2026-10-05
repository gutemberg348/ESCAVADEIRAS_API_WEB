#pragma once

#include <Arduino.h>
#include <MFRC522.h>
#include "../model/TelemetryState.h"

class RfidService {
 public:
  RfidService();
  void begin();
  void rearm();
  bool update(TelemetryState& state);

 private:
  void resetReader();
  bool healthy();
  MFRC522 reader_;
  uint32_t presentUntil_ = 0;
  uint32_t lastPoll_ = 0, lastHealthCheck_ = 0, resetAt_ = 0, lastSeen_ = 0;
  bool resetting_ = false, ready_ = false;
  String heldUid_;
};
