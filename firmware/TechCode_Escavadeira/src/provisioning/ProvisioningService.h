#pragma once
#include <Arduino.h>

class ProvisioningService {
 public:
  void begin();
  void update();
  const String& deviceCode() const { return deviceCode_; }
  const String& deviceToken() const { return deviceToken_; }
  bool provisioned() const { return provisioned_; }

 private:
  void processLine(const String& line);
  String deviceCode_;
  String deviceToken_;
  String serialBuffer_;
  bool provisioned_ = false;
};

extern ProvisioningService deviceIdentity;
