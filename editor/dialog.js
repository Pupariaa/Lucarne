(function () {
  "use strict";

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (tag === "button") e.type = "button";
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

  function focusables(root) {
    return Array.from(root.querySelectorAll(FOCUSABLE)).filter((n) => {
      if (n.closest("[hidden], [inert]")) return false;
      const r = n.getBoundingClientRect();
      return r.width > 0 || r.height > 0 || n === document.activeElement;
    });
  }

  const traps = [];

  function onTrapKey(ev) {
    if (ev.key !== "Tab" || !traps.length) return;
    const top = traps[traps.length - 1];
    if (!top.card.isConnected || top.card.closest("[hidden]")) return;
    const list = focusables(top.card);
    if (!list.length) {
      ev.preventDefault();
      top.card.focus();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    if (!top.card.contains(active)) {
      ev.preventDefault();
      (ev.shiftKey ? last : first).focus();
    } else if (ev.shiftKey && (active === first || active === top.card)) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && active === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  function onTrapFocusIn(ev) {
    if (!traps.length) return;
    const top = traps[traps.length - 1];
    if (!top.card.isConnected || top.card.closest("[hidden]")) return;
    if (top.card.contains(ev.target)) return;
    if (ev.target.closest && ev.target.closest(".toast-stack, .tour-root")) return;
    const list = focusables(top.card);
    (list[0] || top.card).focus();
  }

  document.addEventListener("keydown", onTrapKey, true);
  document.addEventListener("focusin", onTrapFocusIn);

  function trapFocus(card, opts) {
    opts = opts || {};
    const opener = opts.opener !== undefined ? opts.opener : document.activeElement;
    if (!card.hasAttribute("tabindex")) card.setAttribute("tabindex", "-1");
    const entry = { card, opener };
    traps.push(entry);
    const initial = opts.initialFocus || card.querySelector("[autofocus], [data-autofocus]") || focusables(card).find((n) => !n.classList.contains("ghost")) || focusables(card)[0] || card;
    requestAnimationFrame(() => {
      if (card.isConnected && !card.contains(document.activeElement)) initial.focus();
    });
    let released = false;
    return function release(restore) {
      if (released) return;
      released = true;
      const i = traps.indexOf(entry);
      if (i >= 0) traps.splice(i, 1);
      if (restore === false) return;
      const target = opener;
      if (target && target.isConnected && typeof target.focus === "function" && !target.closest("[hidden], [inert]")) {
        target.focus();
      }
    };
  }

  let host = null;
  let onCloseCb = null;
  let releaseTrap = null;
  let dialogOpener = null;
  let titleSeq = 0;

  function ensureHost() {
    if (host) return host;
    host = el("div", "modal lc-dialog", document.body);
    host.hidden = true;
    host.addEventListener("click", (ev) => {
      if (ev.target === host) close();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && host && !host.hidden && !document.querySelector(".tour-root")) {
        ev.stopPropagation();
        close();
      }
    });
    return host;
  }

  function close() {
    if (!host || host.hidden) return;
    host.hidden = true;
    host.innerHTML = "";
    const release = releaseTrap;
    releaseTrap = null;
    const cb = onCloseCb;
    onCloseCb = null;
    if (cb) cb();
    if (release) release();
  }

  function open(opts) {
    opts = opts || {};
    ensureHost();
    if (host.hidden) {
      dialogOpener = document.activeElement;
    } else if (releaseTrap) {
      releaseTrap(false);
      releaseTrap = null;
    }
    host.innerHTML = "";
    onCloseCb = opts.onClose || null;
    const sizeCls = opts.size === "xl" ? " size-xl" : opts.size === "lg" ? " size-lg" : opts.size === "sm" ? " size-sm" : "";
    const card = el("div", "modal-card lc-dialog-card" + sizeCls, host);
    card.setAttribute("role", opts.role || "dialog");
    card.setAttribute("aria-modal", "true");
    if (opts.width) card.style.width = opts.width;
    const head = el("div", "modal-head lc-dialog-head", card);
    const title = el("h2", "lc-dialog-title", head);
    title.id = "lc-dialog-title-" + ++titleSeq;
    title.textContent = opts.title || "";
    card.setAttribute("aria-labelledby", title.id);
    const closeBtn = el("button", "btn ghost", head);
    closeBtn.textContent = "Close";
    closeBtn.setAttribute("aria-label", "Close dialog");
    closeBtn.addEventListener("click", close);
    const body = el("div", "lc-dialog-body", card);
    if (typeof opts.body === "string") {
      body.innerHTML = opts.body;
    } else if (opts.body instanceof Node) {
      body.appendChild(opts.body);
    } else if (typeof opts.render === "function") {
      opts.render(body, { close, card });
    }
    let primary = null;
    if (opts.actions && opts.actions.length) {
      const foot = el("div", "modal-foot", card);
      opts.actions.forEach((a) => {
        const b = el("button", "btn " + (a.cls || ""), foot);
        b.textContent = a.label;
        if (a.cls && a.cls.indexOf("primary") >= 0 && !primary) primary = b;
        b.addEventListener("click", () => {
          if (a.closesDialog === false) {
            if (a.onClick) a.onClick({ close, card, body });
            return;
          }
          close();
          if (a.onClick) a.onClick({ close, card, body });
        });
      });
    }
    if (opts.describedBy !== false) {
      const msg = body.querySelector(".lc-dialog-msg");
      if (msg) {
        msg.id = title.id + "-desc";
        card.setAttribute("aria-describedby", msg.id);
      }
    }
    host.hidden = false;
    releaseTrap = trapFocus(card, {
      opener: dialogOpener,
      initialFocus: opts.initialFocus || (opts.role === "alertdialog" ? primary : null) || undefined,
    });
    return { close, card, body };
  }

  function info(title, message, opts) {
    opts = opts || {};
    return open({
      title,
      body: '<div class="hint lc-dialog-msg">' + message + "</div>",
      actions: [{ label: opts.okLabel || "Got it", cls: "primary" }],
      onClose: opts.onClose,
    });
  }

  function confirm(title, message, opts) {
    opts = opts || {};
    return open({
      title,
      role: "alertdialog",
      body: '<div class="hint lc-dialog-msg">' + message + "</div>",
      actions: [
        { label: opts.cancelLabel || "Cancel" },
        {
          label: opts.okLabel || "Confirm",
          cls: opts.danger ? "danger" : "primary",
          onClick: () => {
            if (opts.onConfirm) opts.onConfirm();
          },
        },
      ],
      onClose: opts.onClose,
    });
  }

  window.LucarneDialog = { open, close, info, confirm, trapFocus, focusables };
})();
