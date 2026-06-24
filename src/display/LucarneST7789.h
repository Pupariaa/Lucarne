#ifndef LUCARNE_ST7789_H
#define LUCARNE_ST7789_H

#include "LucarneDisplay.h"

namespace lucarne {

class ST7789 : public Display {
  public:
    ST7789();

  protected:
    void initPanel() override;
    void setupOffsets() override;
    void computeRotation(uint8_t r) override;
};

}

#endif
