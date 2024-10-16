// -----------------------------------------------------------------------------
// DYP A02YYUx Ultrasonic Distance Sensor
// Copyright (C) 2024 by tsouthiv @ gmail dot com
// -----------------------------------------------------------------------------

// This should be also compatible with other similar sensors like JSN-SR04T
// or AJ-SR04M in auto UART mode.

#if SENSOR_SUPPORT && A02YYU_SUPPORT

#pragma once

#include "Arduino.h"
#include "BaseSensor.h"

#define _RX_LEN     16
#define _RX_MASK    (_RX_LEN - 1)

class A02YYUSensor : public BaseSensor {

    public:

        void setPort(Stream* port) {
            _serial = port;
            _dirty = true;
        }

        // ---------------------------------------------------------------------
        // Sensor API
        // ---------------------------------------------------------------------

        unsigned char id() const override {
            return SENSOR_A02YYU_ID;
        }

        unsigned char count() const override {
            return 1;
        }

        // Initialization method, must be idempotent
        void begin() {
            if (!_dirty) return;
            _ready = true;
            _dirty = false;
        }

        // Descriptive name of the sensor
        String description() const override {
            return F("A02YYU");
        }

        // Address of the sensor (it could be the GPIO or I2C address)
        String address(unsigned char index) const override {
            return String(A02YYU_PORT, 10);
        }

        // Type for slot # index
        unsigned char type(unsigned char index) const override {
            if (index == 0) return MAGNITUDE_DISTANCE;
            return MAGNITUDE_NONE;
        }

        // Current value for slot # index
        double value(unsigned char index) override {
            if (index == 0) return _distance;
            return 0;
        }

        // Loop-like method, call it in your main loop
        void tick() override {
            _read();
        }

    protected:

        // ---------------------------------------------------------------------
        // Protected
        // ---------------------------------------------------------------------

        int _parse(uint8_t startIndex)
        {
            uint8_t i = startIndex;

            if (_rx[i] != 0xff)
                return -1;

            int vh = _rx[(i + 1) & _RX_MASK];
            int vl = _rx[(i + 2) & _RX_MASK];
            int cs = _rx[(i + 3) & _RX_MASK];

            if (cs != ((0xff + vh + vl) & 0xff))
                return -2;

            return (vh << 8) + vl;
        }

        void _read() {

            int n;

            _error = SENSOR_ERROR_OK;

            // read all available bytes into rx circular buffer
            while ((n = _serial->available()))
            {    
                for (; n > 0; n--) 
                {
                    uint8_t c = _serial->read();

                    if (_rxCount < _RX_LEN) {
                        _rx[_rxIndex] = c;
                        _rxIndex = (_rxIndex + 1) & _RX_MASK;
                        _rxCount++;
                    } else {
                        // overflow
                        _error = SENSOR_ERROR_OTHER;
                    }
                }
                yield();
            }

            while (_rxCount >= 4)
            {
                int d = _parse(_rdIndex);

                if (d > 0) {
                    _rdIndex = (_rdIndex + 4) & _RX_MASK;
                    _rxCount -= 4;
                    _distance = d / 1000.0;
                } else {
                    _rdIndex = (_rdIndex + 1) & _RX_MASK;
                    _rxCount--;
                }
            }
        }

        // ---------------------------------------------------------------------

        uint8_t _rx[_RX_LEN];
        Stream* _serial { nullptr };
        double _distance = 0;
        uint8_t _rxIndex = 0;
        uint8_t _rxCount = 0;
        uint8_t _rdIndex = 0;
        uint8_t _rdCount = 0;
};

#endif // SENSOR_SUPPORT && A02YYU_SUPPORT
