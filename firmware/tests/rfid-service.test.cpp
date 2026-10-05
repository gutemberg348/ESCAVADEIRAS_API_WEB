// Exercise the production RfidService with a simulated clock and RC522.
#include <cassert>
#include <iostream>
#include "../TechCode_Escavadeira/src/rfid/RfidService.h"

bool tick(RfidService& reader, TelemetryState& state, uint32_t elapsed = 75) {
  clockMs += elapsed;
  return reader.update(state);
}

int main() {
  TelemetryState state;
  RfidService reader;
  reader.begin();
  assert(resetLevel == LOW);
  assert(!reader.update(state));
  assert(MFRC522::initCount == 0);
  tick(reader, state, 2);
  assert(MFRC522::initCount == 1);

  // A card already HALTed must read, with leading zeros preserved.
  MFRC522::card = MFRC522::halted = true;
  assert(tick(reader, state));
  assert(state.rfidUid == "04AB0001");
  for (int i = 0; i < 100; ++i) assert(!tick(reader, state));
  assert(MFRC522::initCount == 1); // Holding a card neither resets nor floods.

  // A short RF dropout must not generate another presentation.
  MFRC522::card = false;
  assert(!tick(reader, state));
  MFRC522::card = true;
  assert(!tick(reader, state));

  // Removing and presenting the same card generates a fresh event.
  MFRC522::card = false;
  assert(!tick(reader, state, 500));
  MFRC522::card = true;
  assert(tick(reader, state));

  // HELLO/reconnection rearms even a card still sitting on the antenna.
  reader.rearm();
  assert(!tick(reader, state, 2));
  assert(tick(reader, state));
  assert(!tick(reader, state));

  // Antenna disabled after startup: recover without an ESP32 restart.
  const int beforeFault = MFRC522::initCount;
  MFRC522::registers[MFRC522::TxControlReg] = 0;
  assert(!tick(reader, state, 1000));
  assert(resetLevel == LOW);
  assert(!tick(reader, state, 2));
  assert(MFRC522::initCount == beforeFault + 1);
  assert(!tick(reader, state)); // Recovery alone does not reauthorize a held card.

  // Missing hardware retries at a bounded rate, then recovers when available.
  MFRC522::available = false;
  assert(!tick(reader, state, 1000));
  assert(!tick(reader, state, 2));
  const int failedInit = MFRC522::initCount;
  for (int i = 0; i < 10; ++i) assert(!tick(reader, state));
  assert(MFRC522::initCount == failedInit);
  MFRC522::available = true;
  assert(!tick(reader, state, 2000));
  assert(!tick(reader, state, 2));
  assert(MFRC522::initCount == failedInit + 1);
  MFRC522::card = false;
  tick(reader, state, 500);
  MFRC522::card = true;
  assert(tick(reader, state));

  // No card is normal, not a reason to restart the reader repeatedly.
  MFRC522::card = false;
  const int idleInit = MFRC522::initCount;
  for (int i = 0; i < 100; ++i) assert(!tick(reader, state, 100));
  assert(MFRC522::initCount == idleInit);
  assert(!state.rfidPresent && state.rfidUid.empty());

  // Timing remains valid when millis() wraps after ~49 days.
  clockMs = UINT32_MAX - 100;
  reader.rearm();
  tick(reader, state, 2);
  MFRC522::card = true;
  assert(tick(reader, state));
  assert(!tick(reader, state, 200));
  std::cout << "RFID recovery/presentation tests passed\n";
}
