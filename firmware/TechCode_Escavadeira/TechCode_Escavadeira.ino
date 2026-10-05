#include "src/config/config.h"
#include "src/model/TelemetryState.h"
#include "src/gps/GpsService.h"
#include "src/rfid/RfidService.h"
#include "src/electrical/ElectricalService.h"
#include "src/buzzer/BuzzerService.h"
#include "src/relay/RelayService.h"
#include "src/communication/AppCommunication.h"
#include "src/diagnostic/DiagnosticService.h"
#include "src/provisioning/ProvisioningService.h"

TelemetryState telemetry;
GpsService gps;
RfidService rfid;
ElectricalService electrical;
BuzzerService buzzer;
RelayService relay;
AppCommunication appCommunication;
DiagnosticService diagnostic;

String pendingBuzzerCommandId;

void setup() {
  Serial.begin(Config::SERIAL_BAUD);
  delay(250);
  Serial.println();
  deviceIdentity.begin();
  Serial.println("================================================");
  Serial.println(" EMPIMECATRONIC · GUTO TECHCODE");
  Serial.printf(" Firmware %s | Dispositivo %s\n", Config::FIRMWARE_VERSION, deviceIdentity.deviceCode().c_str());
  Serial.println(" Arduino ESP32 · Inicialização modular");
  Serial.println("================================================");

  gps.begin();
  rfid.begin();
  electrical.begin();
  buzzer.begin();
  relay.begin(telemetry);
  appCommunication.begin();
  diagnostic.begin();
  buzzer.shortBeep();
  Serial.println("[SYSTEM] Inicialização concluída");
}

void loop() {
  deviceIdentity.update();
  gps.update(telemetry);
  electrical.update(telemetry);
  relay.update(telemetry);
  if (appCommunication.takeRfidRearmRequest()) rfid.rearm();
  const bool rfidEvent = rfid.update(telemetry);
  buzzer.update(telemetry);
  appCommunication.update(telemetry);

  if (rfidEvent) {
    appCommunication.queueRfid(telemetry.rfidUid);
    appCommunication.publishTelemetry(telemetry, true);
    buzzer.doubleBeep();
  }

  if (appCommunication.hasCommand()) {
    const AppCommand command = appCommunication.takeCommand();
    if (command.type == AppCommandType::REQUEST_STATUS) {
      appCommunication.publishTelemetry(telemetry, true);
      appCommunication.acknowledgeExecuted(command.id, "Telemetria publicada");
    } else if (command.type == AppCommandType::BEEP) {
      pendingBuzzerCommandId = command.id;
      buzzer.doubleBeep();
    } else {
      appCommunication.acknowledgeFailed(command.id, "Comando não suportado");
    }
  }

  if (!pendingBuzzerCommandId.isEmpty() && !buzzer.active()) {
    appCommunication.acknowledgeExecuted(pendingBuzzerCommandId, "Dois bips concluídos");
    pendingBuzzerCommandId = "";
  }

  diagnostic.update(telemetry);
  delay(2);
}
