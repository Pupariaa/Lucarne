#ifndef LUCARNE_GRAPH_H
#define LUCARNE_GRAPH_H

#include "../LucarneWidget.h"

namespace lucarne {

enum class GraphType : uint8_t { Line, Bar, Area, Sparkline };
enum class GraphMode : uint8_t { Stream, Keys };

class Graph : public Widget {
  public:
    static const uint8_t MAX_KEYS = 8;
    static const uint8_t MAX_CAPACITY = 64;

    Graph(int16_t x, int16_t y, int16_t w, int16_t h);

    void setType(GraphType type) { markDirty(); _type = type; }
    GraphType type() const { return _type; }
    void setMode(GraphMode mode) { markDirty(); _mode = mode; }
    GraphMode mode() const { return _mode; }
    void setKey(uint8_t index, const char *key);
    void setStreamKey(const char *key) { markDirty(); _streamKey = key; }
    const char *streamKey() const { return _streamKey; }
    void setCapacity(uint8_t capacity);
    void setRange(float minV, float maxV) {
        markDirty();
        _min = minV;
        _max = maxV;
    }
    void setColor(uint16_t c);
    void clearColor();
    void setGrid(bool grid) { markDirty(); _grid = grid; }
    void push(float value);
    void clear();
    uint8_t count() const { return _count; }

    Graph *asGraph() override { return this; }
    uint8_t storeKeys(const char **out, uint8_t max) const override;
    void onStoreKeyChanged(const char *key, Store &store) override;
    void draw(Gfx &g, const Theme &theme, Store &store) override;

  private:
    float valueAt(Store &store, uint8_t index) const;
    uint8_t sampleCount(Store &store) const;
    float sampleAt(uint8_t index) const;
    void drawGrid(Gfx &g, int16_t gx, int16_t gy, int16_t gw, int16_t gh, uint16_t color);
    void drawLineSeries(Gfx &g, Store &store, int16_t gx, int16_t gy, int16_t gw, int16_t gh,
                        uint16_t color, bool fillArea);

    GraphType _type;
    GraphMode _mode;
    const char *_keys[MAX_KEYS];
    uint8_t _keyCount;
    const char *_streamKey;
    float _buf[MAX_CAPACITY];
    uint8_t _capacity;
    uint8_t _count;
    uint8_t _head;
    float _min;
    float _max;
    uint16_t _color;
    bool _hideLine;
    bool _grid;
};

}

#endif
