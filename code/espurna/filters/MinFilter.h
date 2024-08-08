// -----------------------------------------------------------------------------
// Max Filter
// Copyright (C) 2017-2019 by Xose Pérez <xose dot perez at gmail dot com>
// -----------------------------------------------------------------------------

#pragma once

#include "BaseFilter.h"

#include <algorithm>

class MinFilter : public BaseFilter {
public:
    void update(double value) override {
        if (!_status) {
            _value = value;
        } else {
            _value = std::min(value, _value);
        }
        _status = true;
    }

    bool status() const override {
        return _status;
    }

    void resize(size_t) override {
        _reset();
    }

    void reset() override {
        _reset();
    }

    double value() const override {
        return _value;
    }

private:
    void _reset() {
        _status = false;
    }

    double _value { 0 };
    bool _status { false };
};
