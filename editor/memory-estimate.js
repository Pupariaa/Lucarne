(function () {
  "use strict";

  const LUCARNE_VERSION = "3.0";
  const LUCARNE_LIB_FLASH = 380000;
  const SKETCH_OVERHEAD = 120000;

  function formatBytes(bytes) {
    const A = window.LucarneAssets;
    if (A && A.formatExportSize) return A.formatExportSize(bytes);
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
    return bytes + " B";
  }

  function pct(used, total) {
    if (!total) return null;
    return Math.round((used / total) * 100);
  }

  function headerOverhead(dataBytes) {
    const A = window.LucarneAssets;
    return A && A.estimateHeaderBytes ? A.estimateHeaderBytes(dataBytes) : Math.round(dataBytes * 1.22);
  }

  function boardProfile(LE) {
    if (window.LucarneBoards && LE.project.hardware) {
      return window.LucarneBoards.profile(LE.project.hardware);
    }
    return { appMax: 1310720, dataMax: 0, dataLabel: "", schemeLabel: "default", psramMb: 0, sramKb: 512 };
  }

  function collectIconRefs(project) {
    const set = new Set();
    function use(ref) {
      if (ref && ref !== "none") set.add(ref);
    }
    (project.screens || []).forEach((s) => {
      (s.widgets || []).forEach((w) => {
        if (w.type === "icon") use(w.icon);
        if (w.type === "button") use(w.icon);
        if (w.type === "menu") {
          (w.items || []).forEach((it) => {
            use(it.icon);
            const ri = it.rightIcon;
            if (ri && ri !== "none" && ri !== "auto") use(ri);
          });
        }
      });
    });
    return Array.from(set);
  }

  const FAT_CLUSTER = 4096;

  function fatOnDiskBytes(entries, clusterSize) {
    const cluster = clusterSize || FAT_CLUSTER;
    let n = 0;
    (entries || []).forEach((e) => {
      const sz = typeof e === "number" ? e : e && e.content ? e.content.length : 0;
      if (sz <= 0) return;
      n += Math.ceil(sz / cluster) * cluster;
    });
    return Math.round(n * 1.02);
  }

  function iconDisplayPx(project, ref, jobKey) {
    const R = window.LucarneRender;
    const FE = window.LucarneFluentEmoji;
    let w = null;
    if (FE && FE.findWidgetByIconKey) w = FE.findWidgetByIconKey(project, jobKey);
    if (!w && jobKey) {
      (project.screens || []).some((s) =>
        (s.widgets || []).some((x) => {
          if (x.id === jobKey) {
            w = x;
            return true;
          }
          return false;
        })
      );
    }
    if (w && R && R.iconWidgetDisplaySize) {
      return R.iconWidgetDisplaySize(w, project.icons || {}).w;
    }
    const usage = FE && FE.collectAnimIconUsage ? FE.collectAnimIconUsage(project) : {};
    if (ref && usage[ref]) return usage[ref];
    return 32;
  }

  function animExportFrameCount(ref, project, jobKey) {
    const FE = window.LucarneFluentEmoji;
    if (!FE || ref.indexOf("emoji:") !== 0) return 1;
    const source = FE.sourceFrameCount ? FE.sourceFrameCount(ref) : 1;
    const opts = FE.resolveAnimExportOpts ? FE.resolveAnimExportOpts(project, jobKey) : {};
    if (FE.effectiveExportFrameCount) return FE.effectiveExportFrameCount(source, opts);
    return source;
  }

  function collectIconJobs(project) {
    const X = window.LucarneExport;
    if (X && X.collectIconJobs) return X.collectIconJobs(project);
    return collectIconRefs(project).map((ref) => ({
      ref: ref,
      storage: project.iconExportStorage || "flash",
      key: ref,
    }));
  }

  function estimateIconJobBytes(job, project, LE) {
    const ref = job.ref;
    const st = job.storage || project.iconExportStorage || "flash";
    const FE = window.LucarneFluentEmoji;
    const OB = window.LucarneOpaqueBake;
    const A = window.LucarneAssets;
    const px = iconDisplayPx(project, ref, job.key);

    if (ref.indexOf("emoji:") === 0) {
      const frames = animExportFrameCount(ref, project, job.key);
      if (job.opaqueBake && OB) {
        const p = OB.collectOpaqueBakePlacements(project, LE).find((x) => x.ref === ref && x.widgetId === job.key);
        if (p) {
          const fw = p.rect.w;
          const fh = p.rect.h;
          let n = fw * fh * 2 * frames;
          if (st !== "flash") n += fw * fh * frames;
          return n;
        }
      }
      if (FE && FE.estimateAnimFlashBytes) return FE.estimateAnimFlashBytes(px, frames, st);
      return px * px * 2 * frames + (st === "flash" ? 0 : px * px * frames);
    }

    if (ref.indexOf("c:") === 0) {
      const id = ref.slice(2);
      const ic = project.icons && project.icons[id];
      if (ic && A && A.flashBytesIcon) return A.flashBytesIcon(ic);
      return px * px * 2;
    }

    if (ref.indexOf("tabler:") === 0 || ref.indexOf("streamline:") === 0 || ref.indexOf("glyphs:") === 0) {
      const side = Math.max(32, px);
      return st === "flash" ? side * side * 2 : side * side * 3;
    }

    return 512;
  }

  function estimateProjetFlash(LE) {
    const project = LE.project;
    const A = window.LucarneAssets;
    if (!A) return 0;
    let n = 0;
    Object.values(project.fonts || {}).forEach((f) => {
      if (!f._atlas) return;
      const data = A.flashBytesFont(f._atlas);
      n += data + headerOverhead(data);
    });
    const usage = A.collectImageUsage ? A.collectImageUsage(project) : {};
    Object.keys(project.images || {}).forEach((id) => {
      const img = project.images[id];
      if (!img || img.storage !== "flash") return;
      if (!usage[id]) return;
      const exp = A.imageForExport ? A.imageForExport(project, id, usage) : img;
      if (!exp || !exp.pixels) return;
      const data = A.flashBytesImage(exp);
      n += data + headerOverhead(data);
    });
    const jobs = collectIconJobs(project);
    let flashIconBytes = 0;
    jobs.forEach((j) => {
      if ((j.storage || project.iconExportStorage || "flash") === "flash") {
        flashIconBytes += estimateIconJobBytes(j, project, LE);
      }
    });
    n += flashIconBytes;
    let widgets = 0;
    (project.screens || []).forEach((s) => {
      widgets += (s.widgets || []).length;
    });
    n += widgets * 180 + (project.screens || []).length * 140 + 2048;
    return n;
  }

  function assetBytes(img) {
    const A = window.LucarneAssets;
    if (!img || !img.pixels || !A || !A.flashBytesImage) return 0;
    return A.flashBytesImage(img);
  }

  function estimateOffFlashAssets(LE) {
    const project = LE.project;
    const A = window.LucarneAssets;
    const usage = A && A.collectImageUsage ? A.collectImageUsage(project) : {};
    let sd = 0;
    let internal = 0;
    Object.keys(project.images || {}).forEach((id) => {
      const img = project.images[id];
      if (!img) return;
      const st = img.storage || "flash";
      if (!usage[id]) return;
      const exp = A && A.imageForExport ? A.imageForExport(project, id, usage) : img;
      if (!exp) return;
      let bytes = assetBytes(exp);
      if (st === "volume" || st === "ffat" || st === "internal") {
        bytes = fatOnDiskBytes([bytes + (exp.alpha ? exp.w * exp.h : 0)]);
      }
      if (st === "sd") sd += bytes;
      else if (st === "volume" || st === "ffat" || st === "internal") internal += bytes;
    });
    const jobs = collectIconJobs(project);
    let sdIcon = 0;
    let internalIcon = 0;
    const seen = new Set();
    jobs.forEach((j) => {
      const st = j.storage || project.iconExportStorage || "flash";
      if (st === "flash") return;
      const k = (j.exportRef || j.ref) + "|" + st + "|" + j.key;
      if (seen.has(k)) return;
      seen.add(k);
      let bytes = estimateIconJobBytes(j, project, LE);
      if (st === "volume" || st === "ffat" || st === "internal") bytes = fatOnDiskBytes([bytes]);
      if (st === "sd") sdIcon += bytes;
      else if (st === "volume" || st === "ffat" || st === "internal") internalIcon += bytes;
    });
    sd += sdIcon;
    internal += internalIcon;
    return {
      sd: Math.round(sd),
      internal: Math.round(internal),
    };
  }

  function projectUsesTransitions(project) {
    const H = window.LucarneHardware;
    const eff = (t) => {
      if (H && H.runtimeTransition) return H.runtimeTransition(project, t);
      return !t || t === "Inherit" ? (project.transition && project.transition.default) || "None" : t;
    };
    if (eff(project.transition && project.transition.default) !== "None") return true;
    return (project.screens || []).some((s) =>
      (s.widgets || []).some((w) => {
        if (w.transition && eff(w.transition) !== "None") return true;
        return (w.items || []).some((it) => it && it.transition && eff(it.transition) !== "None");
      })
    );
  }

  function displayRam(LE) {
    const project = LE.project;
    const H = window.LucarneHardware;
    const d = LE.dims ? LE.dims() : { w: 240, h: 280 };
    const fb = d.w * d.h * 2;
    const hal = H && H.resolveHalProfile ? H.resolveHalProfile(project) : null;
    const family = H && H.displayFamily ? H.displayFamily(project) : "spi_rgb";
    const mode = hal ? hal.bufferMode : "Full";
    let display = 0;
    let nativeRot = 0;
    if (family === "oled_mono") display = Math.ceil((d.w * d.h) / 8);
    else if (family === "matrix_lcd") display = 2 * 4 * 40;
    else if (mode === "Full") display = fb;
    else if (mode === "Partial") display = hal ? hal.stripeBytes : 10 * Math.max(d.w, d.h) * 2;
    if (family === "mipi_dsi" && mode === "Full" && ((project.rotation | 0) & 1)) nativeRot = fb;
    let rich = 0;
    if (hal && hal.preferRichTransitions && hal.allowRichTransitions && mode === "Full" && projectUsesTransitions(project)) {
      rich = fb * 2;
    }
    const inPsram = !!(hal && hal.psram && (hal.uiProfile === "Psram" || hal.uiProfile === "MipiHighRes"));
    return { display, nativeRot, rich, inPsram, mode, fb, hal };
  }

  function estimatePsram(LE) {
    const project = LE.project;
    const prof = boardProfile(LE);
    const ram = displayRam(LE);
    let n = 0;
    if (prof.psramMb && ram.inPsram) {
      if (ram.mode === "Full") n += ram.display;
      n += ram.nativeRot + ram.rich;
    }
    const A = window.LucarneAssets;
    const usage = A && A.collectImageUsage ? A.collectImageUsage(project) : {};
    Object.keys(project.images || {}).forEach((id) => {
      const img = project.images[id];
      if (!img || img.storage !== "psram") return;
      if (!usage[id]) return;
      const exp = A && A.imageForExport ? A.imageForExport(project, id, usage) : img;
      if (exp) n += assetBytes(exp);
    });
    return n;
  }

  function estimateSram(LE) {
    const prof = boardProfile(LE);
    const ram = displayRam(LE);
    let n = 48000;
    if (!(prof.psramMb && ram.inPsram)) {
      n += ram.display + ram.nativeRot + ram.rich;
    } else if (ram.mode === "Partial") {
      n += ram.display;
    }
    n += 12000;
    return n;
  }

  function uiFeasibility(LE, prof, flashUsed, sramUsed, psramUsed) {
    const alerts = [];
    const project = LE.project;
    const ram = displayRam(LE);
    const hal = ram.hal;
    if (hal && hal.psramDowngraded) {
      alerts.push(hal.requestedProfile + " profile needs PSRAM but the board declares none — firmware falls back to LowRam");
    }
    if (hal && hal.fullOverBudget) {
      alerts.push(
        "Full framebuffer (" +
          formatBytes(hal.fullBytes) +
          ") exceeds the " +
          hal.uiProfile +
          " budget (" +
          formatBytes(hal.budget) +
          ") — firmware will fall back to Partial"
      );
    }
    if (ram.rich > 0) {
      alerts.push("Rich transitions reserve 2 extra framebuffers (" + formatBytes(ram.rich) + ") during navigation");
    }
    if (prof.appMax && flashUsed > prof.appMax) {
      alerts.push("Binary estimate exceeds app partition (" + formatBytes(flashUsed) + " > " + formatBytes(prof.appMax) + ")");
    } else if (prof.appMax && flashUsed > prof.appMax * 0.85) {
      alerts.push("Binary estimate near app partition limit");
    }
    const sramLimit = (prof.sramKb || 512) * 1024;
    if (!prof.psramMb && sramUsed > sramLimit * 0.75) {
      alerts.push("SRAM pressure: enable PSRAM or reduce framebuffer usage");
    }
    if (prof.psramMb && psramUsed > prof.psramMb * 1048576 * 0.9) {
      alerts.push("PSRAM estimate near limit");
    }
    if (!prof.psramMb && psramUsed > 0) {
      alerts.push("Some images are set to PSRAM storage but the selected board has no PSRAM — they will fail to load at runtime");
    }
    const animRefs = collectIconRefs(project).filter((r) => r.indexOf("emoji:") === 0);
    if (animRefs.length > 3) {
      alerts.push("Many animated emoji icons may stress RAM and flash I/O");
    }
    let widgetCount = 0;
    (project.screens || []).forEach((s) => {
      widgetCount += (s.widgets || []).length;
    });
    if (widgetCount > 40) {
      alerts.push("High widget count may slow UI updates on small MCUs");
    }
    return alerts;
  }

  function estimate(LE) {
    const prof = boardProfile(LE);
    const projet = estimateProjetFlash(LE);
    const binary = projet + LUCARNE_LIB_FLASH + SKETCH_OVERHEAD;
    const offFlash = estimateOffFlashAssets(LE);
    const psram = estimatePsram(LE);
    const sram = estimateSram(LE);
    // SD card assets live on removable media with no on-chip size limit, so
    // they must never be compared against the internal FS partition (dataMax) —
    // only assets actually stored in the on-chip LittleFS/FFat volume count here.
    const internalUsed = offFlash.internal;
    const internalLimit = prof.dataMax || 0;
    const alerts = uiFeasibility(LE, prof, binary, sram, psram);
    const ram = displayRam(LE);
    return {
      version: LUCARNE_VERSION,
      board: prof,
      display: {
        mode: ram.mode,
        bytes: ram.display + ram.nativeRot,
        richBytes: ram.rich,
        profile: ram.hal ? ram.hal.uiProfile : "",
        overBudget: !!(ram.hal && ram.hal.fullOverBudget),
      },
      flash: {
        used: binary,
        limit: prof.appMax,
        projet,
        lib: LUCARNE_LIB_FLASH,
        sketch: SKETCH_OVERHEAD,
        pct: pct(binary, prof.appMax),
      },
      internal: {
        used: internalUsed,
        limit: internalLimit,
        pct: internalLimit ? pct(internalUsed, internalLimit) : null,
        label: prof.dataLabel || "data",
      },
      sd: {
        used: offFlash.sd,
      },
      psram: {
        used: psram,
        limit: prof.psramMb ? prof.psramMb * 1048576 : 0,
        pct: prof.psramMb ? pct(psram, prof.psramMb * 1048576) : null,
      },
      sram: {
        used: sram,
        limit: (prof.sramKb || 512) * 1024,
        pct: pct(sram, (prof.sramKb || 512) * 1024),
      },
      alerts,
    };
  }

  function boardFeasibility(LE, boardId, schemeId) {
    const B = window.LucarneBoards;
    const H = window.LucarneHardware;
    const project = LE.project;
    if (!B || !H || !project.hardware) return { ok: true, reasons: [] };
    const hw = H.get(project);
    const saved = {
      target: hw.board.target,
      schemeId: hw.board.schemeId,
      psramMb: hw.board.psramMb,
      sramKb: hw.board.sramKb,
    };
    const rp = B.isRpBoard ? B.isRpBoard(boardId) : false;
    hw.board.target = boardId;
    const list = B.schemeList(boardId);
    hw.board.schemeId = schemeId && B.getScheme(boardId, schemeId) ? schemeId : (list[0] && list[0].id) || "default";
    if (rp) {
      hw.board.psramMb = 0;
      hw.board.sramKb = B.defaultSramKb(boardId);
    }
    const reasons = [];
    const family = H.displayFamily(project);
    if (rp && family === "mipi_dsi") {
      reasons.push("MIPI DSI panels require an ESP32-P4 — not supported on RP2040/RP2350 in this library.");
    }
    if (rp && project.hardware.touch && project.hardware.touch.kind === "dsi") {
      reasons.push("Native MIPI-DSI touch is ESP32-P4 only.");
    }
    const est = estimate(LE);
    if (est.flash.limit && est.flash.used > est.flash.limit) {
      reasons.push(
        "Estimated binary (" + formatBytes(est.flash.used) + ") exceeds this board's app space (" + formatBytes(est.flash.limit) + ")."
      );
    }
    if (!est.board.psramMb && est.sram.limit && est.sram.used > est.sram.limit) {
      reasons.push(
        "Estimated SRAM usage (" + formatBytes(est.sram.used) + ") exceeds " + formatBytes(est.sram.limit) + " available with no PSRAM."
      );
    }
    if (est.internal.limit && est.internal.used > est.internal.limit) {
      reasons.push(
        "Off-flash assets (" + formatBytes(est.internal.used) + ") exceed the internal filesystem size (" + formatBytes(est.internal.limit) + ")."
      );
    }
    if (!est.board.psramMb && est.psram.used > 0) {
      reasons.push("This board has no PSRAM, but some images are set to PSRAM storage — switch them to flash/SD or pick a board with PSRAM.");
    }
    hw.board.target = saved.target;
    hw.board.schemeId = saved.schemeId;
    hw.board.psramMb = saved.psramMb;
    hw.board.sramKb = saved.sramKb;
    return { ok: reasons.length === 0, reasons };
  }

  window.LucarneMemory = {
    LUCARNE_VERSION,
    LUCARNE_LIB_FLASH,
    FAT_CLUSTER,
    formatBytes,
    fatOnDiskBytes,
    estimate,
    estimateProjetFlash,
    boardFeasibility,
  };
})();
