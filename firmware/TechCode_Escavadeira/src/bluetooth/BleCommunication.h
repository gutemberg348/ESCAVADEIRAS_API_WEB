#pragma once
#include "../config/config.h"
#if EMP_USE_BLE
#include <Arduino.h>
#include <ArduinoJson.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include "../model/TelemetryState.h"

enum class AppCommandType { NONE, REQUEST_STATUS, BEEP };
struct AppCommand { AppCommandType type = AppCommandType::NONE; String id; };

class AppCommunication : public BLEServerCallbacks, public BLECharacteristicCallbacks {
 public:
  void begin();
  void update(TelemetryState& state);
  void publishTelemetry(const TelemetryState& state, bool importantEvent = false);
  bool queueRfid(const String& uid);
  bool takeRfidRearmRequest();
  bool hasCommand() const { return false; }
  AppCommand takeCommand() { return {}; }
  void acknowledgeExecuted(const String&, const char*) {}
  void acknowledgeFailed(const String&, const char*) {}
  void onConnect(BLEServer*) override;
  void onDisconnect(BLEServer*) override;
  void onWrite(BLECharacteristic* characteristic) override;
 private:
  struct Packet { String raw; String id; uint32_t queuedAt = 0; };
  bool enqueue(const char* kind, JsonDocument& data);
  BLECharacteristic* tx_ = nullptr;
  BLE2902* subscription_ = nullptr;
  volatile bool connected_ = false;
  volatile bool advertise_ = false;
  portMUX_TYPE mux_ = portMUX_INITIALIZER_UNLOCKED;
  char ack_[96]{};
  bool rearmRfid_ = false;
  Packet queue_[16];
  uint8_t head_ = 0, count_ = 0;
  String bootId_;
  uint32_t sequence_ = 0, lastSample_ = 0, lastChunk_ = 0, retryAt_ = 0;
  String wire_;
  size_t offset_ = 0;
};
#endif
