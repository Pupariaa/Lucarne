#ifndef LUCARNE_TRANSITION_H
#define LUCARNE_TRANSITION_H

#include <stdint.h>

namespace lucarne {

enum class Transition : uint8_t {
    Inherit = 0,
    None,
    SlideLeft,
    SlideRight,
    SlideUp,
    SlideDown,
    Fade,
    Push,
    Cover
};

}

#endif
