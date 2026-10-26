(function () {
  "use strict";

  let widget = null;
  let screen = null;

  function setWidget(w) {
    widget = w ? JSON.parse(JSON.stringify(w)) : null;
  }
  function getWidget() {
    return widget ? JSON.parse(JSON.stringify(widget)) : null;
  }
  function hasWidget() {
    return !!widget;
  }
  function setScreen(s) {
    screen = s ? JSON.parse(JSON.stringify(s)) : null;
  }
  function getScreen() {
    return screen ? JSON.parse(JSON.stringify(screen)) : null;
  }
  function hasScreen() {
    return !!screen;
  }

  window.LucarneClipboard = { setWidget, getWidget, hasWidget, setScreen, getScreen, hasScreen };
})();
