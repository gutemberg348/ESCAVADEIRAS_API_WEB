#include "RfidService.h"
#include <SPI.h>
#include "../config/config.h"

RfidService::RfidService() : reader_(Config::RFID_SS_PIN, Config::RFID_RST_PIN) {}

void RfidService::begin() {
  SPI.begin(Config::RFID_SCK_PIN, Config::RFID_MISO_PIN, Config::RFID_MOSI_PIN, Config::RFID_SS_PIN);
  reader_.PCD_Init();
  Serial.printf("[RFID] MFRC522 iniciado: SS=%d RST=%d SCK=%d MISO=%d MOSI=%d\n",
    Config::RFID_SS_PIN, Config::RFID_RST_PIN, Config::RFID_SCK_PIN,
    Config::RFID_MISO_PIN, Config::RFID_MOSI_PIN);
}

bool RfidService::update(TelemetryState& state) {
  const uint32_t now = millis();
  if (state.rfidPresent && static_cast<int32_t>(now - presentUntil_) >= 0) {
    state.rfidPresent = false;
    state.rfidUid = "";
  }

  if (!reader_.PICC_IsNewCardPresent() || !reader_.PICC_ReadCardSerial()) return false;

  String uid;
  for (byte index = 0; index < reader_.uid.size; index++) {
    if (reader_.uid.uidByte[index] < 0x10) uid += '0';
    uid += String(reader_.uid.uidByte[index], HEX);
  }
  uid.toUpperCase();
  state.rfidPresent = true;
  state.rfidUid = uid;
  presentUntil_ = now + Config::RFID_PRESENT_MS;

  reader_.PICC_HaltA();
  reader_.PCD_StopCrypto1();
  Serial.printf("[RFID] UID lido: %s\n", uid.c_str());
  return true;
}
