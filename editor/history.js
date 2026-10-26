(function () {
  "use strict";

  const MAX_DEPTH = 60;
  const COALESCE_MS = 900;

  function init(LE, opts) {
    opts = opts || {};
    let states = [];
    let index = 0;
    let lastLabel = null;
    let lastAt = 0;
    let restoring = false;

    function snapshot() {
      return JSON.stringify(LE.project);
    }

    function notify() {
      if (opts.onChange) opts.onChange(list());
    }

    function list() {
      return {
        past: states.slice(0, index).map((s) => s.label),
        current: states[index] ? states[index].label : "",
        future: states.slice(index + 1).map((s) => s.label),
        index,
        canUndo: index > 0,
        canRedo: index < states.length - 1,
      };
    }

    function reset() {
      states = [{ label: "Initial", json: snapshot() }];
      index = 0;
      lastLabel = null;
      lastAt = 0;
      notify();
    }

    function commit(label) {
      if (restoring) return;
      label = label || "Edit";
      const json = snapshot();
      if (states.length && json === states[index].json) return;
      const now = Date.now();
      const coalesce = label === lastLabel && now - lastAt < COALESCE_MS && index > 0;
      if (coalesce) {
        states[index] = { label, json };
      } else {
        states = states.slice(0, index + 1);
        states.push({ label, json });
        index++;
        if (states.length > MAX_DEPTH) {
          states.shift();
          index--;
        }
      }
      lastLabel = label;
      lastAt = now;
      notify();
    }

    function restoreAt(i) {
      if (i < 0 || i >= states.length) return;
      index = i;
      lastLabel = null;
      restoring = true;
      const data = JSON.parse(states[index].json);
      Object.keys(LE.project).forEach((k) => delete LE.project[k]);
      Object.assign(LE.project, data);
      restoring = false;
      if (opts.onRestore) opts.onRestore();
      notify();
    }

    function canUndo() {
      return index > 0;
    }

    function canRedo() {
      return index < states.length - 1;
    }

    function undo() {
      if (!canUndo()) return;
      restoreAt(index - 1);
    }

    function redo() {
      if (!canRedo()) return;
      restoreAt(index + 1);
    }

    function jumpTo(i) {
      restoreAt(i);
    }

    reset();

    return { commit, undo, redo, canUndo, canRedo, jumpTo, list, reset };
  }

  window.LucarneHistory = { init };
})();
