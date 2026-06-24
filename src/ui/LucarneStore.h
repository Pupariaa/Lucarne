#ifndef LUCARNE_STORE_H
#define LUCARNE_STORE_H

#include <stdint.h>

namespace lucarne {

enum class ValueType : uint8_t { None, Float, Int, Bool, String };

class Store {
  public:
    static const uint8_t CAPACITY = 32;
    static const uint8_t STRLEN = 24;

    Store();

    void setFloat(const char *key, float v);
    void setInt(const char *key, long v);
    void setBool(const char *key, bool v);
    void setString(const char *key, const char *v);

    float getFloat(const char *key, float def = 0.0f) const;
    long getInt(const char *key, long def = 0) const;
    bool getBool(const char *key, bool def = false) const;
    const char *getString(const char *key, const char *def = "") const;
    ValueType typeOf(const char *key) const;
    bool has(const char *key) const;

    bool dirty() const { return _dirty; }
    void clearDirty() { _dirty = false; }

  private:
    struct Entry {
        const char *key;
        ValueType type;
        float f;
        long i;
        bool b;
        char s[STRLEN];
    };

    int findIndex(const char *key) const;
    int reserve(const char *key);

    Entry _entries[CAPACITY];
    uint8_t _count;
    bool _dirty;
};

}

#endif
