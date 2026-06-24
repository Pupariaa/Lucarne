#ifndef LUCARNE_ST7735S_H
#define LUCARNE_ST7735S_H

#include "LucarneDisplay.h"

namespace lucarne {

class ST7735S : public Display {
  public:
    ST7735S();

  protected:
    void initPanel() override;
    void setupOffsets() override;
    void computeRotation(uint8_t r) override;
};

}

#endif
