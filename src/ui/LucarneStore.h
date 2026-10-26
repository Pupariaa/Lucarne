#ifndef LUCARNE_STORE_H
#define LUCARNE_STORE_H

#include <stdint.h>

#if defined(__has_include)
#if __has_include("LucarneUserConfig.h")
#include "LucarneUserConfig.h"
#endif
#endif

#ifndef LUCARNE_STORE_CAPACITY
#define LUCARNE_STORE_CAPACITY 160
#endif

namespace lucarne {

enum class ValueType : uint8_t { None, Float, Int, Bool, String };

class Store {
  public:
    static const uint16_t CAPACITY = LUCARNE_STORE_CAPACITY;
    static const uint8_t STRLEN = 64;

    Store();

    void setFloat(const char *key, float v, bool touchDirty = true);
    void setInt(const char *key, long v, bool touchDirty = true);
    void setBool(const char *key, bool v, bool touchDirty = true);
    void setString(const char *key, const char *v, bool touchDirty = true);

    float getFloat(const char *key, float def = 0.0f) const;
    long getInt(const char *key, long def = 0) const;
    bool getBool(const char *key, bool def = false) const;
    const char *getString(const char *key, const char *def = "") const;
    ValueType typeOf(const char *key) const;
    bool has(const char *key) const;

    bool dirty() const { return _dirty; }
    void clearDirty();
    bool isKeyDirty(const char *key) const;
    void markKeyDirty(const char *key);
    uint16_t count() const { return _count; }
    const char *keyAt(uint16_t index) const { return index < _count ? _entries[index].key : nullptr; }
    bool dirtyAt(uint16_t index) const { return index < _count && _entries[index].dirty; }

  private:
    struct Entry {
        const char *key;
        ValueType type;
        bool dirty;
        float f;
        long i;
        bool b;
        char s[STRLEN];
    };

    int findIndex(const char *key) const;
    int reserve(const char *key);

    Entry _entries[CAPACITY];
    uint16_t _count;
    bool _dirty;
};

}

#endif
