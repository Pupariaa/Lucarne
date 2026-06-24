#include "LucarneStore.h"
#include <string.h>

namespace lucarne {

Store::Store() : _count(0), _dirty(false) {
    for (uint8_t i = 0; i < CAPACITY; i++) {
        _entries[i].key = nullptr;
        _entries[i].type = ValueType::None;
        _entries[i].f = 0.0f;
        _entries[i].i = 0;
        _entries[i].b = false;
        _entries[i].s[0] = '\0';
    }
}

int Store::findIndex(const char *key) const {
    if (!key) return -1;
    for (uint8_t i = 0; i < _count; i++) {
        if (_entries[i].key == key || strcmp(_entries[i].key, key) == 0) {
            return (int)i;
        }
    }
    return -1;
}

int Store::reserve(const char *key) {
    int idx = findIndex(key);
    if (idx >= 0) return idx;
    if (_count >= CAPACITY) return -1;
    idx = (int)_count++;
    _entries[idx].key = key;
    _entries[idx].type = ValueType::None;
    return idx;
}

void Store::setFloat(const char *key, float v) {
    int idx = reserve(key);
    if (idx < 0) return;
    Entry &e = _entries[idx];
    if (e.type == ValueType::Float && e.f == v) return;
    e.type = ValueType::Float;
    e.f = v;
    _dirty = true;
}

void Store::setInt(const char *key, long v) {
    int idx = reserve(key);
    if (idx < 0) return;
    Entry &e = _entries[idx];
    if (e.type == ValueType::Int && e.i == v) return;
    e.type = ValueType::Int;
    e.i = v;
    _dirty = true;
}

void Store::setBool(const char *key, bool v) {
    int idx = reserve(key);
    if (idx < 0) return;
    Entry &e = _entries[idx];
    if (e.type == ValueType::Bool && e.b == v) return;
    e.type = ValueType::Bool;
    e.b = v;
    _dirty = true;
}

void Store::setString(const char *key, const char *v) {
    int idx = reserve(key);
    if (idx < 0) return;
    Entry &e = _entries[idx];
    const char *src = v ? v : "";
    if (e.type == ValueType::String && strncmp(e.s, src, STRLEN) == 0) return;
    e.type = ValueType::String;
    strncpy(e.s, src, STRLEN - 1);
    e.s[STRLEN - 1] = '\0';
    _dirty = true;
}

float Store::getFloat(const char *key, float def) const {
    int idx = findIndex(key);
    if (idx < 0) return def;
    const Entry &e = _entries[idx];
    if (e.type == ValueType::Float) return e.f;
    if (e.type == ValueType::Int) return (float)e.i;
    if (e.type == ValueType::Bool) return e.b ? 1.0f : 0.0f;
    return def;
}

long Store::getInt(const char *key, long def) const {
    int idx = findIndex(key);
    if (idx < 0) return def;
    const Entry &e = _entries[idx];
    if (e.type == ValueType::Int) return e.i;
    if (e.type == ValueType::Float) return (long)e.f;
    if (e.type == ValueType::Bool) return e.b ? 1 : 0;
    return def;
}

bool Store::getBool(const char *key, bool def) const {
    int idx = findIndex(key);
    if (idx < 0) return def;
    const Entry &e = _entries[idx];
    if (e.type == ValueType::Bool) return e.b;
    if (e.type == ValueType::Int) return e.i != 0;
    if (e.type == ValueType::Float) return e.f != 0.0f;
    return def;
}

const char *Store::getString(const char *key, const char *def) const {
    int idx = findIndex(key);
    if (idx < 0) return def;
    const Entry &e = _entries[idx];
    if (e.type == ValueType::String) return e.s;
    return def;
}

ValueType Store::typeOf(const char *key) const {
    int idx = findIndex(key);
    if (idx < 0) return ValueType::None;
    return _entries[idx].type;
}

bool Store::has(const char *key) const {
    return findIndex(key) >= 0;
}

}
