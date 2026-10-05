#pragma once

#include <Arduino.h>

// O provisionador do painel gera este arquivo por equipamento.
#if __has_include("provisioned_config.h")
#include "provisioned_config.h"
#endif

#ifndef EMP_USE_BLE
#define EMP_USE_BLE 1
#endif

#ifndef EMP_VOLTAGE_SCALE
#define EMP_VOLTAGE_SCALE 5.0F
#endif
#ifndef EMP_CURRENT_ZERO_MV
#define EMP_CURRENT_ZERO_MV 390.0F
#endif
#ifndef EMP_CURRENT_SENSITIVITY_MVA
#define EMP_CURRENT_SENSITIVITY_MVA 0.0F
#endif
#ifndef EMP_TELEMETRY_INTERVAL_MS
#define EMP_TELEMETRY_INTERVAL_MS 1000UL
#endif
#ifndef EMP_HEARTBEAT_INTERVAL_MS
#define EMP_HEARTBEAT_INTERVAL_MS 30000UL
#endif

namespace Config {
constexpr uint32_t SERIAL_BAUD = 115200;
constexpr char FIRMWARE_VERSION[] = "3.0.1-ble";

// GPS NEO-6M: somente o TX do GPS é utilizado, conectado ao RX2 do ESP32.
constexpr int GPS_RX_PIN = 16;
constexpr int GPS_TX_UNUSED = -1;
constexpr uint32_t GPS_BAUD = 9600;
constexpr float GPS_STOP_SPEED_KMH = 1.0F;
constexpr uint32_t GPS_MAX_AGE_MS = 5000;

// MFRC522 (SPI).
constexpr int RFID_SS_PIN = 5;
constexpr int RFID_RST_PIN = 4;
constexpr int RFID_SCK_PIN = 18;
constexpr int RFID_MISO_PIN = 19;
constexpr int RFID_MOSI_PIN = 23;
constexpr uint32_t RFID_PRESENT_MS = 1500;

// Entradas analógicas. A calibração deve ser confirmada com instrumentos.
constexpr int VOLTAGE_ADC_PIN = 34;
constexpr int CURRENT_ADC_PIN = 35;
constexpr uint8_t ADC_SAMPLES = 32;
constexpr float VOLTAGE_DIVIDER_FACTOR = EMP_VOLTAGE_SCALE;
constexpr float VOLTAGE_CALIBRATION = 1.0F;
constexpr float CURRENT_ZERO_VOLTAGE = EMP_CURRENT_ZERO_MV / 1000.0F;
// Deixe zero enquanto a variante/sensibilidade do ACS758 não for confirmada.
constexpr float CURRENT_SENSITIVITY_VOLTS_PER_AMP = EMP_CURRENT_SENSITIVITY_MVA / 1000.0F;

constexpr int BUZZER_PIN = 25;
constexpr uint16_t BUZZER_FREQUENCY_HZ = 2200;

constexpr uint32_t TELEMETRY_INTERVAL_MS = EMP_TELEMETRY_INTERVAL_MS;
constexpr uint32_t HEARTBEAT_INTERVAL_MS = EMP_HEARTBEAT_INTERVAL_MS;
constexpr uint32_t DIAGNOSTIC_INTERVAL_MS = 5000;
constexpr uint32_t WIFI_RETRY_MS = 15000;
constexpr uint32_t MQTT_RETRY_MS = 5000;
}

#ifndef EMP_DEVICE_CODE
#define EMP_DEVICE_CODE "DEV-ESC-001"
#endif
#ifndef EMP_DEVICE_TOKEN
#define EMP_DEVICE_TOKEN "development-unprovisioned-token"
#endif
#ifndef EMP_MQTT_CLIENT_ID
#define EMP_MQTT_CLIENT_ID "empimecatronic-dev-esc-001"
#endif
#ifndef EMP_MQTT_USERNAME
#define EMP_MQTT_USERNAME EMP_DEVICE_CODE
#endif
#ifndef EMP_MQTT_PASSWORD
#define EMP_MQTT_PASSWORD EMP_DEVICE_TOKEN
#endif
#ifndef EMP_MQTT_HOST
#define EMP_MQTT_HOST "192.168.0.3"
#endif
#ifndef EMP_MQTT_PORT
#define EMP_MQTT_PORT 1883
#endif
#ifndef EMP_WIFI_SSID
#define EMP_WIFI_SSID "SUA_REDE_WIFI"
#endif
#ifndef EMP_WIFI_PASSWORD
#define EMP_WIFI_PASSWORD "SUA_SENHA_WIFI"
#endif
