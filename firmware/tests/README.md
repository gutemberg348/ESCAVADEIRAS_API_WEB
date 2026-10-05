# Regressão do RFID

O teste compila o `RfidService.cpp` real com relógio/SPI/RC522 simulados. Cobre cartão em HALT, leitura única enquanto encostado, retirada e reapresentação, reconexão, antena desligada, leitor indisponível, recuperação e overflow de `millis()`.

Na raiz do projeto, com um compilador C++17:

```sh
mkdir -p firmware/build-rfid
c++ -std=c++17 -Ifirmware/tests/stubs firmware/tests/rfid-service.test.cpp firmware/TechCode_Escavadeira/src/rfid/RfidService.cpp -o firmware/build-rfid/rfid-service.test
firmware/build-rfid/rfid-service.test
```

No Developer Command Prompt do Visual Studio, após criar `firmware\build-rfid`:

```bat
cl /nologo /EHsc /std:c++17 /Ifirmware\tests\stubs firmware\tests\rfid-service.test.cpp firmware\TechCode_Escavadeira\src\rfid\RfidService.cpp /Fofirmware\build-rfid\ /Fefirmware\build-rfid\rfid-service.test.exe
firmware\build-rfid\rfid-service.test.exe
```

Os stubs não validam alimentação, fiação, alcance RF nem pareamento Android. Execute também o roteiro físico em `docs/bluetooth-offline-android.md`.
