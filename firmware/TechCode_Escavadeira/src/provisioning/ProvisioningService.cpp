#include "ProvisioningService.h"
#include <ArduinoJson.h>
#include <Preferences.h>
#include <esp_system.h>
#include "../config/config.h"

ProvisioningService deviceIdentity;

void ProvisioningService::begin() {
  Preferences preferences;
  preferences.begin("emp-device", true);
  deviceCode_ = preferences.getString("code", EMP_DEVICE_CODE);
  deviceToken_ = preferences.getString("token", EMP_DEVICE_TOKEN);
  preferences.end();
  provisioned_ = deviceToken_.length() >= 32 && deviceToken_ != "development-unprovisioned-token";
  Serial.printf("[PROVISION] Estado: %s | Dispositivo: %s\n", provisioned_ ? "CONFIGURADO" : "AGUARDANDO", deviceCode_.c_str());
  Serial.println("[PROVISION] USB pronto para EMP_IDENTIFY ou EMP_PROVISION:{json}");
}

void ProvisioningService::update() {
  while (Serial.available()) {
    const char value = static_cast<char>(Serial.read());
    if (value == '\n' || value == '\r') {
      if (!serialBuffer_.isEmpty()) processLine(serialBuffer_);
      serialBuffer_ = "";
    } else if (serialBuffer_.length() < 768 && value >= 32) {
      serialBuffer_ += value;
    } else if (serialBuffer_.length() >= 768) {
      serialBuffer_ = "";
      Serial.println("EMP_PROVISION_ERROR:comando_muito_grande");
    }
  }
}

void ProvisioningService::processLine(const String& line) {
  if (line == "EMP_IDENTIFY") {
    JsonDocument response;
    response["type"] = "EMP_IDENTITY";
    response["deviceCode"] = deviceCode_;
    response["provisioned"] = provisioned_;
    response["firmware"] = Config::FIRMWARE_VERSION;
    response["chipId"] = String(static_cast<uint32_t>(ESP.getEfuseMac()), HEX);
    serializeJson(response, Serial);
    Serial.println();
    return;
  }
  if (!line.startsWith("EMP_PROVISION:")) return;
  JsonDocument document;
  if (deserializeJson(document, line.substring(14))) {
    Serial.println("EMP_PROVISION_ERROR:json_invalido");
    return;
  }
  const String code = document["code"] | "";
  const String token = document["token"] | "";
  if (code.length() < 3 || code.length() > 40 || token.length() < 32 || token.length() > 160) {
    Serial.println("EMP_PROVISION_ERROR:dados_invalidos");
    return;
  }
  for (size_t index = 0; index < code.length(); index++) {
    const char current = code[index];
    if (!isalnum(current) && current != '-' && current != '_') {
      Serial.println("EMP_PROVISION_ERROR:codigo_invalido");
      return;
    }
  }
  Preferences preferences;
  if (!preferences.begin("emp-device", false)) {
    Serial.println("EMP_PROVISION_ERROR:memoria_indisponivel");
    return;
  }
  const bool saved = preferences.putString("code", code) > 0 && preferences.putString("token", token) > 0;
  preferences.end();
  if (!saved) {
    Serial.println("EMP_PROVISION_ERROR:falha_ao_salvar");
    return;
  }
  Serial.printf("EMP_PROVISION_OK:%s\n", code.c_str());
  Serial.flush();
  delay(700);
  ESP.restart();
}
