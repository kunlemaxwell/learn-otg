/* @ds-bundle: {"format":4,"namespace":"LearnOTG","components":[{"name":"Hero"},{"name":"BigIdea"},{"name":"QuickAnswer"},{"name":"Flow"},{"name":"WorkedExample"},{"name":"Compare"},{"name":"Analogy"},{"name":"ConceptMap"},{"name":"Layers"},{"name":"Timeline"},{"name":"StatGrid"},{"name":"Scale"},{"name":"Explorable"},{"name":"Predict"},{"name":"Quiz"},{"name":"Recall"},{"name":"FlipCards"},{"name":"MythFact"},{"name":"KeyTerms"},{"name":"Takeaways"},{"name":"NextSteps"},{"name":"Activity"},{"name":"Sources"},{"name":"Button"},{"name":"Chip"}]} */
/* eslint-disable */
// Learn OTG design-system components. Installed with the app's own React (see lib/otg.ts).
export function installOTG(R, window) {
  "use strict";
  var h = R.createElement;
  var useState = R.useState;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(" ");
  }
  var MOODS = ["forest", "sun", "lagoon", "berry", "clay", "graphite"];
  function mood(m) {
    return "otg-m-" + (MOODS.indexOf(m) >= 0 ? m : "forest");
  }
  function list(x) {
    return Array.isArray(x) ? x : [];
  }

  // ---- Icons (24px grid, stroke = currentColor) ----
  var PATHS = {
    chevron: ["M6 9l6 6 6-6"],
    check: ["M20 6L9 17l-5-5"],
    x: ["M18 6L6 18", "M6 6l12 12"],
    arrow: ["M5 12h14", "M12 5l7 7-7 7"],
    search: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "M21 21l-4.3-4.3"],
    globe: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"],
    bolt: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"],
    spark: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z", "M19 17l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"],
    book: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z", "M8 7h8"],
    bulb: ["M9 18h6", "M10 22h4", "M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"],
    turn: ["M3 12a9 9 0 1 0 3-6.7", "M3 4v5h5"],
    eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"]
  };
  function Icon(p) {
    var size = p.size || 16;
    return h(
      "svg",
      { className: cx("otg-icon", p.className), width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: p.weight || 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
      (PATHS[p.name] || []).map(function (d, i) {
        return h("path", { key: i, d: d });
      })
    );
  }

  function Eyebrow(p) {
    return p.children ? h("span", { className: "otg-eyebrow" }, p.children) : null;
  }

  // ---- Foundations ----
  function Button(p) {
    var variant = p.variant || "quiet";
    var rest = Object.assign({}, p);
    delete rest.variant;
    delete rest.mood;
    delete rest.icon;
    delete rest.className;
    return h(
      "button",
      Object.assign({ type: "button" }, rest, { className: cx("otg-btn", "otg-btn--" + variant, mood(p.mood), p.className) }),
      p.children,
      p.icon ? h(Icon, { name: p.icon }) : null
    );
  }

  function Chip(p) {
    return h(
      p.onClick ? "button" : "span",
      { type: p.onClick ? "button" : undefined, onClick: p.onClick, className: cx("otg-chip", p.selected && "is-selected", mood(p.mood)) },
      p.icon ? h(Icon, { name: p.icon, size: 14 }) : null,
      p.children
    );
  }

  // ---- Openers ----
  function Hero(p) {
    var v = p.variant || "spotlight";
    var fig = p.figure || {};
    return h(
      "header",
      { className: cx("otg-hero", "otg-hero--" + v, mood(p.mood)) },
      v === "numeral" && fig.value ? h("div", { className: "otg-hero-num" }, fig.value) : null,
      v === "split" ? h("div", { className: "otg-hero-glyph", "aria-hidden": "true" }, p.glyph || (p.title || "?").charAt(0)) : null,
      v === "question" ? h("div", { className: "otg-hero-q", "aria-hidden": "true" }, "?") : null,
      h(
        "div",
        { className: "otg-hero-text" },
        h(Eyebrow, null, p.eyebrow),
        h("h2", { className: "otg-hero-title" }, p.title),
        p.subtitle ? h("p", { className: "otg-hero-sub" }, p.subtitle) : null,
        v === "numeral" && fig.caption ? h("p", { className: "otg-hero-cap" }, fig.caption) : null
      )
    );
  }

  function BigIdea(p) {
    var v = p.variant || "banner";
    return h(
      "section",
      { className: cx("otg-idea", "otg-idea--" + v, mood(p.mood)), "aria-label": "The big idea" },
      v === "quote" ? h("span", { className: "otg-idea-mark", "aria-hidden": "true" }, "“") : null,
      v !== "quote" ? h("span", { className: "otg-eyebrow" }, v === "sticky" ? "Remember this" : "The big idea") : null,
      h("p", { className: "otg-idea-text" }, p.text)
    );
  }

  function QuickAnswer(p) {
    return h(
      "section",
      { className: cx("otg-quick", mood(p.mood)), "aria-live": "polite", "aria-label": "Quick answer" },
      h("span", { className: "otg-eyebrow" }, h(Icon, { name: "bolt", size: 13 }), "Quick answer"),
      h("p", null, p.text, p.live ? h("span", { className: "otg-caret", "aria-hidden": "true" }) : null)
    );
  }

  // ---- Explain ----
  function Flow(p) {
    var layout = p.layout || "rail";
    var steps = list(p.steps);
    var head = p.title ? h("h3", { className: "otg-title" }, p.title) : null;
    if (layout === "cycle") {
      var n = Math.max(steps.length, 1);
      var nodes = steps.map(function (s, i) {
        var a = (-90 + (360 / n) * i) * (Math.PI / 180);
        return { x: 50 + 38 * Math.cos(a), y: 50 + 38 * Math.sin(a) };
      });
      return h(
        "section",
        { className: cx("otg-flow", "otg-flow--cycle", mood(p.mood)) },
        head,
        h(
          "div",
          { className: "otg-cycle" },
          h(
            "svg",
            { className: "otg-cycle-ring", viewBox: "0 0 100 100", "aria-hidden": "true" },
            h("circle", { cx: 50, cy: 50, r: 38, className: "otg-cycle-track" }),
            h("path", { d: "M 50 12 A 38 38 0 0 1 88 50", className: "otg-cycle-arc" }),
            nodes.map(function (pt, i) {
              return h("g", { key: i }, h("circle", { cx: pt.x, cy: pt.y, r: 7, className: "otg-cycle-node" }), h("text", { x: pt.x, y: pt.y + 2.6, textAnchor: "middle", className: "otg-cycle-num" }, String(i + 1)));
            }),
            h("text", { x: 50, y: 52, textAnchor: "middle", className: "otg-cycle-center" }, p.center || "repeat")
          ),
          h(
            "ol",
            { className: "otg-cycle-list" },
            steps.map(function (s, i) {
              return h("li", { key: i }, h("span", { className: "otg-num" }, i + 1), h("div", null, h("strong", null, s.title), s.detail ? h("p", null, s.detail) : null));
            })
          )
        )
      );
    }
    return h(
      "section",
      { className: cx("otg-flow", "otg-flow--" + layout, mood(p.mood)) },
      head,
      h(
        "ol",
        { className: "otg-flow-list" },
        steps.map(function (s, i) {
          return h(
            "li",
            { key: i, className: "otg-flow-step" },
            h("span", { className: "otg-num" }, i + 1),
            h("div", { className: "otg-flow-body" }, h("strong", null, s.title), s.detail ? h("p", null, s.detail) : null),
            layout === "snake" && i < steps.length - 1 ? h(Icon, { name: "arrow", className: "otg-flow-arrow", size: 18 }) : null
          );
        })
      )
    );
  }

  function WorkedExample(p) {
    var steps = list(p.steps);
    var fade = p.fade !== false;
    var _s = useState(fade ? steps.length - 1 : steps.length);
    var shown = _s[0],
      setShown = _s[1];
    return h(
      "section",
      { className: cx("otg-worked", mood(p.mood)) },
      h("span", { className: "otg-eyebrow" }, "Worked example"),
      h("p", { className: "otg-worked-problem" }, p.problem),
      h(
        "ol",
        { className: "otg-worked-steps" },
        steps.map(function (s, i) {
          var open = i < shown;
          return h(
            "li",
            { key: i, className: open ? "" : "is-hidden" },
            h("span", { className: "otg-num" }, i + 1),
            h(
              "div",
              null,
              open ? h("p", null, s.say) : h("p", { className: "otg-worked-try" }, "Your turn: what comes next?"),
              open && s.work ? h("code", { className: "otg-worked-work" }, s.work) : null,
              !open ? h(Button, { variant: "quiet", mood: p.mood, icon: "eye", onClick: function () { setShown(i + 1); } }, "Show this step") : null
            )
          );
        })
      ),
      p.answer && shown >= steps.length ? h("p", { className: "otg-worked-answer" }, h(Icon, { name: "check", size: 16 }), p.answer) : null
    );
  }

  function Compare(p) {
    var left = p.left || {},
      right = p.right || {};
    var layout = p.layout || (list(p.rows).length ? "table" : "split");
    var verdict = p.verdict ? h("p", { className: "otg-compare-verdict" }, h(Icon, { name: "bulb", size: 16 }), p.verdict) : null;
    if (layout === "table") {
      return h(
        "section",
        { className: cx("otg-compare", "otg-compare--table", mood(p.mood)) },
        p.title ? h("h3", { className: "otg-title" }, p.title) : null,
        h(
          "div",
          { className: "otg-table-wrap" },
          h(
            "table",
            { className: "otg-table" },
            h("thead", null, h("tr", null, h("th", null, ""), h("th", { className: "is-a" }, left.title), h("th", { className: "is-b" }, right.title))),
            h(
              "tbody",
              null,
              list(p.rows).map(function (r, i) {
                return h("tr", { key: i }, h("th", { scope: "row" }, r.label), h("td", null, r.left), h("td", null, r.right));
              })
            )
          )
        ),
        verdict
      );
    }
    function side(s, cls) {
      return h(
        "div",
        { className: cx("otg-compare-side", cls) },
        h("h4", null, s.title),
        h(
          "ul",
          null,
          list(s.points).map(function (pt, i) {
            return h("li", { key: i }, pt);
          })
        )
      );
    }
    return h(
      "section",
      { className: cx("otg-compare", "otg-compare--" + layout, mood(p.mood)) },
      p.title ? h("h3", { className: "otg-title" }, p.title) : null,
      h("div", { className: "otg-compare-grid" }, side(left, "is-a"), layout === "versus" ? h("span", { className: "otg-vs", "aria-hidden": "true" }, "vs") : null, side(right, "is-b")),
      verdict
    );
  }

  function Analogy(p) {
    return h(
      "section",
      { className: cx("otg-analogy", mood(p.mood)) },
      h("p", { className: "otg-analogy-head" }, h("span", { className: "otg-analogy-a" }, p.concept), h("span", { className: "otg-analogy-is" }, "is like"), h("span", { className: "otg-analogy-b" }, p.like)),
      h(
        "ul",
        { className: "otg-analogy-map" },
        list(p.mappings).map(function (m, i) {
          return h("li", { key: i }, h("span", { className: "otg-pill is-a" }, m.a), h("span", { className: "otg-analogy-link", "aria-hidden": "true" }), h("span", { className: "otg-pill is-b" }, m.b));
        })
      ),
      p.breaks ? h("p", { className: "otg-analogy-breaks" }, h("strong", null, "Where it breaks: "), p.breaks) : null
    );
  }

  function ConceptMap(p) {
    var nodes = list(p.nodes).slice(0, 8);
    var n = Math.max(nodes.length, 1);
    var pts = nodes.map(function (x, i) {
      var a = (-90 + (360 / n) * i) * (Math.PI / 180);
      return { x: 50 + 36 * Math.cos(a), y: 50 + 37 * Math.sin(a) };
    });
    return h(
      "section",
      { className: cx("otg-map", mood(p.mood)) },
      p.title ? h("h3", { className: "otg-title" }, p.title) : null,
      h(
        "div",
        { className: "otg-map-field" },
        h(
          "svg",
          { className: "otg-map-lines", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true" },
          pts.map(function (pt, i) {
            return h("line", { key: i, x1: 50, y1: 50, x2: pt.x, y2: pt.y, vectorEffect: "non-scaling-stroke" });
          })
        ),
        h("div", { className: "otg-map-center" }, p.center),
        nodes.map(function (node, i) {
          return h("div", { key: i, className: "otg-map-node", style: { left: pts[i].x + "%", top: pts[i].y + "%" } }, h("strong", null, node.label), node.note ? h("span", null, node.note) : null);
        })
      )
    );
  }

  function Layers(p) {
    var layers = list(p.layers);
    var n = layers.length;
    return h(
      "section",
      { className: cx("otg-layers", mood(p.mood)) },
      p.title ? h("h3", { className: "otg-title" }, p.title) : null,
      h(
        "ol",
        { className: "otg-layers-stack" },
        layers.map(function (l, i) {
          var pct = n > 1 ? Math.round(12 + (i * 88) / (n - 1)) : 50;
          return h(
            "li",
            { key: i, className: pct > 55 ? "is-deep" : "", style: { "--depth": pct + "%" } },
            h("div", null, h("strong", null, l.name), l.detail ? h("p", null, l.detail) : null),
            l.value ? h("span", { className: "otg-layers-value" }, l.value) : null
          );
        })
      )
    );
  }

  function Timeline(p) {
    var layout = p.layout || "vertical";
    return h(
      "section",
      { className: cx("otg-timeline", "otg-timeline--" + layout, mood(p.mood)) },
      p.title ? h("h3", { className: "otg-title" }, p.title) : null,
      h(
        "ol",
        { className: "otg-timeline-list", tabIndex: layout === "track" ? 0 : undefined },
        list(p.events).map(function (e, i) {
          return h("li", { key: i }, h("span", { className: "otg-when" }, e.when), h("strong", null, e.title), e.detail ? h("p", null, e.detail) : null);
        })
      )
    );
  }

  // ---- Numbers ----
  function StatGrid(p) {
    var layout = p.layout || "tiles";
    var stats = list(p.stats);
    return h(
      "section",
      { className: cx("otg-stats", "otg-stats--" + layout, mood(p.mood)) },
      stats.map(function (s, i) {
        var ring = null;
        if (layout === "rings") {
          var pct = Math.max(0, Math.min(100, Number(s.pct) || 0));
          var C = 2 * Math.PI * 40;
          ring = h(
            "svg",
            { className: "otg-ring", viewBox: "0 0 100 100", "aria-hidden": "true" },
            h("circle", { cx: 50, cy: 50, r: 40, className: "otg-ring-track" }),
            h("circle", { cx: 50, cy: 50, r: 40, className: "otg-ring-fill", strokeDasharray: (C * pct) / 100 + " " + C, transform: "rotate(-90 50 50)" })
          );
        }
        return h(
          "div",
          { key: i, className: "otg-stat" },
          ring,
          h("span", { className: "otg-stat-value" }, s.value),
          h("span", { className: "otg-stat-label" }, s.label),
          s.note ? h("span", { className: "otg-stat-note" }, s.note) : null
        );
      })
    );
  }

  function Scale(p) {
    var items = list(p.items);
    var vals = items.map(function (x) {
      return Math.max(Number(x.value) || 0, 1e-12);
    });
    var log = p.log !== false;
    var f = function (v) {
      return log ? Math.log10(v) : v;
    };
    var hi = Math.max.apply(null, vals.map(f).concat([0]));
    var lo = Math.min.apply(null, vals.map(f).concat([hi]));
    var span = hi - lo || 1;
    return h(
      "section",
      { className: cx("otg-scale", mood(p.mood)) },
      p.title ? h("h3", { className: "otg-title" }, p.title) : null,
      h(
        "ul",
        { className: "otg-scale-list" },
        items.map(function (it, i) {
          var w = 8 + ((f(vals[i]) - lo) / span) * 92;
          return h(
            "li",
            { key: i, className: it.highlight ? "is-hl" : "" },
            h("span", { className: "otg-scale-label" }, it.label),
            h("span", { className: "otg-scale-track" }, h("span", { className: "otg-scale-bar", style: { width: w + "%" } })),
            h("span", { className: "otg-scale-value" }, it.display || String(it.value) + (p.unit ? " " + p.unit : ""))
          );
        })
      ),
      log ? h("p", { className: "otg-scale-note" }, "Each step to the right is about ten times bigger.") : null
    );
  }

  function Explorable(p) {
    var min = Number(p.min) || 0,
      max = Number(p.max) || 100,
      step = Number(p.step) || 1;
    var _s = useState(p.initial != null ? Number(p.initial) : min);
    var v = _s[0],
      setV = _s[1];
    var outcomes = list(p.outcomes);
    var hit = outcomes[outcomes.length - 1] || {};
    for (var i = 0; i < outcomes.length; i++) if (v <= Number(outcomes[i].upTo)) { hit = outcomes[i]; break; }
    var pct = ((v - min) / (max - min || 1)) * 100;
    var id = "otg-x-" + String(p.label || "v").replace(/\W+/g, "-");
    return h(
      "section",
      { className: cx("otg-explore", mood(p.mood)) },
      h("span", { className: "otg-eyebrow" }, "Try it"),
      p.title ? h("h3", { className: "otg-title" }, p.title) : null,
      h(
        "div",
        { className: "otg-explore-readout" },
        h("label", { htmlFor: id }, p.label),
        h("output", { htmlFor: id }, v, p.unit ? h("small", null, p.unit) : null)
      ),
      h("input", { id: id, type: "range", min: min, max: max, step: step, value: v, style: { "--pct": pct + "%" }, onChange: function (e) { setV(Number(e.target.value)); } }),
      h("div", { className: "otg-explore-out", "aria-live": "polite" }, hit.title ? h("strong", null, hit.title) : null, h("p", null, hit.text))
    );
  }

  // ---- Check (retrieval practice) ----
  function Quiz(p) {
    var variant = p.variant || "list";
    var opts = variant === "truefalse" ? ["True", "False"] : list(p.options);
    var answer = variant === "truefalse" ? (p.answer === true || p.answer === 0 ? 0 : 1) : Number(p.answer);
    var _p = useState(null),
      pick = _p[0],
      setPick = _p[1];
    var _t = useState(0),
      tries = _t[0],
      setTries = _t[1];
    var done = pick === answer || tries >= 2;
    function choose(i) {
      if (done) return;
      setPick(i);
      setTries(tries + 1);
      if (p.onResult && (i === answer || tries + 1 >= 2)) p.onResult(i === answer);
    }
    var prompt = p.question;
    if (variant === "cloze") {
      var parts = String(p.question || "").split("___");
      prompt = h(R.Fragment, null, parts[0], h("span", { className: cx("otg-blank", done && "is-filled") }, done ? opts[answer] : "      "), parts[1] || "");
    }
    var feedback = null;
    if (pick != null) {
      if (pick === answer) feedback = h("div", { className: "otg-fb is-right", role: "status" }, h(Icon, { name: "check" }), h("div", null, h("strong", null, "Correct."), " ", p.explanation));
      else if (tries < 2) feedback = h("div", { className: "otg-fb is-hint", role: "status" }, h(Icon, { name: "bulb" }), h("div", null, h("strong", null, "Not quite. Hint: "), p.hint || "Look again at the big idea."));
      else feedback = h("div", { className: "otg-fb is-wrong", role: "status" }, h(Icon, { name: "x" }), h("div", null, h("strong", null, "Answer: " + opts[answer] + ". "), p.explanation));
    }
    return h(
      "section",
      { className: cx("otg-quiz", "otg-quiz--" + variant, mood(p.mood)) },
      h("span", { className: "otg-eyebrow" }, p.eyebrow || "Quick check"),
      h("p", { className: "otg-quiz-q" }, prompt),
      h(
        "div",
        { className: "otg-quiz-opts", role: "group", "aria-label": "Answers" },
        opts.map(function (o, i) {
          var state = done && i === answer ? "is-right" : pick === i && i !== answer ? "is-wrong" : "";
          return h(
            "button",
            { key: i, type: "button", className: cx("otg-opt", state), disabled: done && i !== answer && pick !== i, onClick: function () { choose(i); } },
            variant === "truefalse" ? h(Icon, { name: i === 0 ? "check" : "x", size: 18 }) : variant !== "cloze" ? h("span", { className: "otg-opt-key" }, String.fromCharCode(65 + i)) : null,
            h("span", null, o)
          );
        })
      ),
      feedback
    );
  }

  function Predict(p) {
    var _s = useState(null),
      pick = _s[0],
      setPick = _s[1];
    var opts = list(p.options);
    var answer = Number(p.answer);
    return h(
      "section",
      { className: cx("otg-predict", mood(p.mood)) },
      h("span", { className: "otg-eyebrow" }, h(Icon, { name: "spark", size: 13 }), "Guess first"),
      h("p", { className: "otg-predict-q" }, p.question),
      h(
        "div",
        { className: "otg-predict-opts", role: "group", "aria-label": "Your guess" },
        opts.map(function (o, i) {
          return h(Chip, { key: i, mood: p.mood, selected: pick === i, onClick: pick == null ? function () { setPick(i); } : undefined }, o);
        })
      ),
      pick != null
        ? h(
            "div",
            { className: "otg-predict-reveal", role: "status" },
            h("strong", null, pick === answer ? "Good instinct. " : "Most people guess that too. The answer is " + opts[answer] + ". "),
            p.reveal
          )
        : h("p", { className: "otg-predict-note" }, "No marks for this one. Guessing first helps it stick.")
    );
  }

  function Recall(p) {
    var _s = useState(""),
      text = _s[0],
      setText = _s[1];
    var _r = useState(false),
      shown = _r[0],
      setShown = _r[1];
    var id = "otg-recall-" + String(p.prompt || "").length;
    return h(
      "section",
      { className: cx("otg-recall", mood(p.mood)) },
      h("span", { className: "otg-eyebrow" }, "Explain it back"),
      h("label", { className: "otg-recall-q", htmlFor: id }, p.prompt),
      h("textarea", { id: id, rows: 3, value: text, placeholder: "Type it in your own words. Rough is fine.", onChange: function (e) { setText(e.target.value); } }),
      shown
        ? h(
            "div",
            { className: "otg-recall-model" },
            h("strong", null, "A strong answer mentions:"),
            h(
              "ul",
              null,
              list(p.points).map(function (pt, i) {
                var hit = text && pt.key && text.toLowerCase().indexOf(String(pt.key).toLowerCase()) >= 0;
                return h("li", { key: i, className: hit ? "is-hit" : "" }, h(Icon, { name: hit ? "check" : "arrow", size: 14 }), pt.text);
              })
            )
          )
        : h(Button, { variant: "primary", mood: p.mood, onClick: function () { setShown(true); } }, "Compare with a model answer")
    );
  }

  function FlipCards(p) {
    var cards = list(p.cards);
    var _s = useState({}),
      flipped = _s[0],
      setFlipped = _s[1];
    return h(
      "section",
      { className: cx("otg-flips", mood(p.mood)) },
      p.title ? h("h3", { className: "otg-title" }, p.title) : null,
      h(
        "div",
        { className: "otg-flips-grid" },
        cards.map(function (c, i) {
          var on = !!flipped[i];
          return h(
            "button",
            {
              key: i,
              type: "button",
              className: cx("otg-flip", on && "is-flipped"),
              "aria-pressed": on,
              onClick: function () {
                var next = Object.assign({}, flipped);
                next[i] = !on;
                setFlipped(next);
              }
            },
            h("span", { className: "otg-flip-inner" }, h("span", { className: "otg-flip-face is-front" }, h("span", null, c.front), h("small", null, "Tap to reveal")), h("span", { className: "otg-flip-face is-back" }, c.back))
          );
        })
      )
    );
  }

  function MythFact(p) {
    return h(
      "section",
      { className: cx("otg-myth", mood(p.mood)) },
      p.title ? h("h3", { className: "otg-title" }, p.title) : null,
      h(
        "ul",
        { className: "otg-myth-list" },
        list(p.items).map(function (it, i) {
          return h(
            "li",
            { key: i },
            h("p", { className: "otg-myth-m" }, h("span", { className: "otg-tag is-myth" }, h(Icon, { name: "x", size: 13 }), "Myth"), it.myth),
            h("p", { className: "otg-myth-f" }, h("span", { className: "otg-tag is-fact" }, h(Icon, { name: "check", size: 13 }), "Fact"), it.fact)
          );
        })
      )
    );
  }

  // ---- Wrap ----
  function KeyTerms(p) {
    var v = p.variant || "glossary";
    var terms = list(p.terms);
    var _s = useState(null),
      open = _s[0],
      setOpen = _s[1];
    if (v === "chips") {
      return h(
        "section",
        { className: cx("otg-terms", "otg-terms--chips", mood(p.mood)) },
        h("span", { className: "otg-eyebrow" }, "Key terms"),
        h(
          "div",
          { className: "otg-terms-chips" },
          terms.map(function (t, i) {
            return h(Chip, { key: i, mood: p.mood, selected: open === i, onClick: function () { setOpen(open === i ? null : i); } }, t.term);
          })
        ),
        open != null && terms[open] ? h("p", { className: "otg-terms-def", "aria-live": "polite" }, h("strong", null, terms[open].term + ": "), terms[open].meaning) : h("p", { className: "otg-terms-def is-empty" }, "Tap a term to see what it means.")
      );
    }
    return h(
      "section",
      { className: cx("otg-terms", "otg-terms--glossary", mood(p.mood)) },
      h("span", { className: "otg-eyebrow" }, "Key terms"),
      h(
        "dl",
        null,
        terms.map(function (t, i) {
          return h(R.Fragment, { key: i }, h("dt", null, t.term), h("dd", null, t.meaning));
        })
      )
    );
  }

  function Takeaways(p) {
    var v = p.variant || "checklist";
    return h(
      "section",
      { className: cx("otg-take", "otg-take--" + v, mood(p.mood)) },
      h("span", { className: "otg-eyebrow" }, p.eyebrow || "Takeaways"),
      h(
        "ul",
        null,
        list(p.points).map(function (pt, i) {
          return h("li", { key: i }, v === "checklist" ? h(Icon, { name: "check", size: 16 }) : null, h("span", null, pt));
        })
      )
    );
  }

  function NextSteps(p) {
    return h(
      "nav",
      { className: cx("otg-next", mood(p.mood)), "aria-label": "Keep going" },
      list(p.prompts).map(function (t, i) {
        return h(
          "button",
          { key: i, type: "button", className: "otg-next-item", onClick: function () { if (p.onPick) p.onPick(t); } },
          h("span", null, t),
          h(Icon, { name: "arrow", size: 16 })
        );
      })
    );
  }

  // ---- Research ----
  function hostOf(u) {
    try {
      return new URL(u).hostname.replace(/^www\./, "");
    } catch (e) {
      return String(u || "");
    }
  }
  var MONO = ["forest", "lagoon", "berry", "clay", "graphite", "sun"];
  function Monogram(p) {
    var host = hostOf(p.url);
    var sum = 0;
    for (var i = 0; i < host.length; i++) sum += host.charCodeAt(i);
    return h("span", { className: cx("otg-mono", mood(MONO[sum % MONO.length])), "aria-hidden": "true" }, (host.charAt(0) || "?").toUpperCase());
  }

  function Activity(p) {
    var kind = p.kind || "search";
    var items = list(p.items);
    var icon = kind === "search" ? "globe" : kind === "reading" ? "book" : "spark";
    var label = p.label || (kind === "search" ? (p.live ? "Searching the web" : "Searched the web") : kind === "reading" ? (p.live ? "Reading" : "Read") : p.live ? "Thinking" : "Thought it through");
    return h(
      "details",
      { className: cx("otg-act", p.live && "is-live"), open: p.open },
      h(
        "summary",
        null,
        h(Icon, { name: icon, size: 16 }),
        h("span", { className: "otg-act-label" }, label),
        p.meta ? h("span", { className: "otg-act-meta" }, p.meta) : null,
        kind === "search" && items.length
          ? h(
              "span",
              { className: "otg-act-stack" },
              items.slice(0, 4).map(function (it, i) {
                return h(Monogram, { key: i, url: it.url });
              })
            )
          : null,
        h(Icon, { name: "chevron", size: 16, className: "otg-act-chev" })
      ),
      h(
        "div",
        { className: "otg-act-body" },
        kind === "thinking"
          ? h("p", { className: "otg-act-think" }, p.text)
          : h(
              "ul",
              null,
              items.map(function (it, i) {
                return h("li", { key: i }, h(Monogram, { url: it.url }), h("span", { className: "otg-act-title" }, it.title), h("span", { className: "otg-act-host" }, hostOf(it.url)));
              })
            )
      )
    );
  }

  function Sources(p) {
    var results = list(p.results);
    return h(
      "section",
      { className: cx("otg-sources", mood(p.mood)) },
      h("span", { className: "otg-eyebrow" }, h(Icon, { name: "search", size: 13 }), p.query ? "Sources for “" + p.query + "”" : "Sources"),
      h(
        "ol",
        { className: "otg-sources-list" },
        results.map(function (r, i) {
          return h(
            "li",
            { key: i },
            h(
              "a",
              { href: r.url, target: "_blank", rel: "noopener noreferrer", className: "otg-source" },
              h("span", { className: "otg-source-n" }, i + 1),
              h(
                "span",
                { className: "otg-source-body" },
                h("span", { className: "otg-source-site" }, h(Monogram, { url: r.url }), r.site || hostOf(r.url), r.date ? " · " + r.date : ""),
                h("strong", null, r.title),
                r.snippet ? h("span", { className: "otg-source-snip" }, r.snippet) : null
              )
            )
          );
        })
      )
    );
  }

  window.LearnOTG = Object.assign(window.LearnOTG || {}, {
    Hero: Hero,
    BigIdea: BigIdea,
    QuickAnswer: QuickAnswer,
    Flow: Flow,
    WorkedExample: WorkedExample,
    Compare: Compare,
    Analogy: Analogy,
    ConceptMap: ConceptMap,
    Layers: Layers,
    Timeline: Timeline,
    StatGrid: StatGrid,
    Scale: Scale,
    Explorable: Explorable,
    Predict: Predict,
    Quiz: Quiz,
    Recall: Recall,
    FlipCards: FlipCards,
    MythFact: MythFact,
    KeyTerms: KeyTerms,
    Takeaways: Takeaways,
    NextSteps: NextSteps,
    Activity: Activity,
    Sources: Sources,
    Button: Button,
    Chip: Chip,
    Icon: Icon
  });
  return window.LearnOTG;
}
