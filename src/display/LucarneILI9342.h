#ifndef LUCARNE_ILI9342_H
#define LUCARNE_ILI9342_H

#include "LucarneDisplay.h"

namespace lucarne {

class ILI9342 : public Display {
  public:
    ILI9342();

  protected:
    void initPanel() override;
    void setupOffsets() override;
    void computeRotation(uint8_t r) override;
};

}

#endif
