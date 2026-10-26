(function () {
  "use strict";

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function open(LE) {
    const DLG = window.LucarneDialog;
    const DRC = window.LucarneDrc;
    if (!DLG || !DRC) return;
    DLG.open({
      title: "Design rule check",
      size: "lg",
      render: (body) => render(body, LE),
    });
  }

  function render(body, LE) {
    body.innerHTML = "";
    const DRC = window.LucarneDrc;
    const result = DRC.run(LE);

    const intro = el("p", "drc-intro", body);
    intro.textContent =
      "Checks the selected board, GPIO assignment, SPI/I2C pins, screens, navigation targets and calculated keys for conflicts or missing references before you export.";

    const summary = el("div", "drc-summary", body);
    const errBadge = el("div", "drc-count" + (result.errorCount ? " bad" : " good"), summary);
    errBadge.textContent = result.errorCount + (result.errorCount === 1 ? " error" : " errors");
    const warnBadge = el("div", "drc-count" + (result.warningCount ? " warn" : " good"), summary);
    warnBadge.textContent = result.warningCount + (result.warningCount === 1 ? " warning" : " warnings");

    if (result.issues.length === 0) {
      const ok = el("div", "hint hint-good", body);
      ok.textContent = "All checks passed - MCU, GPIO assignment, screens, navigation and keys are all consistent.";
    } else {
      const groups = {};
      result.issues.forEach((i) => {
        if (!groups[i.group]) groups[i.group] = [];
        groups[i.group].push(i);
      });
      Object.keys(groups).forEach((groupName) => {
        const groupEl = el("div", "drc-group", body);
        const title = el("div", "row-label", groupEl);
        title.textContent = groupName;
        groups[groupName].forEach((issue) => {
          const row = el("div", "drc-issue drc-" + issue.level, groupEl);
          const dot = el("span", "drc-dot", row);
          dot.setAttribute("aria-hidden", "true");
          if (window.LucarneUiIcons) {
            dot.innerHTML = window.LucarneUiIcons.svg(issue.level === "error" ? "error" : "warning", { size: 14 });
          }
          const msg = el("span", "drc-msg", row);
          msg.textContent = issue.message;
        });
      });
    }

    const foot = el("div", "modal-foot", body);
    el("div", "drc-foot-spacer", foot);
    const reRun = el("button", "btn", foot);
    reRun.textContent = "Re-check";
    reRun.addEventListener("click", () => render(body, LE));
  }

  window.LucarneDrc = window.LucarneDrc || {};
  window.LucarneDrc.openPanel = open;
})();
