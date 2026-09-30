#include "AppCommunication.h"
#if !EMP_USE_BLE
#include <time.h>
#include <esp_system.h>
#include "../config/config.h"

AppCommunication* AppCommunication::instance_ = nullptr;

AppCommunication::AppCommunication() : mqtt_(networkClient_) {
  instance_ = this;
}

void AppCommunication::begin() {
  bootId_ = String(esp_random(), HEX) + String(esp_random(), HEX);
  snprintf(eventTopic_, sizeof(eventTopic_), "machines/%s/events", EMP_DEVICE_CODE);
  snprintf(rfidResultTopic_, sizeof(rfidResultTopic_), "machines/%s/rfid-result", EMP_DEVICE_CODE);
  snprintf(telemetryTopic_, sizeof(telemetryTopic_), "machines/%s/telemetry", EMP_DEVICE_CODE);
  snprintf(statusTopic_, sizeof(statusTopic_), "machines/%s/status", EMP_DEVICE_CODE);
  snprintf(commandTopic_, sizeof(commandTopic_), "machines/%s/commands", EMP_DEVICE_CODE);
  snprintf(ackTopic_, sizeof(ackTopic_), "machines/%s/ack", EMP_DEVICE_CODE);

  WiFi.mode(WIFI_STA);
  WiFi.setHostname(EMP_MQTT_CLIENT_ID);
  mqtt_.setServer(EMP_MQTT_HOST, EMP_MQTT_PORT);
  mqtt_.setCallback(mqttCallback);
  mqtt_.setBufferSize(2048);
  mqtt_.setKeepAlive(30);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  connectWifi();
  Serial.printf("[APP] Fluxo: ESP32 -> MQTT %s:%d -> API/Socket.IO -> aplicativo\n", EMP_MQTT_HOST, EMP_MQTT_PORT);
}

void AppCommunication::update(TelemetryState& state) {
  state.uptimeMs = millis();
  const uint32_t now = millis();
  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiAttempt_ >= Config::WIFI_RETRY_MS) connectWifi();
  } else if (!mqtt_.connected() && now - lastMqttAttempt_ >= Config::MQTT_RETRY_MS) {
    connectMqtt();
  }
  mqtt_.loop();
  updateConnectionState(state);
  publishPendingRfid();

  if (mqtt_.connected() && now - lastTelemetryAt_ >= Config::TELEMETRY_INTERVAL_MS) {
    publishTelemetry(state);
  }
  if (mqtt_.connected() && now - lastHeartbeatAt_ >= Config::HEARTBEAT_INTERVAL_MS) {
    publishHeartbeat(true);
  }
}

void AppCommunication::publishTelemetry(const TelemetryState& state, bool importantEvent) {
  if (!mqtt_.connected()) return;
  StaticJsonDocument<2048> document;
  document["authToken"] = EMP_DEVICE_TOKEN;
  document["deviceId"] = state.deviceId;
  const uint64_t timestamp = timestampMs();
  if (timestamp > 0) document["timestamp"] = timestamp;
  if (state.gpsValid) {
    document["latitude"] = state.latitude;
    document["longitude"] = state.longitude;
  }
  document["speed"] = state.speedKmh;
  document["voltage"] = state.voltage;
  document["signalStrength"] = state.signalStrength;
  document["gpsSatellites"] = state.satellites;
  if (state.currentCalibrated && !isnan(state.currentAmps)) document["current"] = state.currentAmps;

  JsonObject metadata = document["metadata"].to<JsonObject>();
  metadata["bootId"] = bootId_;
  metadata["uptimeMs"] = state.uptimeMs;
  metadata["gpsValid"] = state.gpsValid;
  metadata["distanceKm"] = state.distanceKm;
  metadata["voltageRawAdc"] = state.voltageRawAdc;
  metadata["voltageSensorVoltage"] = state.voltageSensorVoltage;
  metadata["currentRawAdc"] = state.currentRawAdc;
  metadata["currentSensorVoltage"] = state.currentSensorVoltage;
  metadata["currentCalibrated"] = state.currentCalibrated;
  if (state.currentCalibrated && !isnan(state.currentAmps)) metadata["currentAmps"] = state.currentAmps;
  else metadata["currentAmps"] = nullptr;
  metadata["rfidPresent"] = state.rfidPresent;
  metadata["rfidUid"] = state.rfidPresent ? state.rfidUid : "";
  metadata["buzzerState"] = state.buzzerState;
  metadata["relayAvailable"] = state.relayAvailable;
  metadata["connectionStatus"] = state.connectionStatus;
  metadata["importantEvent"] = importantEvent;
  metadata["firmware"] = Config::FIRMWARE_VERSION;
  metadata["framework"] = "arduino-esp32";

  char payload[2048];
  const size_t length = serializeJson(document, payload, sizeof(payload));
  if (length > 0 && mqtt_.publish(telemetryTopic_, payload, false)) {
    lastTelemetryAt_ = millis();
    Serial.printf("[APP] Telemetria MQTT enviada%s (%u bytes)\n",
      importantEvent ? " imediatamente" : "", static_cast<unsigned>(length));
  }
}

bool AppCommunication::hasCommand() const { return pendingCommand_.type != AppCommandType::NONE; }

AppCommand AppCommunication::takeCommand() {
  AppCommand command = pendingCommand_;
  pendingCommand_ = {};
  return command;
}

void AppCommunication::acknowledgeExecuted(const String& commandId, const char* message) {
  publishAck(commandId, "EXECUTED", message);
}

void AppCommunication::acknowledgeFailed(const String& commandId, const char* message) {
  publishAck(commandId, "FAILED", message);
}

void AppCommunication::mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (instance_) instance_->handleMqttMessage(topic, payload, length);
}

void AppCommunication::handleMqttMessage(const char* topic, const byte* payload, unsigned int length) {
  StaticJsonDocument<768> document;
  if (deserializeJson(document, payload, length)) {
    Serial.println("[APP] Comando MQTT inválido descartado");
    return;
  }
  if (strcmp(topic, rfidResultTopic_) == 0) {
    const String eventId = document["eventId"] | "";
    if (!pendingRfidEventId_.isEmpty() && eventId == pendingRfidEventId_) {
      const char* status = document["status"] | "";
      const char* driver = document["driver"]["name"] | "";
      Serial.printf("[RFID] Servidor: %s %s\n", status, driver);
      pendingRfidUid_ = "";
      pendingRfidEventId_ = "";
    }
    return;
  }
  const String commandId = document["commandId"] | "";
  const String type = document["type"] | "";
  if (commandId.isEmpty() || type.isEmpty()) return;

  publishAck(commandId, "RECEIVED");
  if (type == "REQUEST_STATUS") pendingCommand_ = {AppCommandType::REQUEST_STATUS, commandId};
  else if (type == "BEEP") pendingCommand_ = {AppCommandType::BEEP, commandId};
  else publishAck(commandId, "FAILED", "Comando não permitido pelo firmware");
}

void AppCommunication::connectWifi() {
  lastWifiAttempt_ = millis();
  if (String(EMP_WIFI_SSID) == "SUA_REDE_WIFI") {
    Serial.println("[APP] Wi-Fi não provisionado");
    return;
  }
  Serial.printf("[APP] Conectando ao Wi-Fi %s\n", EMP_WIFI_SSID);
  WiFi.disconnect(false, false);
  WiFi.begin(EMP_WIFI_SSID, EMP_WIFI_PASSWORD);
}

void AppCommunication::connectMqtt() {
  lastMqttAttempt_ = millis();
  StaticJsonDocument<384> willDocument;
  willDocument["authToken"] = EMP_DEVICE_TOKEN;
  willDocument["online"] = false;
  willDocument["firmware"] = Config::FIRMWARE_VERSION;
  char willPayload[384];
  serializeJson(willDocument, willPayload, sizeof(willPayload));

  const bool connected = mqtt_.connect(
    EMP_MQTT_CLIENT_ID, EMP_MQTT_USERNAME, EMP_MQTT_PASSWORD,
    statusTopic_, 1, true, willPayload
  );
  if (!connected) {
    Serial.printf("[APP] MQTT indisponível, código %d\n", mqtt_.state());
    return;
  }
  mqtt_.subscribe(commandTopic_, 1);
  mqtt_.subscribe(rfidResultTopic_, 1);
  publishHeartbeat(true);
  Serial.println("[APP] MQTT conectado; canal do aplicativo ativo via servidor");
}

void AppCommunication::publishHeartbeat(bool online) {
  if (!mqtt_.connected()) return;
  StaticJsonDocument<384> document;
  document["authToken"] = EMP_DEVICE_TOKEN;
  document["online"] = online;
  document["bootId"] = bootId_;
  document["firmware"] = Config::FIRMWARE_VERSION;
  document["signal"] = WiFi.RSSI();
  const uint64_t timestamp = timestampMs();
  if (timestamp > 0) document["timestamp"] = timestamp;
  char payload[384];
  serializeJson(document, payload, sizeof(payload));
  mqtt_.publish(statusTopic_, payload, true);
  lastHeartbeatAt_ = millis();
}

void AppCommunication::publishAck(const String& commandId, const char* status, const char* message) {
  if (!mqtt_.connected()) return;
  StaticJsonDocument<512> document;
  document["commandId"] = commandId;
  document["status"] = status;
  document["authToken"] = EMP_DEVICE_TOKEN;
  if (message) document["message"] = message;
  const uint64_t timestamp = timestampMs();
  if (timestamp > 0) document["timestamp"] = timestamp;
  char payload[512];
  serializeJson(document, payload, sizeof(payload));
  mqtt_.publish(ackTopic_, payload, false);
}

void AppCommunication::updateConnectionState(TelemetryState& state) {
  state.signalStrength = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : -120;
  if (WiFi.status() != WL_CONNECTED) state.connectionStatus = "WIFI_OFFLINE";
  else if (!mqtt_.connected()) state.connectionStatus = "SERVER_CONNECTING";
  else state.connectionStatus = "ONLINE";
}

uint64_t AppCommunication::timestampMs() const {
  const time_t now = time(nullptr);
  return now > 1700000000 ? static_cast<uint64_t>(now) * 1000ULL : 0;
}

bool AppCommunication::queueRfid(const String& uid) {
  if (!pendingRfidEventId_.isEmpty()) {
    Serial.println("[RFID] Aguarde a confirmação da leitura anterior e aproxime novamente");
    return false;
  }
  // Do not replay an old physical presentation after an offline period.
  if (!mqtt_.connected()) {
    Serial.println("[RFID] Sem servidor: aproxime novamente quando conectar");
    return false;
  }
  pendingRfidUid_ = uid;
  pendingRfidEventId_ = bootId_ + "-" + String(++rfidSequence_);
  rfidQueuedAt_ = millis();
  lastRfidAttempt_ = millis() - 2000;
  return true;
}

void AppCommunication::publishPendingRfid() {
  if (pendingRfidEventId_.isEmpty()) return;
  if (millis() - rfidQueuedAt_ > 15000) {
    Serial.println("[RFID] Sem confirmação do servidor: aproxime novamente");
    pendingRfidUid_ = "";
    pendingRfidEventId_ = "";
    return;
  }
  if (!mqtt_.connected() || millis() - lastRfidAttempt_ < 2000) return;
  lastRfidAttempt_ = millis();
  StaticJsonDocument<512> document;
  document["authToken"] = EMP_DEVICE_TOKEN;
  document["type"] = "RFID_SCAN";
  document["eventId"] = pendingRfidEventId_;
  document["bootId"] = bootId_;
  document["code"] = pendingRfidUid_;
  char payload[512];
  serializeJson(document, payload, sizeof(payload));
  mqtt_.publish(eventTopic_, payload, false);
}
#endif
