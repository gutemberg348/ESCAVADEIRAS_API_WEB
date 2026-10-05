#pragma once
#include "../config/config.h"
#if EMP_USE_BLE
#include "../bluetooth/BleCommunication.h"
#else

#include <Arduino.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include "../model/TelemetryState.h"

enum class AppCommandType { NONE, REQUEST_STATUS, BEEP };

struct AppCommand {
  AppCommandType type = AppCommandType::NONE;
  String id;
};

class AppCommunication {
 public:
  AppCommunication();
  void begin();
  void update(TelemetryState& state);
  void publishTelemetry(const TelemetryState& state, bool importantEvent = false);
  bool queueRfid(const String& uid);
  bool takeRfidRearmRequest() { return false; }
  bool hasCommand() const;
  AppCommand takeCommand();
  void acknowledgeExecuted(const String& commandId, const char* message);
  void acknowledgeFailed(const String& commandId, const char* message);

 private:
  static AppCommunication* instance_;
  static void mqttCallback(char* topic, byte* payload, unsigned int length);
  void handleMqttMessage(const char* topic, const byte* payload, unsigned int length);
  void publishPendingRfid();
  void connectWifi();
  void connectMqtt();
  void publishHeartbeat(bool online);
  void publishAck(const String& commandId, const char* status, const char* message = nullptr);
  void updateConnectionState(TelemetryState& state);
  uint64_t timestampMs() const;

  WiFiClient networkClient_;
  PubSubClient mqtt_;
  AppCommand pendingCommand_;
  uint32_t lastWifiAttempt_ = 0;
  uint32_t lastMqttAttempt_ = 0;
  uint32_t lastTelemetryAt_ = 0;
  uint32_t lastHeartbeatAt_ = 0;
  char telemetryTopic_[96]{};
  char statusTopic_[96]{};
  char commandTopic_[96]{};
  char ackTopic_[96]{};
  char eventTopic_[96]{};
  char rfidResultTopic_[96]{};
  String bootId_;
  String pendingRfidUid_;
  String pendingRfidEventId_;
  uint32_t rfidSequence_ = 0;
  uint32_t rfidQueuedAt_ = 0;
  uint32_t lastRfidAttempt_ = 0;
};
#endif
