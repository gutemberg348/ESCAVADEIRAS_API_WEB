#include "GpsService.h"
#include "../config/config.h"

void GpsService::begin() {
  serial_.begin(Config::GPS_BAUD, SERIAL_8N1, Config::GPS_RX_PIN, Config::GPS_TX_UNUSED);
  Serial.printf("[GPS] NEO-6M iniciado: TX do GPS -> GPIO%d, %lu baud\n", Config::GPS_RX_PIN, Config::GPS_BAUD);
}

void GpsService::update(TelemetryState& state) {
  while (serial_.available() > 0) parser_.encode(serial_.read());

  const bool valid = parser_.location.isValid() && parser_.location.age() <= Config::GPS_MAX_AGE_MS;
  state.gpsValid = valid;
  state.satellites = parser_.satellites.isValid() ? parser_.satellites.value() : 0;
  state.speedKmh = parser_.speed.isValid() ? parser_.speed.kmph() : 0;
  if (state.speedKmh < Config::GPS_STOP_SPEED_KMH) state.speedKmh = 0;

  if (!valid) {
    hasLastPosition_ = false;
    return;
  }

  state.latitude = parser_.location.lat();
  state.longitude = parser_.location.lng();
  if (parser_.location.isUpdated()) updateDistance(state);
}

void GpsService::updateDistance(TelemetryState& state) {
  const uint32_t now = millis();
  if (hasLastPosition_ && state.speedKmh >= Config::GPS_STOP_SPEED_KMH) {
    const double segmentMeters = TinyGPSPlus::distanceBetween(
      lastLatitude_, lastLongitude_, state.latitude, state.longitude
    );
    const float elapsedSeconds = max(0.1F, (now - lastPositionAt_) / 1000.0F);
    const float speedMetersSecond = state.speedKmh / 3.6F;
    const float plausibleMaximum = max(15.0F, speedMetersSecond * elapsedSeconds * 3.0F + 10.0F);
    if (segmentMeters >= 0.5 && segmentMeters <= plausibleMaximum) {
      state.distanceKm += segmentMeters / 1000.0;
    } else if (segmentMeters > plausibleMaximum) {
      Serial.printf("[GPS] Salto descartado: %.1f m (máximo plausível %.1f m)\n", segmentMeters, plausibleMaximum);
    }
  }
  lastLatitude_ = state.latitude;
  lastLongitude_ = state.longitude;
  lastPositionAt_ = now;
  hasLastPosition_ = true;
}
