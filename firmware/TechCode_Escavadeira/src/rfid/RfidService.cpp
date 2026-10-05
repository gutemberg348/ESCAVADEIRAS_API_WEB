#include "RfidService.h"
#include <SPI.h>
#include "../config/config.h"

RfidService::RfidService() : reader_(Config::RFID_SS_PIN, Config::RFID_RST_PIN) {}

void RfidService::begin() {
  SPI.begin(Config::RFID_SCK_PIN, Config::RFID_MISO_PIN, Config::RFID_MOSI_PIN, Config::RFID_SS_PIN);
  resetReader();
  Serial.printf("[RFID] Inicializando MFRC522: SS=%d RST=%d SCK=%d MISO=%d MOSI=%d\n",
    Config::RFID_SS_PIN, Config::RFID_RST_PIN, Config::RFID_SCK_PIN,
    Config::RFID_MISO_PIN, Config::RFID_MOSI_PIN);
}

void RfidService::resetReader() {
  // Reset only the RC522. BLE, GPS and pending packets keep their state.
  pinMode(Config::RFID_RST_PIN, OUTPUT);
  digitalWrite(Config::RFID_RST_PIN, LOW);
  resetAt_ = millis();
  resetting_ = true;
  ready_ = false;
}

void RfidService::rearm() {
  heldUid_ = "";
  if (!resetting_) resetReader();
  Serial.println("[RFID] Nova sessão Bluetooth: rearmando leitor");
}

bool RfidService::healthy() {
  const byte version = reader_.PCD_ReadRegister(MFRC522::VersionReg);
  // Do not restrict to a single chip revision: compatible RC522s vary.
  return version != 0x00 && version != 0xFF
    && (reader_.PCD_ReadRegister(MFRC522::TxControlReg) & 0x03) == 0x03
    && reader_.PCD_ReadRegister(MFRC522::TModeReg) == 0x80
    && reader_.PCD_ReadRegister(MFRC522::TPrescalerReg) == 0xA9
    && reader_.PCD_ReadRegister(MFRC522::ModeReg) == 0x3D;
}

bool RfidService::update(TelemetryState& state) {
  const uint32_t now = millis();
  if (state.rfidPresent && static_cast<int32_t>(now - presentUntil_) >= 0) {
    state.rfidPresent = false;
    state.rfidUid = "";
  }

  if (resetting_) {
    if (now - resetAt_ < 2) return false;
    // PCD_Init releases RST and waits for the oscillator (50 ms in MFRC522).
    reader_.PCD_Init();
    resetting_ = false;
    ready_ = healthy();
    lastHealthCheck_ = millis();
    Serial.println(ready_ ? "[RFID] Leitor pronto" : "[RFID] Leitor indisponível; recuperação automática pendente");
    return false;
  }
  if (now - lastHealthCheck_ >= (ready_ ? 1000UL : 2000UL)) {
    lastHealthCheck_ = now;
    if (!ready_ || !healthy()) {
      Serial.println("[RFID] Falha no leitor; reinicializando RC522");
      resetReader();
      return false;
    }
  }
  if (!ready_ || now - lastPoll_ < 75) return false;
  lastPoll_ = now;

  // WUPA also detects cards left in HALT by the previous read. REQA alone
  // ignores them until removal or reset, including across BLE reconnections.
  byte atqa[2];
  byte atqaSize = sizeof(atqa);
  const auto response = reader_.PICC_WakeupA(atqa, &atqaSize);
  if (response != MFRC522::STATUS_OK && response != MFRC522::STATUS_COLLISION) {
    if (response == MFRC522::STATUS_TIMEOUT && now - lastSeen_ >= 400) heldUid_ = "";
    return false;
  }
  if (!reader_.PICC_ReadCardSerial()) return false;

  String uid;
  for (byte index = 0; index < reader_.uid.size; index++) {
    if (reader_.uid.uidByte[index] < 0x10) uid += '0';
    uid += String(reader_.uid.uidByte[index], HEX);
  }
  uid.toUpperCase();
  reader_.PICC_HaltA();
  reader_.PCD_StopCrypto1();
  lastSeen_ = now;
  state.rfidPresent = true;
  state.rfidUid = uid;
  presentUntil_ = now + Config::RFID_PRESENT_MS;

  // One event per presentation; holding the card must not fill the BLE queue.
  if (uid == heldUid_) return false;
  heldUid_ = uid;
  Serial.printf("[RFID] UID lido: %s\n", uid.c_str());
  return true;
}
