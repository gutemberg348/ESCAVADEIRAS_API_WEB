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

## Velocidade GPS

`gps-service.test.cpp` usa o `GpsService.cpp` de produção e a biblioteca TinyGPSPlus real. Somente o relógio e a UART são simulados; as sentenças NMEA incluem checksum e passam pelo parser real. Cobre oscilação de 0–3 km/h, pico isolado, confirmação por amostras novas, retorno a zero, distância parada, velocidade antiga com posição ainda atual e overflow do relógio.

No Developer Command Prompt, ajuste o caminho da biblioteca TinyGPSPlus instalada e crie a pasta de saída:

```bat
mkdir firmware\build-gps-tests
set "GPS_LIB=%USERPROFILE%\Documents\Arduino\libraries\TinyGPSPlus\src"
cl /nologo /EHsc /std:c++17 /DARDUINO=100 /Ifirmware\tests\stubs /I"%GPS_LIB%" firmware\tests\gps-service.test.cpp firmware\TechCode_Escavadeira\src\gps\GpsService.cpp "%GPS_LIB%\TinyGPS++.cpp" /Fofirmware\build-gps-tests\ /Fefirmware\build-gps-tests\gps-service.test.exe
firmware\build-gps-tests\gps-service.test.exe
```

Após gravar o firmware 3.0.2, teste a máquina parada com fix GPS, depois em deslocamento acima de 4 km/h e novamente parada. O filtro exige três amostras novas para sair de zero, normalmente cerca de três segundos com GPS a 1 Hz. Movimentos reais de até 3 km/h também ficam em zero; valide se essa faixa atende à operação. Falhas físicas e oscilações maiores exigem medições em campo.
