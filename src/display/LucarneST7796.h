#ifndef LUCARNE_ST7796_H
#define LUCARNE_ST7796_H

#include "LucarneDisplay.h"

namespace lucarne {

class ST7796 : public Display {
  public:
    ST7796();

  protected:
    void initPanel() override;
    void setupOffsets() override;
    void computeRotation(uint8_t r) override;
};

}

#endif
