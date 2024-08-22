/*

Part of SCHEDULER MODULE

Copyright (C) 2017 by faina09
Adapted by Xose Pérez <xose dot perez at gmail dot com>

Copyright (C) 2019-2024 by Maxim Prokhorov <prokhorov dot max at outlook dot com>

*/

#pragma once

#include "datetime.h"

#include <bitset>

namespace espurna {
namespace scheduler {
namespace {

struct DateMatch {
    // simply store the year as-is
    uint16_t year { 0 };

    // [0..11] - Nth month
    std::bitset<12> month;

    // [0]     - Nth day, starting from the end-of-month
    // [1..31] - Nth day in the current month
    std::bitset<32> day;

    // [0]    - last weekday
    // [1..5] - Nth weekday
    std::bitset<6> day_index;
};

struct WeekdayMatch {
    // [0..6] - Nth day in the week
    // [7]    - reserved
    std::bitset<8> day;
};

struct TimeMatch {
    // [0..23]
    std::bitset<24> hour;

    // [0..59] (note that we don't handle leap seconds)
    std::bitset<60> minute;

    // extra matching conditions, defined by the implementation
    uint8_t flags { 0 };
};

constexpr uint8_t FlagUtc = 1;
constexpr uint8_t FlagSunrise = 1 << 1;
constexpr uint8_t FlagSunset = 1 << 2;

struct Schedule {
    DateMatch date;
    WeekdayMatch weekdays;
    TimeMatch time;

    bool ok { false };
};

// by default, relaxed matching. if specific field is not set, assume it is not required
// parser *will* set appropriate bits, but this allows default struct to always be valid

bool match(const DateMatch& lhs, int year, int month, int day) {
    if ((lhs.year != 0) && (lhs.year != year)) {
        return false;
    }

    if (lhs.month.any() && (!lhs.month[month - 1])) {
        return false;
    }

    if (lhs.day_index[0]) {
        return datetime::day_index(datetime::last_day(year, month))
            == datetime::day_index(day);
    }

    if (lhs.day_index.any()) {
        return lhs.day_index[datetime::day_index(day)];
    }

    if (lhs.day[0]) {
        const auto last_day = datetime::last_day(year, month);
        if (lhs.day.count() > 1) {
            return lhs.day[1 + last_day - day];
        }

        return last_day == day;
    }

    if (lhs.day.any() && (!lhs.day[day])) {
        return false;
    }

    return true;

}

inline bool match(const DateMatch& lhs, const datetime::Date& date) {
    return match(lhs, date.year, date.month, date.day);
}

inline bool match(const DateMatch& lhs, const tm& rhs) {
    return match(lhs, datetime::make_date(rhs));
}

bool match(const WeekdayMatch& lhs, const tm& rhs) {
    if (lhs.day[7]) {
        return false;
    }

    if (lhs.day.none()) {
        return true;
    }

    return lhs.day[rhs.tm_wday];
}

bool match(const TimeMatch& lhs, const tm& rhs) {
    if (lhs.hour.any() && (!lhs.hour[rhs.tm_hour])) {
        return false;
    }

    if (lhs.minute.any() && (!lhs.minute[rhs.tm_min])) {
        return false;
    }

    return true;
}

constexpr bool want_utc(const TimeMatch& m) {
    return (m.flags & FlagUtc) > 0;
}

constexpr bool want_sunrise(const TimeMatch& m) {
    return (m.flags & FlagSunrise) > 0;
}

constexpr bool want_sunset(const TimeMatch& m) {
    return (m.flags & FlagSunset) > 0;
}

constexpr bool want_sunrise_sunset(const TimeMatch& m) {
    return want_sunrise(m) || want_sunset(m);
}

namespace bits {

#if __cplusplus > 201411L
#define CONSTEXPR17 constexpr
#else
#define CONSTEXPR17
#endif

// fill u32 or 64 [begin, end] with ones, keep the rest as zeroes

template <typename T>
CONSTEXPR17 T fill_generic(uint8_t begin, uint8_t end) {
    T mask = std::numeric_limits<T>::max();
    mask >>= (sizeof(T) * 8) - T(end - begin);
    mask <<= T(begin);

    return mask;
}

template <typename T>
CONSTEXPR17 T fill_generic_inverse(uint8_t begin, uint8_t end) {
    T high = std::numeric_limits<T>::max();
    high <<= T(begin);

    T low = std::numeric_limits<T>::max();
    low >>= (sizeof(T) * 8) - T(end);

    return high | low;
}

CONSTEXPR17 uint32_t fill_u32(uint8_t begin, uint8_t end) {
    return fill_generic<uint32_t>(begin, end);
}

CONSTEXPR17 uint32_t fill_u32_inverse(uint8_t begin, uint8_t end) {
    return fill_generic_inverse<uint32_t>(begin, end);
}

CONSTEXPR17 uint64_t fill_u64(uint8_t begin, uint8_t end) {
    return fill_generic<uint64_t>(begin, end);
}

CONSTEXPR17 uint32_t fill_u64_inverse(uint8_t begin, uint8_t end) {
    return fill_generic_inverse<uint64_t>(begin, end);
}

#undef CONSTEXPR17

// helper class for [begin, end] bit range

struct Range {
    Range(uint8_t begin, uint8_t end) :
        _begin(begin),
        _end(end)
    {}

    bool valid(uint8_t value) {
        return (value >= _begin) && (value <= _end);
    }

    void fill(uint8_t begin, uint8_t end, uint8_t repeat) {
        if (begin > end) {
            _fill_inverse(begin, end, repeat);
        } else {
            _fill(begin, end, repeat);
        }
    }

    void fill(uint8_t begin, uint8_t end) {
        _fill(begin, end, 1);
    }

    void set() {
        _mask.set();
    }

    void set(uint8_t index) {
        _mask[index] = true;
    }

    void reset() {
        _mask.reset();
    }

    void reset(uint8_t index) {
        _mask[index] = false;
    }

    int begin() const {
        return _begin;
    }

    int end() const {
        return _end;
    }

    static constexpr int min() {
        return 0;
    }

    static constexpr int max() {
        return SizeMax;
    }

    uint32_t to_u32() const {
        return _mask.to_ulong();
    }

    uint64_t to_u64() const {
        return _mask.to_ullong();
    }

    std::string to_string() const {
        return _mask.to_string();
    }

private:
    void _fill_inverse(uint8_t begin, uint8_t end, uint8_t repeat) {
        if (repeat == 1) {
            _mask |= fill_u64_inverse(begin, end + 1);
            return;
        }

        for (int n = begin; n <= _end; n += repeat) {
            _mask[n] = true;
        }

        for (int n = _begin; n <= end; n += repeat) {
            _mask[n] = true;
        }
    }

    void _fill(uint8_t begin, uint8_t end, uint8_t repeat) {
        if (repeat == 1) {
            _mask |= fill_u64(begin, end + 1);
            return;
        }

        for (int n = begin; n <= end; n += repeat) {
            _mask[n] = true;
        }
    }

    static constexpr auto SizeMax = size_t{ 64 };
    using Mask = std::bitset<SizeMax>;

    uint8_t _begin;
    uint8_t _end;

    Mask _mask{};
};

// Returns one plus the index of the least significant 1-bit of x, or if x is zero, returns zero.
constexpr int first_set_u32(uint32_t value) {
    return __builtin_ffs(value);
}

// Returns one plus the index of the least significant 1-bit of x, or if x is zero, returns zero.
constexpr int first_set_u64(uint64_t value) {
    return __builtin_ffsll(value);
}

// Returns one plus the index of the most significant 1-bit of x, or if x is zero, returns zero.
constexpr int last_set_u32(uint32_t value) {
    return value ? (32 - __builtin_clz(value)) : 0;
}

// Returns one plus the index of the most significant 1-bit of x, or if x is zero, returns zero.
constexpr int last_set_u64(uint64_t value) {
    return value ? (64 - __builtin_clzll(value)) : 0;
}

} // namespace bits

WeekdayMatch& operator|=(WeekdayMatch& lhs, const datetime::Weekday& rhs) {
    lhs.day.set(rhs.c_value());
    return lhs;
}

WeekdayMatch& operator|=(WeekdayMatch& lhs, const WeekdayMatch& rhs) {
    lhs.day |= rhs.day;
    return lhs;
}

WeekdayMatch fill_match(datetime::Weekday lhs, datetime::Weekday rhs) {
    WeekdayMatch out;

    if (!lhs.ok() || !rhs.ok()) {
        out.day[7] = true;
        return out;
    }

    for (auto day = lhs; day != next(rhs); day = next(day)) {
        out.day[day.c_value()] = true;
    }

    return out;
}

const tm& select_time(const datetime::Context& ctx, const Schedule& schedule) {
    return want_utc(schedule.time)
        ? ctx.utc
        : ctx.local;
}

constexpr datetime::Minutes to_minutes(datetime::Seconds seconds) {
    return std::chrono::duration_cast<datetime::Minutes>(seconds);
}

constexpr datetime::Minutes to_minutes(const datetime::Context& ctx) {
    return to_minutes(datetime::Seconds(ctx.timestamp));
}

struct Offset {
    size_t index;
    datetime::Minutes offset;
};

struct Pending {
    size_t index;
    Schedule schedule;
};

namespace search {

bool is_same_day(const tm& lhs, const tm& rhs) {
    return lhs.tm_year == rhs.tm_year
        && lhs.tm_mon == rhs.tm_mon
        && lhs.tm_yday == rhs.tm_yday
        && lhs.tm_wday == rhs.tm_wday
        && lhs.tm_mday == rhs.tm_mday;
}

struct Closest {
    using Mask = TimeMatch(*)(const TimeMatch&, const tm&);
    Mask mask;

    using FindU32 = int(*)(uint32_t);
    FindU32 find_u32;

    using FindU64 = int(*)(uint64_t);
    FindU64 find_u64;
};

// generalized code to find out tm either in the past or the future matching lhs, starting from the rhs
bool closest(const Closest& impl, tm& out, const TimeMatch& lhs, const tm& rhs) {
    auto masked = impl.mask(lhs, rhs);
    if (lhs.hour[rhs.tm_hour]) {
        auto minute = impl.find_u64(masked.minute.to_ullong());
        if (minute != 0) {
            --minute;
            out.tm_min = minute;
            return true;
        }

        masked.hour[rhs.tm_hour] = false;
    }

    auto hour = impl.find_u32(masked.hour.to_ulong());
    if (hour == 0) {
        return false;
    }

    auto minute = impl.find_u64(lhs.minute.to_ullong());
    if (minute == 0) {
        return false;
    }

    --hour;
    --minute;

    out.tm_hour = hour;
    out.tm_min = minute;

    return true;
}

std::bitset<24> mask_past_hours(const std::bitset<24>& lhs, int rhs) {
    return lhs.to_ulong() & bits::fill_u32(0, rhs);
}

std::bitset<60> mask_past_minutes(const std::bitset<60>& lhs, int rhs) {
    return lhs.to_ullong() & bits::fill_u64(0, rhs);
}

TimeMatch mask_past(const TimeMatch& lhs, const tm& rhs) {
    TimeMatch out;
    out.hour = mask_past_hours(lhs.hour, rhs.tm_hour);
    out.minute = mask_past_minutes(lhs.minute, rhs.tm_min);
    out.flags = lhs.flags;

    return out;
}

constexpr auto ClosestPast = Closest{
    .mask = mask_past,
    .find_u32 = bits::last_set_u32,
    .find_u64 = bits::last_set_u64,
};

bool closest_past(tm& out, const TimeMatch& lhs, const tm& rhs) {
    return closest(ClosestPast, out, lhs, rhs);
}

bool closest_end_of_day(tm& out, const TimeMatch& lhs, const tm& rhs) {
    tm tmp;
    std::memcpy(&tmp, &rhs, sizeof(tm));

    tmp.tm_hour = 23;
    tmp.tm_min = 59;
    tmp.tm_sec = 00;

    return closest_past(out, lhs, tmp);
}

std::bitset<24> mask_future_hours(const std::bitset<24>& lhs, int rhs) {
    return lhs.to_ulong() & bits::fill_u32(rhs, 24);
}

std::bitset<60> mask_future_minutes(const std::bitset<60>& lhs, int rhs) {
    return lhs.to_ullong() & bits::fill_u64(rhs, 60);
}

TimeMatch mask_future(const TimeMatch& lhs, const tm& rhs) {
    TimeMatch out;
    out.hour = mask_future_hours(lhs.hour, rhs.tm_hour);
    out.minute = mask_future_minutes(lhs.minute, rhs.tm_min);
    out.flags = lhs.flags;

    return out;
}

constexpr auto Future = Closest{
    .mask = mask_future,
    .find_u32 = bits::first_set_u32,
    .find_u64 = bits::first_set_u64,
};

bool closest_future(tm& out, const TimeMatch& lhs, const tm& rhs) {
    return closest(Future, out, lhs, rhs);
}

bool is_utc(const datetime::Context& ctx, const tm& time_point) {
    return &ctx.utc == &time_point;
}

bool is_local(const datetime::Context& ctx, const tm& time_point) {
    return &ctx.local == &time_point;
}

struct Context {
    explicit Context(const datetime::Context& ctx) :
        base(ctx),
        current(ctx)
    {}

    const datetime::Context& base;

    datetime::Context current{};
    datetime::Days days{};

    // most of the time, schedules are processed in bulk
    // push 'not-yet-handled' ones to internal storage to be processed later
    // caller is expected to have full access to both, internals should only use 'push'

    std::vector<Pending> pending{};
    std::vector<Offset> results{};

    void push_pending(size_t index, const Schedule& schedule) {
        pending.push_back({.index = index, .schedule = schedule});
    }

    void push_result(size_t index, datetime::Minutes offset) {
        results.push_back({.index = index, .offset = offset});
    }

    void sort() {
        std::sort(
            results.begin(),
            results.end(),
            [](const Offset& lhs, const Offset& rhs) {
                return lhs.offset < rhs.offset;
            });
    }
};

bool closest_offset_result(tm& out, Context& ctx, size_t index, const tm& time_point) {
    datetime::Seconds end{ -1 };
    if (is_utc(ctx.current, time_point)) {
        end = datetime::to_seconds(out);
    } else if (is_local(ctx.current, time_point)) {
        end = datetime::Seconds{ mktime(&out) };
    }

    if (end > end.zero()) {
        // cast Seconds -> Minutes right now, extra seconds from
        // subtraction may cause unexpected result after rounding
        const auto begin = datetime::Seconds{ ctx.base.timestamp };
        const auto offset = to_minutes(end) - to_minutes(begin);

        ctx.push_result(index, offset);

        return true;
    }

    return false;
}

using Handler = bool(*)(tm&, const TimeMatch&, const tm&);

bool handle_today(const Handler& handler, Context& ctx, size_t index, const Schedule& schedule) {
    const auto& time_point = select_time(ctx.current, schedule);

    // in case mktime is used, make sure dst <-> std does not happen and as
    // it tries to adjust tm_hour and tm_min. both stay exactly as specified
    tm tmp;
    tmp = time_point;
    tmp.tm_isdst = -1;

    // handler() is expected to adjust `tmp` to either past or future,
    // but staying within 00:00..23:59 boundaries of the `time_point`
    if (match(schedule.date, time_point)
        && match(schedule.weekdays, time_point)
        && handler(tmp, schedule.time, time_point)
        && is_same_day(tmp, time_point)
        && match(schedule.time, tmp)
        && closest_offset_result(tmp, ctx, index, time_point))
    {
        return true;
    }

    ctx.push_pending(index, schedule);

    return false;
}

bool handle_pending(const Handler& handler, Context& ctx, const Pending& pending) {
    if (!pending.schedule.ok) {
        return false;
    }

    const auto& time_point =
        select_time(ctx.current, pending.schedule);

    tm tmp;
    tmp = time_point;
    tmp.tm_isdst = -1;

    return match(pending.schedule.date, time_point)
        && match(pending.schedule.weekdays, time_point)
        && handler(tmp, pending.schedule.time, time_point)
        && is_same_day(tmp, time_point)
        && match(pending.schedule.time, tmp)
        && closest_offset_result(tmp, ctx, pending.index, time_point);
}

} // namespace search

namespace restore {

struct Context : public search::Context {
    explicit Context(const datetime::Context& ctx) :
        search::Context(ctx)
    {
        init();
    }

    ~Context() {
        destroy();
    }

    bool next_delta(const datetime::Days&);
    bool next();

private:
    // defined externally, warnings should be safe to ignore

    void destroy();
    void init();
    void init_delta();
};

bool Context::next_delta(const datetime::Days& days) {
    if (days.count() == 0) {
        return false;
    }

    this->days += days;
    this->current = datetime::delta(this->current, days);
    if (this->current.timestamp < 0) {
        return false;
    }

    this->init_delta();
    return true;
}

bool Context::next() {
    return next_delta(datetime::Days{ -1 });
}

bool handle_today(Context& ctx, size_t index, const Schedule& schedule) {
    return search::handle_today(search::closest_past, ctx, index, schedule);
}

bool handle_pending(Context& ctx, const Pending& pending) {
    return search::handle_pending(search::closest_end_of_day, ctx, pending);
}

} // namespace restore

namespace expect {

struct Context : public search::Context {
    explicit Context(const datetime::Context& ctx) :
        search::Context(ctx)
    {}

    bool next_delta(const datetime::Days&);
    bool next();
};

bool Context::next_delta(const datetime::Days& days) {
    if (days.count() == 0) {
        return false;
    }

    this->days += days;
    this->current = datetime::delta(this->current, days);
    if (this->current.timestamp < 0) {
        return false;
    }

    return true;
}

bool Context::next() {
    return next_delta(datetime::Days{ 1 });
}

bool handle_today(Context& ctx, size_t index, const Schedule& schedule) {
    return search::handle_today(search::closest_future, ctx, index, schedule);
}

bool handle_pending(Context& ctx, const Pending& pending) {
    return search::handle_pending(search::closest_future, ctx, pending);
}

} // namespace expect

namespace relative {

enum class Type {
    None,
    Calendar,
    Named,
    Sunrise,
    Sunset,
};

enum class Order {
    None,
    Before,
    After,
};

struct Relative {
    Type type { Type::None };
    Order order { Order::None };

    String name;
    uint8_t data { 0 };

    datetime::Minutes offset{};
};

} // namespace relative

using relative::Relative;

namespace event {

struct TimePoint {
    datetime::Minutes minutes{ -1 };
    datetime::Seconds seconds{ -1 };
};

TimePoint make_time_point(datetime::Seconds seconds) {
    TimePoint out;

    out.seconds = seconds;
    out.minutes =
        std::chrono::duration_cast<datetime::Minutes>(out.seconds);
    out.seconds -= out.minutes;

    return out;
}

struct Event {
    TimePoint next;
    TimePoint last;
};

constexpr bool is_valid(const datetime::Minutes& minutes) {
    return minutes >= datetime::Minutes::zero();
}

constexpr bool is_valid(const datetime::Seconds& seconds) {
    return seconds >= datetime::Seconds::zero();
}

constexpr bool is_valid(const TimePoint& time_point) {
    return is_valid(time_point.minutes)
        && is_valid(time_point.seconds);
}

constexpr bool is_valid(const Event& event) {
    return is_valid(event.next) && is_valid(event.last);
}

constexpr bool maybe_valid(const Event& event) {
    return is_valid(event.next) || is_valid(event.last);
}

constexpr datetime::Seconds to_seconds(const TimePoint& time_point) {
    return std::chrono::duration_cast<datetime::Seconds>(time_point.minutes)
        + time_point.seconds;
}

constexpr datetime::Minutes difference(const datetime::Minutes& lhs, const datetime::Minutes& rhs) {
    return lhs - rhs;
}

constexpr datetime::Minutes difference(const datetime::Context& ctx, const datetime::Minutes& rhs) {
    return difference(to_minutes(ctx), rhs);
}

} // namespace event

using event::TimePoint;
using event::to_seconds;
using event::make_time_point;

using event::Event;

} // namespace
} // namespace scheduler
} // namespace espurna
