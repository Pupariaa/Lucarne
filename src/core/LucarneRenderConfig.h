#ifndef LUCARNE_RENDER_CONFIG_H
#define LUCARNE_RENDER_CONFIG_H

#include <stdint.h>

#if defined(__has_include)
#if __has_include("LucarneUserConfig.h")
#include "LucarneUserConfig.h"
#endif
#endif

#ifndef LUCARNE_MAX_DIRTY_RECTS
#define LUCARNE_MAX_DIRTY_RECTS 8
#endif

#ifndef LUCARNE_TELEMETRY_MIN_INTERVAL_MS
#define LUCARNE_TELEMETRY_MIN_INTERVAL_MS 50
#endif

namespace lucarne {

static const uint8_t kMaxDirtyRects = LUCARNE_MAX_DIRTY_RECTS;
static const float kMergeAreaRatio = 0.35f;
static const uint16_t kMinStripeLines = 10;
static const uint16_t kMipiStripeLines = 50;
static const uint8_t kTransitionBandsLow = 8;
static const uint8_t kTransitionBandsPsram = 12;
static const uint8_t kTransitionBandsMipi = 16;
static const uint16_t kTransitionMsDefault = 180;
static const uint8_t kTransitionStepsMax = 6;
static const uint16_t kTelemetryMinIntervalMs = LUCARNE_TELEMETRY_MIN_INTERVAL_MS;
static const float kMipiNativeMergeRatio = 0.40f;

inline uint16_t defaultStripeLines(int16_t height) {
    int16_t tenth = (int16_t)(height / 10);
    return (uint16_t)(tenth > (int16_t)kMinStripeLines ? tenth : kMinStripeLines);
}

}

#endif
