(function () {
  "use strict";

  // Formula grammar: + - * / ( ) unary minus, decimal numbers, key-name identifiers.
  function tokenize(src) {
    const tokens = [];
    let i = 0;
    const s = String(src || "");
    while (i < s.length) {
      const c = s[i];
      if (c === " " || c === "\t" || c === "\n" || c === "\r") {
        i++;
        continue;
      }
      if ("+-*/()".indexOf(c) >= 0) {
        tokens.push({ type: c, pos: i });
        i++;
        continue;
      }
      if (/[0-9.]/.test(c)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        const num = s.slice(i, j);
        if (!/^\d*\.?\d+$|^\d+\.?\d*$/.test(num)) throw new Error("Invalid number at position " + i);
        tokens.push({ type: "num", value: parseFloat(num), pos: i });
        i = j;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
        tokens.push({ type: "id", value: s.slice(i, j), pos: i });
        i = j;
        continue;
      }
      throw new Error('Unexpected character "' + c + '" at position ' + i);
    }
    return tokens;
  }

  // Recursive-descent parser: expr := term (('+'|'-') term)*
  //                            term := unary (('*'|'/') unary)*
  //                            unary := '-' unary | primary
  //                            primary := num | id | '(' expr ')'
  function parse(src) {
    const tokens = tokenize(src);
    let pos = 0;
    const refs = [];

    function peek() {
      return tokens[pos];
    }
    function next() {
      return tokens[pos++];
    }
    function expectType(type) {
      const t = next();
      if (!t || t.type !== type) throw new Error('Expected "' + type + '"');
      return t;
    }

    function primary() {
      const t = peek();
      if (!t) throw new Error("Unexpected end of formula");
      if (t.type === "num") {
        next();
        return { op: "num", value: t.value };
      }
      if (t.type === "id") {
        next();
        if (refs.indexOf(t.value) < 0) refs.push(t.value);
        return { op: "ref", name: t.value };
      }
      if (t.type === "(") {
        next();
        const e = expr();
        expectType(")");
        return e;
      }
      throw new Error("Unexpected token near position " + t.pos);
    }

    function unary() {
      const t = peek();
      if (t && t.type === "-") {
        next();
        return { op: "neg", a: unary() };
      }
      if (t && t.type === "+") {
        next();
        return unary();
      }
      return primary();
    }

    function term() {
      let node = unary();
      while (peek() && (peek().type === "*" || peek().type === "/")) {
        const opTok = next();
        node = { op: opTok.type, a: node, b: unary() };
      }
      return node;
    }

    function expr() {
      let node = term();
      while (peek() && (peek().type === "+" || peek().type === "-")) {
        const opTok = next();
        node = { op: opTok.type, a: node, b: term() };
      }
      return node;
    }

    if (!tokens.length) throw new Error("Empty formula");
    const ast = expr();
    if (pos < tokens.length) throw new Error("Unexpected trailing tokens near position " + tokens[pos].pos);
    return { ast, refs };
  }

  function tryParse(formula) {
    try {
      const r = parse(formula);
      return { ok: true, ast: r.ast, refs: r.refs, error: null };
    } catch (e) {
      return { ok: false, ast: null, refs: [], error: e.message || String(e) };
    }
  }

  function refsOf(formula) {
    const r = tryParse(formula);
    return r.ok ? r.refs : [];
  }

  function evalAst(ast, getValue) {
    switch (ast.op) {
      case "num":
        return ast.value;
      case "ref": {
        const v = getValue(ast.name);
        return typeof v === "number" ? v : v ? 1 : 0;
      }
      case "neg":
        return -evalAst(ast.a, getValue);
      case "+":
        return evalAst(ast.a, getValue) + evalAst(ast.b, getValue);
      case "-":
        return evalAst(ast.a, getValue) - evalAst(ast.b, getValue);
      case "*":
        return evalAst(ast.a, getValue) * evalAst(ast.b, getValue);
      case "/": {
        const b = evalAst(ast.b, getValue);
        if (!b) return 0;
        return evalAst(ast.a, getValue) / b;
      }
      default:
        return 0;
    }
  }

  function numLit(v) {
    let s = String(v);
    if (s.indexOf(".") < 0 && s.indexOf("e") < 0 && s.indexOf("E") < 0) s += ".0";
    return s + "f";
  }

  // Renders the AST as a C++ float expression. `refFn(name)` supplies the
  // C++ snippet used to read another key's current value (e.g. a
  // `ui.store().getFloat(...)` call), so this module stays decoupled from
  // the exporter's string-escaping helpers.
  function toCpp(ast, refFn) {
    switch (ast.op) {
      case "num":
        return numLit(ast.value);
      case "ref":
        return refFn(ast.name);
      case "neg":
        return "(-" + toCpp(ast.a, refFn) + ")";
      case "+":
        return "(" + toCpp(ast.a, refFn) + " + " + toCpp(ast.b, refFn) + ")";
      case "-":
        return "(" + toCpp(ast.a, refFn) + " - " + toCpp(ast.b, refFn) + ")";
      case "*":
        return "(" + toCpp(ast.a, refFn) + " * " + toCpp(ast.b, refFn) + ")";
      case "/": {
        const a = toCpp(ast.a, refFn);
        const b = toCpp(ast.b, refFn);
        return "((" + b + ") != 0.0f ? (" + a + ") / (" + b + ") : 0.0f)";
      }
      default:
        return "0.0f";
    }
  }

  function calcKeys(project) {
    return (project.keys || []).filter((k) => k && k.type === "calc");
  }

  function validateProject(project) {
    const errors = [];
    const keyNames = new Set((project.keys || []).map((k) => k.name));
    const calc = calcKeys(project);
    const calcNames = new Set(calc.map((k) => k.name));
    const deps = new Map();
    calc.forEach((k) => {
      const r = tryParse(k.formula || "0");
      if (!r.ok) {
        errors.push({ name: k.name, message: "Syntax error: " + r.error });
        deps.set(k.name, []);
        return;
      }
      r.refs.forEach((ref) => {
        if (!keyNames.has(ref)) errors.push({ name: k.name, message: 'Unknown key reference "' + ref + '"' });
      });
      deps.set(k.name, r.refs.filter((ref) => calcNames.has(ref)));
    });

    // Cycle detection via DFS.
    const cycles = [];
    const WHITE = 0,
      GRAY = 1,
      BLACK = 2;
    const color = new Map();
    calc.forEach((k) => color.set(k.name, WHITE));
    const stack = [];

    function visit(name) {
      color.set(name, GRAY);
      stack.push(name);
      const ds = deps.get(name) || [];
      for (const d of ds) {
        if (color.get(d) === GRAY) {
          const idx = stack.indexOf(d);
          cycles.push(stack.slice(idx).concat(d));
        } else if (color.get(d) === WHITE) {
          visit(d);
        }
      }
      stack.pop();
      color.set(name, BLACK);
    }
    calc.forEach((k) => {
      if (color.get(k.name) === WHITE) visit(k.name);
    });

    if (cycles.length) {
      cycles.forEach((c) => errors.push({ name: c[0], message: "Circular reference: " + c.join(" -> ") }));
    }

    return { errors, hasCycle: cycles.length > 0, deps };
  }

  function coerceBase(k) {
    if (k.type === "bool") return k.value ? 1 : 0;
    if (k.type === "string") return 0;
    return Number(k.value) || 0;
  }

  // Resolves every key's numeric value, evaluating "calc" keys in dependency
  // order. `overrides` (name -> number) lets simulate.js feed live/simulated
  // values for non-calc keys without mutating the project.
  function resolveAll(project, overrides) {
    const values = new Map();
    const calc = calcKeys(project);
    const calcNames = new Set(calc.map((k) => k.name));
    (project.keys || []).forEach((k) => {
      if (k.type === "calc") return;
      const ov = overrides && Object.prototype.hasOwnProperty.call(overrides, k.name) ? overrides[k.name] : undefined;
      values.set(k.name, ov !== undefined ? Number(ov) || 0 : coerceBase(k));
    });

    const parsed = new Map();
    calc.forEach((k) => {
      const r = tryParse(k.formula || "0");
      parsed.set(k.name, r.ok ? r.ast : { op: "num", value: 0 });
    });

    const resolving = new Set();
    const resolved = new Set();

    function getValue(name) {
      if (values.has(name) && (!calcNames.has(name) || resolved.has(name))) return values.get(name);
      if (calcNames.has(name)) {
        resolveCalc(name);
        return values.get(name) || 0;
      }
      return 0;
    }

    function resolveCalc(name) {
      if (resolved.has(name)) return;
      if (resolving.has(name)) {
        values.set(name, 0);
        return;
      }
      resolving.add(name);
      const ast = parsed.get(name);
      const v = ast ? evalAst(ast, getValue) : 0;
      values.set(name, Number.isFinite(v) ? v : 0);
      resolving.delete(name);
      resolved.add(name);
    }

    calc.forEach((k) => resolveCalc(k.name));
    return values;
  }

  // Best-effort topological order for codegen: calc keys with no unresolved
  // calc dependencies come first. Cycles (already reported by
  // validateProject) are broken by falling back to declaration order for
  // whatever is left, so codegen always terminates.
  function topoOrder(project) {
    const calc = calcKeys(project);
    const { deps } = validateProject(project);
    const done = new Set();
    const order = [];
    let progressed = true;
    const remaining = calc.slice();
    while (remaining.length && progressed) {
      progressed = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const k = remaining[i];
        const ds = deps.get(k.name) || [];
        if (ds.every((d) => done.has(d))) {
          done.add(k.name);
          order.push(k);
          remaining.splice(i, 1);
          progressed = true;
        }
      }
    }
    remaining.forEach((k) => order.push(k));
    return order;
  }

  window.LucarneCalcKeys = {
    tryParse,
    refsOf,
    evalAst,
    toCpp,
    validateProject,
    resolveAll,
    topoOrder,
    calcKeys,
  };
})();
