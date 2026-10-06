// Production GpsService + real TinyGPSPlus, using NMEA sentences over fake UART.
#include <cassert>
#include <iostream>
#include "../TechCode_Escavadeira/src/gps/GpsService.h"

void feed(GpsService& gps, TelemetryState& state, const std::string& body, uint32_t elapsed = 1000) {
  clockMs += elapsed;
  unsigned char checksum = 0;
  for (char c : body) checksum ^= c;
  char tail[8];
  std::snprintf(tail, sizeof(tail), "*%02X\r\n", checksum);
  const std::string sentence = "$" + body + tail;
  HardwareSerial::input.insert(HardwareSerial::input.end(), sentence.begin(), sentence.end());
  gps.update(state);
}

void speed(GpsService& gps, TelemetryState& state, double kmh, const char* latitude = "0700.0000") {
  char body[160];
  // NMEA speed is in hundredths of a knot: avoid rounding above the target.
  const double knots = std::floor(kmh / 1.852 * 100) / 100;
  std::snprintf(body, sizeof(body), "GPRMC,120000.00,A,%s,S,03700.0000,W,%.2f,0.00,061026,,,A", latitude, knots);
  feed(gps, state, body);
}

int main() {
  GpsService gps;
  TelemetryState state;
  gps.begin();
  gps.update(state);
  assert(!state.gpsValid && state.speedKmh == 0);
  for (double value : {0.0, 1.0, 2.0, 3.0, 1.0, 3.0, 2.0}) {
    speed(gps, state, value);
    assert(state.gpsValid && state.speedKmh == 0);
  }
  assert(state.distanceKm == 0);

  // An isolated peak, or repeated loop calls on one sample, is not movement.
  speed(gps, state, 8);
  for (int i = 0; i < 500; ++i) { ++clockMs; gps.update(state); }
  assert(state.speedKmh == 0);
  speed(gps, state, 2);
  speed(gps, state, 8);
  speed(gps, state, 8);
  assert(state.speedKmh == 0);
  speed(gps, state, 8, "0700.0010");
  assert(std::abs(state.speedKmh - 8) < 0.03);
  assert(state.distanceKm > 0); // Updated flag survives reading lat()/lng().

  // Hysteresis keeps confirmed movement at 3.5, then stops at <= 3.
  speed(gps, state, 3.5);
  assert(state.speedKmh > 3);
  speed(gps, state, 3);
  assert(state.speedKmh == 0);
  const double stoppedDistance = state.distanceKm;
  for (int i = 0; i < 5; ++i) speed(gps, state, 2, "0700.0020");
  assert(state.distanceKm == stoppedDistance);
  speed(gps, state, 4.1);
  speed(gps, state, 3.5); // Breaks consecutive start confirmation.
  speed(gps, state, 4.1);
  speed(gps, state, 4.1);
  assert(state.speedKmh == 0);
  speed(gps, state, 4.1);
  assert(state.speedKmh > 4);

  // Fresh GGA location cannot keep old RMC speed alive indefinitely.
  for (int i = 0; i < 6; ++i)
    feed(gps, state, "GPGGA,120000.00,0700.0020,S,03700.0000,W,1,08,0.9,100.0,M,0.0,M,,");
  assert(state.gpsValid && state.speedKmh == 0);
  speed(gps, state, 8);
  speed(gps, state, 8);
  assert(state.speedKmh == 0);
  speed(gps, state, 8);
  assert(state.speedKmh > 7);
  clockMs += 5001;
  gps.update(state);
  assert(!state.gpsValid && state.speedKmh == 0);
  speed(gps, state, 8);
  assert(state.speedKmh == 0);

  // A new instance must also work across millis() rollover.
  GpsService wrapGps;
  TelemetryState wrapState;
  clockMs = UINT32_MAX - 1500;
  speed(wrapGps, wrapState, 8);
  speed(wrapGps, wrapState, 8);
  speed(wrapGps, wrapState, 8);
  assert(wrapState.gpsValid && wrapState.speedKmh > 7);
  std::cout << "GPS stationary noise, motion confirmation, distance and stale data: OK\n";
}
