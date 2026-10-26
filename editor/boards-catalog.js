(function () {
  "use strict";

  const BUILTIN_CATALOG = {"esp32s3":{"default":{"id":"default","label":"Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)","csv":"default","appMax":1310720,"dataMax":1441792,"dataLabel":"spiffs/spiffs"},"defaultffat":{"id":"defaultffat","label":"Default 4MB with ffat (1.2MB APP/1.5MB FATFS)","csv":"default_ffat","appMax":1310720,"dataMax":1441792,"dataLabel":"ffat/fat"},"default_8MB":{"id":"default_8MB","label":"8M with spiffs (3MB APP/1.5MB SPIFFS)","csv":"default_8MB","appMax":3342336,"dataMax":1572864,"dataLabel":"spiffs/spiffs"},"minimal":{"id":"minimal","label":"Minimal (1.3MB APP/700KB SPIFFS)","csv":"minimal","appMax":1310720,"dataMax":655360,"dataLabel":"spiffs/spiffs"},"no_fs":{"id":"no_fs","label":"No FS 4MB (2MB APP x2)","csv":"no_fs","appMax":2031616,"dataMax":0,"dataLabel":""},"no_ota":{"id":"no_ota","label":"No OTA (2MB APP/2MB SPIFFS)","csv":"no_ota","appMax":2097152,"dataMax":1966080,"dataLabel":"spiffs/spiffs"},"noota_3g":{"id":"noota_3g","label":"No OTA (1MB APP/3MB SPIFFS)","csv":"noota_3g","appMax":1048576,"dataMax":3014656,"dataLabel":"spiffs/spiffs"},"noota_ffat":{"id":"noota_ffat","label":"No OTA (2MB APP/2MB FATFS)","csv":"noota_ffat","appMax":2097152,"dataMax":1966080,"dataLabel":"ffat/fat"},"noota_3gffat":{"id":"noota_3gffat","label":"No OTA (1MB APP/3MB FATFS)","csv":"noota_3gffat","appMax":1048576,"dataMax":3014656,"dataLabel":"ffat/fat"},"huge_app":{"id":"huge_app","label":"Huge APP (3MB No OTA/1MB SPIFFS)","csv":"huge_app","appMax":3145728,"dataMax":917504,"dataLabel":"spiffs/spiffs"},"min_spiffs":{"id":"min_spiffs","label":"Minimal SPIFFS (1.9MB APP with OTA/128KB SPIFFS)","csv":"min_spiffs","appMax":1966080,"dataMax":131072,"dataLabel":"spiffs/spiffs"},"fatflash":{"id":"fatflash","label":"16M Flash (2MB APP/12.5MB FATFS)","csv":"ffat","appMax":2097152,"dataMax":12451840,"dataLabel":"ffat/fat"},"app3M_fat9M_16MB":{"id":"app3M_fat9M_16MB","label":"16M Flash (3MB APP/9.9MB FATFS)","csv":"app3M_fat9M_16MB","appMax":3145728,"dataMax":10354688,"dataLabel":"ffat/fat"},"rainmaker":{"id":"rainmaker","label":"RainMaker 4MB","csv":"rainmaker","appMax":1966080,"dataMax":0,"dataLabel":""},"rainmaker_4MB":{"id":"rainmaker_4MB","label":"RainMaker 4MB No OTA","csv":"rainmaker_4MB_no_ota","appMax":4038656,"dataMax":0,"dataLabel":""},"rainmaker_8MB":{"id":"rainmaker_8MB","label":"RainMaker 8MB","csv":"rainmaker_8MB","appMax":4104192,"dataMax":0,"dataLabel":""},"app5M_fat24M_32MB":{"id":"app5M_fat24M_32MB","label":"32M Flash (4.8MB APP/22MB FATFS)","csv":"large_fat_32MB","appMax":4718592,"dataMax":23986176,"dataLabel":"ffat/fat"},"app5M_little24M_32MB":{"id":"app5M_little24M_32MB","label":"32M Flash (4.8MB APP/22MB LittleFS)","csv":"large_littlefs_32MB","appMax":4718592,"dataMax":23986176,"dataLabel":"spiffs/spiffs"},"app13M_data7M_32MB":{"id":"app13M_data7M_32MB","label":"32M Flash (13MB APP/6.75MB SPIFFS)","csv":"default_32MB","appMax":13107200,"dataMax":7077888,"dataLabel":"spiffs/spiffs"},"esp_sr_16":{"id":"esp_sr_16","label":"ESP SR 16M (3MB APP/6MB SPIFFS/3.9MB MODEL)","csv":"esp_sr_16","appMax":3145728,"dataMax":6291456,"dataLabel":"spiffs/spiffs"},"zigbee_zczr":{"id":"zigbee_zczr","label":"Zigbee ZCZR 4MB with spiffs","csv":"zigbee_zczr","appMax":1310720,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"zigbee_zczr_8MB":{"id":"zigbee_zczr_8MB","label":"Zigbee ZCZR 8MB with spiffs","csv":"zigbee_zczr_8MB","appMax":3407872,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"custom":{"id":"custom","label":"Custom","csv":"","appMax":16777216,"dataMax":0,"dataLabel":""}},"esp32":{"default":{"id":"default","label":"Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)","csv":"default","appMax":1310720,"dataMax":1441792,"dataLabel":"spiffs/spiffs"},"defaultffat":{"id":"defaultffat","label":"Default 4MB with ffat (1.2MB APP/1.5MB FATFS)","csv":"default_ffat","appMax":1310720,"dataMax":1441792,"dataLabel":"ffat/fat"},"default_8MB":{"id":"default_8MB","label":"8M with spiffs (3MB APP/1.5MB SPIFFS)","csv":"default_8MB","appMax":3342336,"dataMax":1572864,"dataLabel":"spiffs/spiffs"},"minimal":{"id":"minimal","label":"Minimal (1.3MB APP/700KB SPIFFS)","csv":"minimal","appMax":1310720,"dataMax":655360,"dataLabel":"spiffs/spiffs"},"no_fs":{"id":"no_fs","label":"No FS 4MB (2MB APP x2)","csv":"no_fs","appMax":2031616,"dataMax":0,"dataLabel":""},"no_ota":{"id":"no_ota","label":"No OTA (2MB APP/2MB SPIFFS)","csv":"no_ota","appMax":2097152,"dataMax":1966080,"dataLabel":"spiffs/spiffs"},"noota_3g":{"id":"noota_3g","label":"No OTA (1MB APP/3MB SPIFFS)","csv":"noota_3g","appMax":1048576,"dataMax":3014656,"dataLabel":"spiffs/spiffs"},"noota_ffat":{"id":"noota_ffat","label":"No OTA (2MB APP/2MB FATFS)","csv":"noota_ffat","appMax":2097152,"dataMax":1966080,"dataLabel":"ffat/fat"},"noota_3gffat":{"id":"noota_3gffat","label":"No OTA (1MB APP/3MB FATFS)","csv":"noota_3gffat","appMax":1048576,"dataMax":3014656,"dataLabel":"ffat/fat"},"huge_app":{"id":"huge_app","label":"Huge APP (3MB No OTA/1MB SPIFFS)","csv":"huge_app","appMax":3145728,"dataMax":917504,"dataLabel":"spiffs/spiffs"},"min_spiffs":{"id":"min_spiffs","label":"Minimal SPIFFS (1.9MB APP with OTA/128KB SPIFFS)","csv":"min_spiffs","appMax":1966080,"dataMax":131072,"dataLabel":"spiffs/spiffs"},"fatflash":{"id":"fatflash","label":"16M Flash (2MB APP/12.5MB FATFS)","csv":"ffat","appMax":2097152,"dataMax":12451840,"dataLabel":"ffat/fat"},"app3M_fat9M_16MB":{"id":"app3M_fat9M_16MB","label":"16M Flash (3MB APP/9.9MB FATFS)","csv":"app3M_fat9M_16MB","appMax":3145728,"dataMax":10354688,"dataLabel":"ffat/fat"},"rainmaker":{"id":"rainmaker","label":"RainMaker 4MB","csv":"rainmaker","appMax":1966080,"dataMax":0,"dataLabel":""},"rainmaker_4MB":{"id":"rainmaker_4MB","label":"RainMaker 4MB No OTA","csv":"rainmaker_4MB_no_ota","appMax":4038656,"dataMax":0,"dataLabel":""},"rainmaker_8MB":{"id":"rainmaker_8MB","label":"RainMaker 8MB","csv":"rainmaker_8MB","appMax":4104192,"dataMax":0,"dataLabel":""},"storage_4MB":{"id":"storage_4MB","label":"Storage APP (2MB APP/1MB NVS/1MB SPIFFS)","csv":"storage_4MB_noota","appMax":2097152,"dataMax":917504,"dataLabel":"spiffs/spiffs"},"zigbee_zczr":{"id":"zigbee_zczr","label":"Zigbee ZCZR 4MB with spiffs","csv":"zigbee_zczr","appMax":1310720,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"zigbee_zczr_8MB":{"id":"zigbee_zczr_8MB","label":"Zigbee ZCZR 8MB with spiffs","csv":"zigbee_zczr_8MB","appMax":3407872,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"custom":{"id":"custom","label":"Custom","csv":"","appMax":16777216,"dataMax":0,"dataLabel":""}},"esp32c3":{"default":{"id":"default","label":"Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)","csv":"default","appMax":1310720,"dataMax":1441792,"dataLabel":"spiffs/spiffs"},"defaultffat":{"id":"defaultffat","label":"Default 4MB with ffat (1.2MB APP/1.5MB FATFS)","csv":"default_ffat","appMax":1310720,"dataMax":1441792,"dataLabel":"ffat/fat"},"default_8MB":{"id":"default_8MB","label":"8M with spiffs (3MB APP/1.5MB SPIFFS)","csv":"default_8MB","appMax":3342336,"dataMax":1572864,"dataLabel":"spiffs/spiffs"},"minimal":{"id":"minimal","label":"Minimal (1.3MB APP/700KB SPIFFS)","csv":"minimal","appMax":1310720,"dataMax":655360,"dataLabel":"spiffs/spiffs"},"no_fs":{"id":"no_fs","label":"No FS 4MB (2MB APP x2)","csv":"no_fs","appMax":2031616,"dataMax":0,"dataLabel":""},"no_ota":{"id":"no_ota","label":"No OTA (2MB APP/2MB SPIFFS)","csv":"no_ota","appMax":2097152,"dataMax":1966080,"dataLabel":"spiffs/spiffs"},"noota_3g":{"id":"noota_3g","label":"No OTA (1MB APP/3MB SPIFFS)","csv":"noota_3g","appMax":1048576,"dataMax":3014656,"dataLabel":"spiffs/spiffs"},"noota_ffat":{"id":"noota_ffat","label":"No OTA (2MB APP/2MB FATFS)","csv":"noota_ffat","appMax":2097152,"dataMax":1966080,"dataLabel":"ffat/fat"},"noota_3gffat":{"id":"noota_3gffat","label":"No OTA (1MB APP/3MB FATFS)","csv":"noota_3gffat","appMax":1048576,"dataMax":3014656,"dataLabel":"ffat/fat"},"huge_app":{"id":"huge_app","label":"Huge APP (3MB No OTA/1MB SPIFFS)","csv":"huge_app","appMax":3145728,"dataMax":917504,"dataLabel":"spiffs/spiffs"},"min_spiffs":{"id":"min_spiffs","label":"Minimal SPIFFS (1.9MB APP with OTA/128KB SPIFFS)","csv":"min_spiffs","appMax":1966080,"dataMax":131072,"dataLabel":"spiffs/spiffs"},"fatflash":{"id":"fatflash","label":"16M Flash (2MB APP/12.5MB FATFS)","csv":"ffat","appMax":2097152,"dataMax":12451840,"dataLabel":"ffat/fat"},"app3M_fat9M_16MB":{"id":"app3M_fat9M_16MB","label":"16M Flash (3MB APP/9.9MB FATFS)","csv":"app3M_fat9M_16MB","appMax":3145728,"dataMax":10354688,"dataLabel":"ffat/fat"},"rainmaker":{"id":"rainmaker","label":"RainMaker 4MB","csv":"rainmaker","appMax":1966080,"dataMax":0,"dataLabel":""},"rainmaker_4MB":{"id":"rainmaker_4MB","label":"RainMaker 4MB No OTA","csv":"rainmaker_4MB_no_ota","appMax":4038656,"dataMax":0,"dataLabel":""},"rainmaker_8MB":{"id":"rainmaker_8MB","label":"RainMaker 8MB","csv":"rainmaker_8MB","appMax":4104192,"dataMax":0,"dataLabel":""},"zigbee_zczr":{"id":"zigbee_zczr","label":"Zigbee ZCZR 4MB with spiffs","csv":"zigbee_zczr","appMax":1310720,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"zigbee_zczr_8MB":{"id":"zigbee_zczr_8MB","label":"Zigbee ZCZR 8MB with spiffs","csv":"zigbee_zczr_8MB","appMax":3407872,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"custom":{"id":"custom","label":"Custom","csv":"","appMax":16777216,"dataMax":0,"dataLabel":""}},"esp32s2":{"default":{"id":"default","label":"Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)","csv":"default","appMax":1310720,"dataMax":1441792,"dataLabel":"spiffs/spiffs"},"defaultffat":{"id":"defaultffat","label":"Default 4MB with ffat (1.2MB APP/1.5MB FATFS)","csv":"default_ffat","appMax":1310720,"dataMax":1441792,"dataLabel":"ffat/fat"},"default_8MB":{"id":"default_8MB","label":"8M with spiffs (3MB APP/1.5MB SPIFFS)","csv":"default_8MB","appMax":3342336,"dataMax":1572864,"dataLabel":"spiffs/spiffs"},"minimal":{"id":"minimal","label":"Minimal (1.3MB APP/700KB SPIFFS)","csv":"minimal","appMax":1310720,"dataMax":655360,"dataLabel":"spiffs/spiffs"},"no_fs":{"id":"no_fs","label":"No FS 4MB (2MB APP x2)","csv":"no_fs","appMax":2031616,"dataMax":0,"dataLabel":""},"no_ota":{"id":"no_ota","label":"No OTA (2MB APP/2MB SPIFFS)","csv":"no_ota","appMax":2097152,"dataMax":1966080,"dataLabel":"spiffs/spiffs"},"noota_3g":{"id":"noota_3g","label":"No OTA (1MB APP/3MB SPIFFS)","csv":"noota_3g","appMax":1048576,"dataMax":3014656,"dataLabel":"spiffs/spiffs"},"noota_ffat":{"id":"noota_ffat","label":"No OTA (2MB APP/2MB FATFS)","csv":"noota_ffat","appMax":2097152,"dataMax":1966080,"dataLabel":"ffat/fat"},"noota_3gffat":{"id":"noota_3gffat","label":"No OTA (1MB APP/3MB FATFS)","csv":"noota_3gffat","appMax":1048576,"dataMax":3014656,"dataLabel":"ffat/fat"},"huge_app":{"id":"huge_app","label":"Huge APP (3MB No OTA/1MB SPIFFS)","csv":"huge_app","appMax":3145728,"dataMax":917504,"dataLabel":"spiffs/spiffs"},"min_spiffs":{"id":"min_spiffs","label":"Minimal SPIFFS (1.9MB APP with OTA/128KB SPIFFS)","csv":"min_spiffs","appMax":1966080,"dataMax":131072,"dataLabel":"spiffs/spiffs"},"fatflash":{"id":"fatflash","label":"16M Flash (2MB APP/12.5MB FATFS)","csv":"ffat","appMax":2097152,"dataMax":12451840,"dataLabel":"ffat/fat"},"app3M_fat9M_16MB":{"id":"app3M_fat9M_16MB","label":"16M Flash (3MB APP/9.9MB FATFS)","csv":"app3M_fat9M_16MB","appMax":3145728,"dataMax":10354688,"dataLabel":"ffat/fat"},"rainmaker":{"id":"rainmaker","label":"RainMaker 4MB","csv":"rainmaker","appMax":1966080,"dataMax":0,"dataLabel":""},"rainmaker_4MB":{"id":"rainmaker_4MB","label":"RainMaker 4MB No OTA","csv":"rainmaker_4MB_no_ota","appMax":4038656,"dataMax":0,"dataLabel":""},"rainmaker_8MB":{"id":"rainmaker_8MB","label":"RainMaker 8MB","csv":"rainmaker_8MB","appMax":4104192,"dataMax":0,"dataLabel":""},"zigbee_zczr":{"id":"zigbee_zczr","label":"Zigbee ZCZR 4MB with spiffs","csv":"zigbee_zczr","appMax":1310720,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"zigbee_zczr_8MB":{"id":"zigbee_zczr_8MB","label":"Zigbee ZCZR 8MB with spiffs","csv":"zigbee_zczr_8MB","appMax":3407872,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"custom":{"id":"custom","label":"Custom","csv":"","appMax":16777216,"dataMax":0,"dataLabel":""}},"esp32p4":{"default":{"id":"default","label":"Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)","csv":"default","appMax":1310720,"dataMax":1441792,"dataLabel":"spiffs/spiffs"},"defaultffat":{"id":"defaultffat","label":"Default 4MB with ffat (1.2MB APP/1.5MB FATFS)","csv":"default_ffat","appMax":1310720,"dataMax":1441792,"dataLabel":"ffat/fat"},"default_8MB":{"id":"default_8MB","label":"8M with spiffs (3MB APP/1.5MB SPIFFS)","csv":"default_8MB","appMax":3342336,"dataMax":1572864,"dataLabel":"spiffs/spiffs"},"minimal":{"id":"minimal","label":"Minimal (1.3MB APP/700KB SPIFFS)","csv":"minimal","appMax":1310720,"dataMax":655360,"dataLabel":"spiffs/spiffs"},"no_fs":{"id":"no_fs","label":"No FS 4MB (2MB APP x2)","csv":"no_fs","appMax":2031616,"dataMax":0,"dataLabel":""},"no_ota":{"id":"no_ota","label":"No OTA (2MB APP/2MB SPIFFS)","csv":"no_ota","appMax":2097152,"dataMax":1966080,"dataLabel":"spiffs/spiffs"},"noota_3g":{"id":"noota_3g","label":"No OTA (1MB APP/3MB SPIFFS)","csv":"noota_3g","appMax":1048576,"dataMax":3014656,"dataLabel":"spiffs/spiffs"},"noota_ffat":{"id":"noota_ffat","label":"No OTA (2MB APP/2MB FATFS)","csv":"noota_ffat","appMax":2097152,"dataMax":1966080,"dataLabel":"ffat/fat"},"noota_3gffat":{"id":"noota_3gffat","label":"No OTA (1MB APP/3MB FATFS)","csv":"noota_3gffat","appMax":1048576,"dataMax":3014656,"dataLabel":"ffat/fat"},"huge_app":{"id":"huge_app","label":"Huge APP (3MB No OTA/1MB SPIFFS)","csv":"huge_app","appMax":3145728,"dataMax":917504,"dataLabel":"spiffs/spiffs"},"min_spiffs":{"id":"min_spiffs","label":"Minimal SPIFFS (1.9MB APP with OTA/128KB SPIFFS)","csv":"min_spiffs","appMax":1966080,"dataMax":131072,"dataLabel":"spiffs/spiffs"},"fatflash":{"id":"fatflash","label":"16M Flash (2MB APP/12.5MB FATFS)","csv":"ffat","appMax":2097152,"dataMax":12451840,"dataLabel":"ffat/fat"},"app3M_fat9M_16MB":{"id":"app3M_fat9M_16MB","label":"16M Flash (3MB APP/9.9MB FATFS)","csv":"app3M_fat9M_16MB","appMax":3145728,"dataMax":10354688,"dataLabel":"ffat/fat"},"rainmaker":{"id":"rainmaker","label":"RainMaker 4MB","csv":"rainmaker","appMax":1966080,"dataMax":0,"dataLabel":""},"rainmaker_4MB":{"id":"rainmaker_4MB","label":"RainMaker 4MB No OTA","csv":"rainmaker_4MB_no_ota","appMax":4038656,"dataMax":0,"dataLabel":""},"rainmaker_8MB":{"id":"rainmaker_8MB","label":"RainMaker 8MB","csv":"rainmaker_8MB","appMax":4104192,"dataMax":0,"dataLabel":""},"app5M_fat24M_32MB":{"id":"app5M_fat24M_32MB","label":"32M Flash (4.8MB APP/22MB FATFS)","csv":"large_fat_32MB","appMax":4718592,"dataMax":23986176,"dataLabel":"ffat/fat"},"app5M_little24M_32MB":{"id":"app5M_little24M_32MB","label":"32M Flash (4.8MB APP/22MB LittleFS)","csv":"large_littlefs_32MB","appMax":4718592,"dataMax":23986176,"dataLabel":"spiffs/spiffs"},"app13M_data7M_32MB":{"id":"app13M_data7M_32MB","label":"32M Flash (13MB APP/6.75MB SPIFFS)","csv":"default_32MB","appMax":13107200,"dataMax":7077888,"dataLabel":"spiffs/spiffs"},"esp_sr_16":{"id":"esp_sr_16","label":"ESP SR 16M (3MB APP/6MB SPIFFS/3.9MB MODEL)","csv":"esp_sr_16","appMax":3145728,"dataMax":6291456,"dataLabel":"spiffs/spiffs"},"zigbee_zczr":{"id":"zigbee_zczr","label":"Zigbee ZCZR 4MB with spiffs","csv":"zigbee_zczr","appMax":1310720,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"zigbee_zczr_8MB":{"id":"zigbee_zczr_8MB","label":"Zigbee ZCZR 8MB with spiffs","csv":"zigbee_zczr_8MB","appMax":3407872,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"custom":{"id":"custom","label":"Custom","csv":"","appMax":16777216,"dataMax":0,"dataLabel":""}},"esp32c6":{"default":{"id":"default","label":"Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)","csv":"default","appMax":1310720,"dataMax":1441792,"dataLabel":"spiffs/spiffs"},"defaultffat":{"id":"defaultffat","label":"Default 4MB with ffat (1.2MB APP/1.5MB FATFS)","csv":"default_ffat","appMax":1310720,"dataMax":1441792,"dataLabel":"ffat/fat"},"default_8MB":{"id":"default_8MB","label":"8M with spiffs (3MB APP/1.5MB SPIFFS)","csv":"default_8MB","appMax":3342336,"dataMax":1572864,"dataLabel":"spiffs/spiffs"},"minimal":{"id":"minimal","label":"Minimal (1.3MB APP/700KB SPIFFS)","csv":"minimal","appMax":1310720,"dataMax":655360,"dataLabel":"spiffs/spiffs"},"no_fs":{"id":"no_fs","label":"No FS 4MB (2MB APP x2)","csv":"no_fs","appMax":2031616,"dataMax":0,"dataLabel":""},"no_ota":{"id":"no_ota","label":"No OTA (2MB APP/2MB SPIFFS)","csv":"no_ota","appMax":2097152,"dataMax":1966080,"dataLabel":"spiffs/spiffs"},"noota_3g":{"id":"noota_3g","label":"No OTA (1MB APP/3MB SPIFFS)","csv":"noota_3g","appMax":1048576,"dataMax":3014656,"dataLabel":"spiffs/spiffs"},"noota_ffat":{"id":"noota_ffat","label":"No OTA (2MB APP/2MB FATFS)","csv":"noota_ffat","appMax":2097152,"dataMax":1966080,"dataLabel":"ffat/fat"},"noota_3gffat":{"id":"noota_3gffat","label":"No OTA (1MB APP/3MB FATFS)","csv":"noota_3gffat","appMax":1048576,"dataMax":3014656,"dataLabel":"ffat/fat"},"huge_app":{"id":"huge_app","label":"Huge APP (3MB No OTA/1MB SPIFFS)","csv":"huge_app","appMax":3145728,"dataMax":917504,"dataLabel":"spiffs/spiffs"},"min_spiffs":{"id":"min_spiffs","label":"Minimal SPIFFS (1.9MB APP with OTA/128KB SPIFFS)","csv":"min_spiffs","appMax":1966080,"dataMax":131072,"dataLabel":"spiffs/spiffs"},"fatflash":{"id":"fatflash","label":"16M Flash (2MB APP/12.5MB FATFS)","csv":"ffat","appMax":2097152,"dataMax":12451840,"dataLabel":"ffat/fat"},"app3M_fat9M_16MB":{"id":"app3M_fat9M_16MB","label":"16M Flash (3MB APP/9.9MB FATFS)","csv":"app3M_fat9M_16MB","appMax":3145728,"dataMax":10354688,"dataLabel":"ffat/fat"},"rainmaker":{"id":"rainmaker","label":"RainMaker 4MB","csv":"rainmaker","appMax":1966080,"dataMax":0,"dataLabel":""},"rainmaker_4MB":{"id":"rainmaker_4MB","label":"RainMaker 4MB No OTA","csv":"rainmaker_4MB_no_ota","appMax":4038656,"dataMax":0,"dataLabel":""},"rainmaker_8MB":{"id":"rainmaker_8MB","label":"RainMaker 8MB","csv":"rainmaker_8MB","appMax":4104192,"dataMax":0,"dataLabel":""},"zigbee_zczr":{"id":"zigbee_zczr","label":"Zigbee ZCZR 4MB with spiffs","csv":"zigbee_zczr","appMax":1310720,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"zigbee_zczr_8MB":{"id":"zigbee_zczr_8MB","label":"Zigbee ZCZR 8MB with spiffs","csv":"zigbee_zczr_8MB","appMax":3407872,"dataMax":1417216,"dataLabel":"spiffs/spiffs"},"custom":{"id":"custom","label":"Custom","csv":"","appMax":16777216,"dataMax":0,"dataLabel":""}},"arduino_nano_esp32":{"default":{"id":"default","label":"Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)","csv":"default","appMax":1310720,"dataMax":1441792,"dataLabel":"spiffs/spiffs"},"defaultffat":{"id":"defaultffat","label":"Default 4MB with ffat (1.2MB APP/1.5MB FATFS)","csv":"default_ffat","appMax":1310720,"dataMax":1441792,"dataLabel":"ffat/fat"},"default_8MB":{"id":"default_8MB","label":"8M with spiffs (3MB APP/1.5MB SPIFFS)","csv":"default_8MB","appMax":3342336,"dataMax":1572864,"dataLabel":"spiffs/spiffs"},"minimal":{"id":"minimal","label":"Minimal (1.3MB APP/700KB SPIFFS)","csv":"minimal","appMax":1310720,"dataMax":655360,"dataLabel":"spiffs/spiffs"},"no_fs":{"id":"no_fs","label":"No FS 4MB (2MB APP x2)","csv":"no_fs","appMax":2031616,"dataMax":0,"dataLabel":""},"no_ota":{"id":"no_ota","label":"No OTA (2MB APP/2MB SPIFFS)","csv":"no_ota","appMax":2097152,"dataMax":1966080,"dataLabel":"spiffs/spiffs"},"noota_3g":{"id":"noota_3g","label":"No OTA (1MB APP/3MB SPIFFS)","csv":"noota_3g","appMax":1048576,"dataMax":3014656,"dataLabel":"spiffs/spiffs"},"noota_ffat":{"id":"noota_ffat","label":"No OTA (2MB APP/2MB FATFS)","csv":"noota_ffat","appMax":2097152,"dataMax":1966080,"dataLabel":"ffat/fat"},"noota_3gffat":{"id":"noota_3gffat","label":"No OTA (1MB APP/3MB FATFS)","csv":"noota_3gffat","appMax":1048576,"dataMax":3014656,"dataLabel":"ffat/fat"},"huge_app":{"id":"huge_app","label":"Huge APP (3MB No OTA/1MB SPIFFS)","csv":"huge_app","appMax":3145728,"dataMax":917504,"dataLabel":"spiffs/spiffs"},"min_spiffs":{"id":"min_spiffs","label":"Minimal SPIFFS (1.9MB APP with OTA/128KB SPIFFS)","csv":"min_spiffs","appMax":1966080,"dataMax":131072,"dataLabel":"spiffs/spiffs"},"fatflash":{"id":"fatflash","label":"16M Flash (2MB APP/12.5MB FATFS)","csv":"ffat","appMax":2097152,"dataMax":12451840,"dataLabel":"ffat/fat"},"app3M_fat9M_16MB":{"id":"app3M_fat9M_16MB","label":"16M Flash (3MB APP/9.9MB FATFS)","csv":"app3M_fat9M_16MB","appMax":3145728,"dataMax":10354688,"dataLabel":"ffat/fat"},"rainmaker":{"id":"rainmaker","label":"RainMaker 4MB","csv":"rainmaker","appMax":1966080,"dataMax":0,"dataLabel":""},"rainmaker_4MB":{"id":"rainmaker_4MB","label":"RainMaker 4MB No OTA","csv":"rainmaker_4MB_no_ota","appMax":4038656,"dataMax":0,"dataLabel":""},"rainmaker_8MB":{"id":"rainmaker_8MB","label":"RainMaker 8MB","csv":"rainmaker_8MB","appMax":4104192,"dataMax":0,"dataLabel":""},"app5M_fat24M_32MB":{"id":"app5M_fat24M_32MB","label":"32M Flash (4.8MB APP/22MB FATFS)","csv":"large_fat_32MB","appMax":4718592,"dataMax":23986176,"dataLabel":"ffat/fat"},"app5M_little24M_32MB":{"id":"app5M_little24M_32MB","label":"32M Flash (4.8MB APP/22MB LittleFS)","csv":"large_littlefs_32MB","appMax":4718592,"dataMax":23986176,"dataLabel":"spiffs/spiffs"},"app13M_data7M_32MB":{"id":"app13M_data7M_32MB","label":"32M Flash (13MB APP/6.75MB SPIFFS)","csv":"default_32MB","appMax":13107200,"dataMax":7077888,"dataLabel":"spiffs/spiffs"},"custom":{"id":"custom","label":"Custom","csv":"","appMax":16777216,"dataMax":0,"dataLabel":""}}};
  const STORAGE_KEY = "lucarne_boards_catalog";

  const BOARD_LABELS = {
    esp32: "ESP32",
    esp32s2: "ESP32-S2",
    esp32s3: "ESP32-S3",
    esp32c3: "ESP32-C3",
    esp32c6: "ESP32-C6",
    esp32p4: "ESP32-P4",
    arduino_nano_esp32: "Arduino Nano ESP32",
    rp2040: "RP2040 (Raspberry Pi Pico)",
    rp2350: "RP2350 (Raspberry Pi Pico 2)",
    arduino_nano_rp2040_connect: "Arduino Nano RP2040 Connect",
  };

  const RP_BOARDS = ["rp2040", "rp2350", "arduino_nano_rp2040_connect"];

  const RP_SRAM_KB = { rp2040: 264, rp2350: 520, arduino_nano_rp2040_connect: 264 };

  const RP_CATALOG = {
    rp2040: {
      default: {
        id: "default",
        label: "2MB Flash (~1.5MB app / 344KB LittleFS)",
        csv: "",
        appMax: 1572864,
        dataMax: 352256,
        dataLabel: "littlefs/littlefs",
      },
      no_fs: {
        id: "no_fs",
        label: "2MB Flash, no filesystem (~2MB app)",
        csv: "",
        appMax: 2093056,
        dataMax: 0,
        dataLabel: "",
      },
      custom: { id: "custom", label: "Custom", csv: "", appMax: 2097152, dataMax: 0, dataLabel: "" },
    },
    rp2350: {
      default: {
        id: "default",
        label: "4MB Flash (~3MB app / 1MB LittleFS)",
        csv: "",
        appMax: 3145728,
        dataMax: 1048576,
        dataLabel: "littlefs/littlefs",
      },
      no_fs: {
        id: "no_fs",
        label: "4MB Flash, no filesystem (~4MB app)",
        csv: "",
        appMax: 4190208,
        dataMax: 0,
        dataLabel: "",
      },
      custom: { id: "custom", label: "Custom", csv: "", appMax: 4194304, dataMax: 0, dataLabel: "" },
    },
    arduino_nano_rp2040_connect: {
      default: {
        id: "default",
        label: "16MB Flash (~4.5MB app / 10MB LittleFS)",
        csv: "",
        appMax: 4718592,
        dataMax: 10485760,
        dataLabel: "littlefs/littlefs",
      },
      no_fs: {
        id: "no_fs",
        label: "16MB Flash, no filesystem (~16MB app)",
        csv: "",
        appMax: 16773120,
        dataMax: 0,
        dataLabel: "",
      },
      custom: { id: "custom", label: "Custom", csv: "", appMax: 16777216, dataMax: 0, dataLabel: "" },
    },
  };

  function boardLabel(boardId) {
    return BOARD_LABELS[boardId] || boardId;
  }

  function boardFamily(boardId) {
    return RP_BOARDS.indexOf(boardId) >= 0 ? "rp2040" : "esp32";
  }

  function isRpBoard(boardId) {
    return RP_BOARDS.indexOf(boardId) >= 0;
  }

  function defaultSramKb(boardId) {
    return RP_SRAM_KB[boardId] || 512;
  }

  function parseCsv(text) {
    let appMax = 0;
    let dataMax = 0;
    let dataLabel = "";
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const p = line.split(",").map((s) => s.trim());
      const name = p[0];
      const type = p[1];
      const sub = p[2];
      const size = parseInt(p[4], 16) || 0;
      if (type === "app" && size > appMax) appMax = size;
      if (type === "data" && (sub === "fat" || sub === "spiffs" || sub === "littlefs") && size > dataMax) {
        dataMax = size;
        dataLabel = name + "/" + sub;
      }
    }
    return { appMax, dataMax, dataLabel };
  }

  function parseBoardsTxt(text, boardId) {
    const schemes = {};
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(new RegExp("^" + boardId + "\\.menu\\.PartitionScheme\\.([^.=]+)=(.+)$"));
      if (!m) continue;
      const id = m[1];
      const label = m[2].trim();
      let appMax = 0;
      let dataMax = 0;
      let dataLabel = "";
      let csv = null;
      const csvLine = lines.find((l) => l.startsWith(boardId + ".menu.PartitionScheme." + id + ".build.partitions="));
      if (csvLine) csv = csvLine.split("=")[1].trim();
      const maxLine = lines.find((l) => l.startsWith(boardId + ".menu.PartitionScheme." + id + ".upload.maximum_size="));
      if (maxLine) appMax = +maxLine.split("=")[1] || 0;
      schemes[id] = { id, label, csv, appMax, dataMax, dataLabel };
    }
    return schemes;
  }

  function mergeCsvSizes(cat, csvMap) {
    Object.keys(cat).forEach((board) => {
      Object.keys(cat[board]).forEach((id) => {
        const s = cat[board][id];
        if (!s.csv || !csvMap[s.csv]) return;
        const r = csvMap[s.csv];
        if (r.appMax > s.appMax) s.appMax = r.appMax;
        if (r.dataMax > s.dataMax) {
          s.dataMax = r.dataMax;
          s.dataLabel = r.dataLabel;
        }
      });
    });
  }

  function loadExtra() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveExtra(cat) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cat));
    } catch (e) {}
  }

  function catalog() {
    const extra = loadExtra();
    const out = JSON.parse(JSON.stringify(BUILTIN_CATALOG));
    Object.keys(RP_CATALOG).forEach((b) => {
      out[b] = JSON.parse(JSON.stringify(RP_CATALOG[b]));
    });
    if (extra) {
      Object.keys(extra).forEach((b) => {
        if (!out[b]) out[b] = {};
        Object.assign(out[b], extra[b]);
      });
    }
    return out;
  }

  function boardIds() {
    return Object.keys(catalog());
  }

  function schemesFor(boardId) {
    return catalog()[boardId] || {};
  }

  function schemeList(boardId) {
    return Object.values(schemesFor(boardId)).sort((a, b) => a.label.localeCompare(b.label));
  }

  function getScheme(boardId, schemeId) {
    return schemesFor(boardId)[schemeId] || null;
  }

  function importArduinoFiles(files) {
    return new Promise((resolve, reject) => {
      const list = Array.from(files || []);
      let boardsTxt = null;
      const csvMap = {};
      const readers = list.map(
        (file) =>
          new Promise((res, rej) => {
            const fr = new FileReader();
            fr.onload = () => {
              const name = file.name.toLowerCase();
              if (name === "boards.txt") boardsTxt = fr.result;
              else if (name.endsWith(".csv")) csvMap[name.replace(/\.csv$/, "")] = parseCsv(fr.result);
              res();
            };
            fr.onerror = () => rej(fr.error);
            fr.readAsText(file);
          })
      );
      Promise.all(readers)
        .then(() => {
          if (!boardsTxt) {
            reject(new Error("boards.txt required"));
            return;
          }
          const extra = loadExtra() || {};
          ["esp32s3", "esp32", "esp32c3", "esp32s2", "esp32p4"].forEach((b) => {
            const s = parseBoardsTxt(boardsTxt, b);
            if (Object.keys(s).length) extra[b] = Object.assign(extra[b] || {}, s);
          });
          mergeCsvSizes(extra, csvMap);
          saveExtra(extra);
          resolve(extra);
        })
        .catch(reject);
    });
  }

  function profile(hw) {
    const board = hw && hw.board ? hw.board : {};
    const boardId = board.target || "esp32s3";
    const rp = isRpBoard(boardId);
    const schemeId = board.schemeId || (rp ? "default" : "app3M_fat9M_16MB");
    const scheme =
      getScheme(boardId, schemeId) || getScheme(boardId, "default") || { appMax: 1310720, dataMax: 0, dataLabel: "" };
    return {
      boardId,
      schemeId,
      scheme,
      appMax: scheme.appMax || 1310720,
      dataMax: scheme.dataMax || 0,
      dataLabel: scheme.dataLabel || "",
      schemeLabel: scheme.label || schemeId,
      psramMb: rp ? 0 : board.psramMb || 0,
      sramKb: rp ? defaultSramKb(boardId) : board.sramKb || 512,
      family: rp ? "rp2040" : "esp32",
    };
  }

  window.LucarneBoards = {
    BUILTIN_CATALOG,
    BOARD_LABELS,
    boardLabel,
    boardFamily,
    isRpBoard,
    defaultSramKb,
    catalog,
    boardIds,
    schemesFor,
    schemeList,
    getScheme,
    importArduinoFiles,
    profile,
  };
})();
