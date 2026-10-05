#pragma once
#include <cstdint>
#include <string>
#include <algorithm>
#include <cstdio>
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
