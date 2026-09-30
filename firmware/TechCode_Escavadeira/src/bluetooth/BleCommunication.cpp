#include "BleCommunication.h"
#if EMP_USE_BLE
#include <esp_system.h>
#include <mbedtls/md.h>

static const char* SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
static const char* BLE_RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
static const char* BLE_TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

void AppCommunication::begin() {
  bootId_ = String(esp_random(), HEX) + String(esp_random(), HEX);
  BLEDevice::init(String("EMP-") + EMP_DEVICE_CODE);
  BLEDevice::setMTU(185);
  BLESecurity::setEncryptionLevel(ESP_BLE_SEC_ENCRYPT);
  BLESecurity* security = new BLESecurity();
  security->setAuthenticationMode(ESP_LE_AUTH_REQ_SC_BOND);
  security->setCapability(ESP_IO_CAP_NONE);
  security->setInitEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);
  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(this);
  BLEService* service = server->createService(SERVICE);
  tx_ = service->createCharacteristic(BLE_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  subscription_ = new BLE2902();
  subscription_->setAccessPermissions(ESP_GATT_PERM_READ_ENCRYPTED | ESP_GATT_PERM_WRITE_ENCRYPTED);
  tx_->addDescriptor(subscription_);
  BLECharacteristic* rx = service->createCharacteristic(BLE_RX_UUID, BLECharacteristic::PROPERTY_WRITE);
  rx->setAccessPermissions(ESP_GATT_PERM_WRITE_ENCRYPTED);
  rx->setCallbacks(this);
  service->start();
  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE);
  advertising->setScanResponse(true);
  advertising->start();
  Serial.printf("[BLE] EMP-%s pronto. Pareie pelo app Android. Wi-Fi dispensado.\n", EMP_DEVICE_CODE);
  if (String(EMP_DEVICE_TOKEN) == "development-unprovisioned-token") Serial.println("[BLE] PROVISIONE a credencial antes de sincronizar com o servidor");
}

void AppCommunication::onConnect(BLEServer*) { connected_ = true; }
void AppCommunication::onDisconnect(BLEServer*) { connected_ = false; advertise_ = true; }
void AppCommunication::onWrite(BLECharacteristic* characteristic) {
  const String value = characteristic->getValue();
  if (!value.startsWith("ACK:") || value.length() > 94) return;
  portENTER_CRITICAL(&mux_);
  strlcpy(ack_, value.c_str() + 4, sizeof(ack_));
  portEXIT_CRITICAL(&mux_);
}

bool AppCommunication::enqueue(const char* kind, JsonDocument& data) {
  if (count_ >= 16) { Serial.println("[BLE] Buffer cheio; mantenha o app conectado para coletar"); return false; }
  JsonDocument frame;
  frame["v"] = 1;
  frame["deviceCode"] = EMP_DEVICE_CODE;
  const String id = bootId_ + "-" + String(++sequence_);
  frame["eventId"] = id;
  frame["bootId"] = bootId_;
  frame["kind"] = kind;
  frame["data"] = data.as<JsonObject>();
  Packet& packet = queue_[(head_ + count_) % 16];
  packet.raw = "";
  serializeJson(frame, packet.raw);
  packet.id = id; packet.queuedAt = millis(); count_++;
  return true;
}

void AppCommunication::publishTelemetry(const TelemetryState& state, bool) {
  // Reserve four slots for card presentations; no continuous logging without a phone.
  if (!connected_ || count_ >= 12) return;
  JsonDocument data;
  if (state.gpsValid) { data["latitude"] = state.latitude; data["longitude"] = state.longitude; }
  data["speed"] = state.speedKmh;
  data["voltage"] = state.voltage;
  data["gpsSatellites"] = state.satellites;
  if (state.currentCalibrated && !isnan(state.currentAmps)) data["current"] = state.currentAmps;
  JsonObject meta = data["metadata"].to<JsonObject>();
  meta["gpsValid"] = state.gpsValid;
  meta["currentCalibrated"] = state.currentCalibrated;
  meta["currentSensorVoltage"] = state.currentSensorVoltage;
  meta["voltageSensorVoltage"] = state.voltageSensorVoltage;
  meta["uptimeMs"] = millis();
  meta["relayAvailable"] = false;
  meta["transport"] = "BLE";
  enqueue("telemetry", data);
  lastSample_ = millis();
}

bool AppCommunication::queueRfid(const String& uid) {
  JsonDocument data; data["code"] = uid;
  const bool queued = enqueue("rfid", data);
  Serial.println(queued ? "[RFID] Leitura aguardando gravação no celular; não é autorização" : "[RFID] Buffer cheio: aproxime novamente após conectar");
  return queued;
}

void AppCommunication::update(TelemetryState& state) {
  state.uptimeMs = millis();
  state.connectionStatus = connected_ ? "BLE_PHONE_CONNECTED" : "BLE_WAITING_PHONE";
  state.signalStrength = -120;
  if (advertise_) { advertise_ = false; wire_ = ""; offset_ = 0; BLEDevice::startAdvertising(); }
  char ack[96]{};
  portENTER_CRITICAL(&mux_);
  strlcpy(ack, ack_, sizeof(ack)); ack_[0] = 0;
  portEXIT_CRITICAL(&mux_);
  if (count_ && queue_[head_].id == ack) {
    queue_[head_].raw = ""; queue_[head_].id = ""; head_ = (head_ + 1) % 16; count_--;
    wire_ = ""; offset_ = 0; retryAt_ = 0;
  }
  if (millis() - lastSample_ >= 5000) publishTelemetry(state);
  if (!connected_ || !subscription_->getNotifications() || !count_) return;
  if (wire_.isEmpty()) {
    if (retryAt_ && millis() - retryAt_ < 3000) return;
    JsonDocument frame; deserializeJson(frame, queue_[head_].raw);
    frame["ageMs"] = static_cast<uint32_t>(millis() - queue_[head_].queuedAt);
    String raw; serializeJson(frame, raw);
    unsigned char digest[32];
    mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), reinterpret_cast<const unsigned char*>(EMP_DEVICE_TOKEN), strlen(EMP_DEVICE_TOKEN), reinterpret_cast<const unsigned char*>(raw.c_str()), raw.length(), digest);
    char signature[65]; for (int i = 0; i < 32; i++) snprintf(signature + i * 2, 3, "%02x", digest[i]);
    JsonDocument envelope; envelope["raw"] = raw; envelope["signature"] = signature;
    wire_ = "\n"; serializeJson(envelope, wire_); wire_ += '\n'; offset_ = 0;
  }
  // 20-byte chunks work with the minimum ATT MTU, including after reconnect.
  if (millis() - lastChunk_ < 15) return;
  lastChunk_ = millis();
  const size_t length = min(static_cast<size_t>(20), wire_.length() - offset_);
  tx_->setValue(reinterpret_cast<uint8_t*>(const_cast<char*>(wire_.c_str() + offset_)), length);
  tx_->notify(); offset_ += length;
  if (offset_ >= wire_.length()) { wire_ = ""; offset_ = 0; retryAt_ = millis(); }
}
#endif
