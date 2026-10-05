#pragma once
#include "Arduino.h"
#include <array>
class MFRC522 {
 public:
  enum PCD_Register { VersionReg, TxControlReg, TModeReg, TPrescalerReg, ModeReg };
  enum StatusCode { STATUS_OK, STATUS_COLLISION, STATUS_TIMEOUT, STATUS_ERROR };
  struct Uid { byte size = 4; byte uidByte[10] = {0x04, 0xAB, 0x00, 0x01}; } uid;
  inline static bool available = true, card = false, halted = false, selectFails = false;
  inline static int initCount = 0, wakeCount = 0;
  inline static std::array<byte, 5> registers = {0x92, 3, 0x80, 0xA9, 0x3D};
  MFRC522(int, int) {}
  void PCD_Init() {
    ++initCount;
    resetLevel = HIGH;
    clockMs += 50;
    halted = false;
    registers = {0x92, 3, 0x80, 0xA9, 0x3D};
  }
  byte PCD_ReadRegister(PCD_Register reg) { return available ? registers[reg] : 0xFF; }
  StatusCode PICC_WakeupA(byte*, byte*) {
    ++wakeCount;
    if (!available || !card) return STATUS_TIMEOUT;
    halted = false;
    return STATUS_OK;
  }
  bool PICC_ReadCardSerial() { return available && card && !halted && !selectFails; }
  void PICC_HaltA() { halted = true; }
  void PCD_StopCrypto1() {}
};
