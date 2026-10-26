// TextField widgets and the on-device virtual keyboard.
//
// Pressing OK on a focused TextField opens the on-screen keyboard (built into
// UI, no extra wiring needed): D-pad or touch selects keys, "Del" backspaces,
// "123"/"ABC" switch layout, "^" shifts case, and "OK" commits the value back
// into the field's Store key and closes the keyboard.
#include <Lucarne.h>

using namespace lucarne;

ST7789 display;
UI ui(display);

Screen form("Form");

Label title(0, 12, "SIGN UP", TextAlign::Center);

Label nameLabel(16, 50, "Name");
TextField nameField(16, 70, 208, 34);

Label ageLabel(16, 118, "Age");
TextField ageField(16, 138, 208, 34);

Button submit(16, 200, 208, 40, "Submit");
Label result(0, 250, "", TextAlign::Center);

ButtonInput buttons;

static const uint8_t ACTION_SUBMIT = 1;

void setup() {
    Serial.begin(115200);

    DisplayPins pins;
    pins.cs = 1;
    pins.dc = 2;
    pins.rst = 3;
    pins.mosi = 4;
    pins.sclk = 5;
    pins.bl = -1;

    DisplayOptions options;
    options.panelWidth = 240;
    options.panelHeight = 280;
    options.rotation = 0;
    options.spiHz = 27000000;
    options.spiMode = 3;
    options.colorOrder = ColorOrder::RGB;
    options.invert = true;

    BufferOptions buffer;
    buffer.mode = BufferMode::Full;
    buffer.memory = BufferMemory::Auto;

    display.begin(pins, options, buffer);

    Theme theme;
    theme.font = &LucarneFontBody;
    theme.fontTitle = &LucarneFontTitle;
    ui.setTheme(theme);

    title.setBounds(0, 12, 240, 26);
    title.setFont(&LucarneFontTitle);
    nameLabel.setColor(color565(150, 170, 200));
    ageLabel.setColor(color565(150, 170, 200));
    result.setBounds(0, 250, 240, 24);
    result.setColor(color565(94, 232, 140));

    nameField.setKey("name");
    nameField.setLabel("Name");
    nameField.setPlaceholder("Your name");
    nameField.setMaxLen(24);
    nameField.setInputKind(TextField::Kind::Text);

    ageField.setKey("age");
    ageField.setLabel("Age");
    ageField.setPlaceholder("0");
    ageField.setMaxLen(3);
    ageField.setInputKind(TextField::Kind::Integer);

    submit.setCallback(ACTION_SUBMIT);

    form.add(&title);
    form.add(&nameLabel);
    form.add(&nameField);
    form.add(&ageLabel);
    form.add(&ageField);
    form.add(&submit);
    form.add(&result);

    ui.setString("name", "");
    ui.setInt("age", 0);

    buttons.begin(25, 26, 27, 14, true);
    buttons.attach(&ui);

    ui.show(&form);
    ui.begin();
}

void loop() {
    buttons.update();

    if (ui.pollMenuAction() == ACTION_SUBMIT) {
        char line[48];
        snprintf(line, sizeof(line), "Hi %s, age %ld", ui.store().getString("name", ""),
                  ui.store().getInt("age", 0));
        result.setText(line);
        ui.invalidate();
    }

    ui.update();
}
