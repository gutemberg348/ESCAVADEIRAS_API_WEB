#pragma once
#include <cstdint>
#include <string>
#include <algorithm>
#include <cstdio>
#include <cmath>
#include <deque>
using std::max;
using std::isfinite;
constexpr double TWO_PI = 6.28318530717958647692;
inline double radians(double value) { return value * TWO_PI / 360.0; }
inline double degrees(double value) { return value * 360.0 / TWO_PI; }
inline double sq(double value) { return value * value; }
constexpr int SERIAL_8N1 = 0;
class HardwareSerial {
 public:
  inline static std::deque<char> input;
  explicit HardwareSerial(int) {}
  void begin(uint32_t, int, int, int) {}
  int available() const { return static_cast<int>(input.size()); }
  int read() { const char value = input.front(); input.pop_front(); return value; }
};
using byte = uint8_t;
constexpr int OUTPUT = 1, LOW = 0, HIGH = 1, HEX = 16;
inline uint32_t clockMs = 0;
inline int resetLevel = HIGH;
inline uint32_t millis() { return clockMs; }
inline void pinMode(int, int) {}
inline void digitalWrite(int, int level) { resetLevel = level; }
class String : public std::string {
 public:
  using std::string::string;
  String() = default;
  String(byte value, int) { char text[3]; std::snprintf(text, sizeof(text), "%x", value); assign(text); }
  void toUpperCase() { std::transform(begin(), end(), begin(), [](unsigned char c) { return std::toupper(c); }); }
};
struct SerialStub {
  template<class... Args> void printf(const char*, Args...) {}
  void println(const char*) {}
};
inline SerialStub Serial;
