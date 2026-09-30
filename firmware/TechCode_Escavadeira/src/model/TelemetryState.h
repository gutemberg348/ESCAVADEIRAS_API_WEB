#pragma once

#include <Arduino.h>
#include <math.h>
#include "../config/config.h"

struct TelemetryState {
  String deviceId = EMP_DEVICE_CODE;
  uint32_t uptimeMs = 0;

  bool gpsValid = false;
  double latitude = 0;
  double longitude = 0;
  float speedKmh = 0;
  uint32_t satellites = 0;
  double distanceKm = 0;

  uint16_t voltageRawAdc = 0;
  float voltageSensorVoltage = 0;
  float voltage = 0;

  uint16_t currentRawAdc = 0;
  float currentSensorVoltage = 0;
  float currentAmps = NAN;
  bool currentCalibrated = false;

  bool rfidPresent = false;
  String rfidUid;
  String buzzerState = "OFF";
  bool relayAvailable = false;
  String connectionStatus = "OFFLINE";
  int signalStrength = -120;
};
