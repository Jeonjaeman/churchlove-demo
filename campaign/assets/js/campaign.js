/* 교회사랑넷 데모 B · 캠페인 — 멜론 6.0 캠페인 timeline(fade·offset·onoff)을 라이브러리 없이 재구현.
   HTML 선언(data-tl·data-s·data-e) + 캐시한 기하(load·resize·fonts·본문 크기·마퀴 복제 때 잼, fade·onoff 는 IO 로 보강) + rAF 1회/프레임 + 상태가 바뀔 때만 DOM 쓰기.
   시작 상태 CSS 는 html.cb-motion 아래에만 있으므로 이 파일이 없거나 '움직임 줄이기'면 본문은 완성 상태 그대로다.
   진행률 장면(data-progress): cms = 노트북 열림 프레임 스크럽(캔버스), sermon = 영상 마스크 축소. 영상·프레임은 접근 때만. */
(function () {
  "use strict";
  var d = document, H = d.documentElement, W = window, B = d.body;
  if (W.__cbT) clearTimeout(W.__cbT);
  var mm = function (q) { return !!(W.matchMedia && W.matchMedia(q).matches); };
  var REDUCE = mm("(prefers-reduced-motion: reduce)");
  var HAS_IO = "IntersectionObserver" in W;
  if (!HAS_IO || REDUCE) H.classList.remove("cb-motion");
  var MOTION = H.classList.contains("cb-motion");
  var DESK = W.matchMedia("(min-width: 1024px)");
  var SAVE = !!(navigator.connection && navigator.connection.saveData);
  var BASE = B.getAttribute("data-base") || "";
  var HOME = B.classList.contains("page-home");
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var header = d.querySelector(".site-header"), hero = d.querySelector(".cb-hero");

  /* ---------- 서브 쪽 h1 핵심 구절(#19976c): '교회사랑넷', 없으면 마지막 낱말 — 글자는 그대로, 글자 노드만 나눔 ---------- */
  if (!HOME) $$(".page-hero h1").forEach(function (h) {
    if (h.children.length !== 0 || h.childNodes.length !== 1) return;
    var node = h.firstChild, t = node.nodeValue, i = t.indexOf("교회사랑넷"), len = 5;
    if (i < 0) { var e = t.replace(/\s+$/, ""); i = e.lastIndexOf(" ") + 1; len = e.length - i; }
    if (i <= 0 || len <= 0) return;
    var key = node.splitText(i); key.splitText(len);
    var k = d.createElement("span"); k.className = "cb-key";
    h.replaceChild(k, key); k.appendChild(key);
  });

  /* ---------- 서브 쪽 자동 태그: 원고는 그대로 두고 구성 요소에 data-tl 을 붙인다 ---------- */
  var auto = [];
  function tag(sel, cls, tl, s, extra) {
    $$(sel).forEach(function (el) {
      if (el.hasAttribute("data-tl") || el.closest("[data-tl]")) return;
      auto.push([el, cls]);
      el.classList.add(cls); el.setAttribute("data-tl", tl); el.setAttribute("data-s", s);
      if (extra) el.setAttribute(extra, "");
      if (tl === "fade") $$(":scope > *", el).forEach(function (k, i) { k.style.setProperty("--i", i); });
    });
  }
  if (MOTION) {
    tag(".cta-band", "cb-band", "fade", ".25");
    tag("main .faq .container, main .faq-group", "cb-kids", "fade", ".15");
    if (!HOME) {
      tag("main .section-head", "cb-kids", "fade", ".3");
      tag("main .section > .container > h2.section-title, main .section > .container > h2:not([class])", "cb-r", "fade", ".5");
      tag("main .check-list", "cb-pop", "fade", ".2");
      tag("main .feature-list, main .info-list, main .shot-legend, main .server-diagram, main .pf-list, main .hp-menu", "cb-kids", "fade", ".15");
      tag("main .card-grid, main .num-list", "cb-kids", "fade", ".15");
      tag("main .plan-grid", "cb-fan", "fade", ".25");
      tag("main .board-list", "cb-rows", "fade", ".2");
      tag("main .cert-grid", "cb-certs3d", "fade", ".3");
      tag("main .steps:not(.steps--compact)", "cb-steps", "offset", "0", "data-steps");
      tag("main .history-list", "cb-hist", "offset", "0", "data-steps");
      $$("main .shot, main .screen-item").forEach(function (el) {
        if (el.closest("[data-tl]")) return;
        el.classList.add("cb-shot"); el.setAttribute("data-tl", "offset"); el.setAttribute("data-s", ".05"); el.setAttribute("data-e", ".55");
      });
    }
    // 안쪽 목록이 먼저 태그된 뒤 바깥 카드 격자가 태그되면 .4×.4 로 겹친다 → 태그된 조상이 있는 자동 태그는 푼다(맨 바깥만 남김)
    auto.filter(function (a) { return a[0].parentElement.closest("[data-tl]"); }).forEach(function (a) {
      a[0].classList.remove(a[1]); ["data-tl", "data-s", "data-steps"].forEach(function (k) { a[0].removeAttribute(k); });
    });
  }
  $$("[data-stagger]").forEach(function (c) { $$(":scope > *", c).forEach(function (k, i) { k.style.setProperty("--i", i); }); });

  /* ---------- 미디어 목록(ingest.py 가 만든 media.json — 영상·프레임이 실제로 있는지) ---------- */
  var mediaP = null;
  function media() {
    if (!mediaP) mediaP = fetch(BASE + "/assets/img/cb/media.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    return mediaP;
  }

  /* ---------- 영상: 접근 때 src, 화면 밖 멈춤, 멈춤 버튼 ---------- */
  var LABEL = ["영상 멈춤", "영상 재생"];
  var groups = $$("[data-video]").map(function (el) {
    var sec = el.closest("section");
    return { el: el, v: el.querySelector("video"), id: el.getAttribute("data-video"), idm: el.getAttribute("data-video-m"),
      btn: sec && sec.querySelector(".cb-pause:not(.cb-marquee__toggle)"), loaded: false, seen: false };
  });
  function play(g) {
    if (!g.loaded || !g.seen || (g.btn && g.btn.getAttribute("aria-pressed") === "true")) return;
    var p = g.v.play(); if (p && p.catch) p.catch(function () {});
  }
  function load(g) {
    if (g.loaded || !g.v) return;
    media().then(function (m) {
      var rec = m[DESK.matches ? g.id : (g.idm || g.id)];
      if (!rec || !rec.video || g.loaded) return;
      g.loaded = true;
      g.v.addEventListener("playing", function () { g.el.classList.add("is-playing"); }, { once: true });
      g.v.src = BASE + rec.video;
      if (g.btn) g.btn.hidden = false;
      play(g);
    });
  }
  var vio = HAS_IO && new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      groups.forEach(function (g) {
        if (g.el !== e.target) return;
        g.seen = e.isIntersecting;
        if (g.seen) play(g); else if (g.loaded) g.v.pause();
      });
    });
  });
  groups.forEach(function (g) { if (vio) vio.observe(g.el); });
  $$(".cb-pause:not(.cb-marquee__toggle)").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var off = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(off)); btn.textContent = LABEL[off ? 1 : 0];
      groups.forEach(function (g) { if (g.btn === btn && g.loaded) { if (off) g.v.pause(); else play(g); } });
    });
  });
  function near(el, margin, fn) {
    if (!HAS_IO || !el) return;
    var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { o.disconnect(); fn(); } }, { rootMargin: margin + " 0px" });
    o.observe(el);
  }
  if (MOTION && !SAVE) groups.forEach(function (g) {
    var sec = g.el.closest("section");
    if (g.id === "V-01") {                       // 히어로: load + idle 뒤, 데스크톱만
      if (!DESK.matches) return;
      var go = function () { (W.requestIdleCallback || function (f) { setTimeout(f, 600); })(function () { load(g); }); };
      if (d.readyState === "complete") go(); else W.addEventListener("load", go, { once: true });
    } else if (sec && sec.id === "sermon") {     // 설교: 섹션 600px 전, 데스크톱(모바일은 세로판이 있을 때만)
      near(sec, "600px", function () { if (DESK.matches || g.idm) load(g); });
    } else near(sec, "400px", function () { load(g); });
  });

  /* ---------- 스크롤 엔진 ---------- */
  var items = $$("[data-tl]").map(function (n) {
    return { n: n, t: n.getAttribute("data-tl"), s: parseFloat(n.getAttribute("data-s")) || 0, e: parseFloat(n.getAttribute("data-e")) || 1,
      steps: n.hasAttribute("data-steps") ? $$(":scope > li", n) : null, top: 0, h: 1, st: 0, v: -1 };
  });
  var progs = $$("[data-progress]").map(function (el) { return { el: el, fn: el.getAttribute("data-progress"), top: 0, h: 1 }; });
  var ticking = false, vh = W.innerHeight, scrub = null;

  function measure() {
    var y = W.pageYOffset; vh = W.innerHeight;
    items.forEach(function (it) { var r = it.n.getBoundingClientRect(); it.top = r.top + y; it.h = r.height || 1; });
    progs.forEach(function (p) { var r = p.el.getBoundingClientRect(); p.top = r.top + y; p.h = r.height || 1; p.m = false; });
    if (scrub) sizeCanvas();
    frame();
  }
  function frame() {
    ticking = false;
    var y = W.pageYOffset;
    if (header) header.classList.toggle("is-scrolled", y > 8);
    if (hero) hero.style.setProperty("--arrow", Math.min(1, y / 160).toFixed(2));
    if (!MOTION) return;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.t === "offset") {
        var v = it.steps ? clamp((y + vh * .62 - it.top) / it.h) : clamp((y + vh - it.top - it.s * vh) / ((it.e - it.s) * vh));
        if (Math.abs(v - it.v) > .002) {
          it.v = v; it.n.style.setProperty("--p", v.toFixed(3));
          if (it.steps) it.steps.forEach(function (li, k, a) { li.classList.toggle("is-on", v >= (k + .35) / a.length); });
        }
        continue;
      }
      if (!it.st && y + vh - it.top >= it.s * Math.min(it.h, vh)) fire(it);
    }
    progs.forEach(function (p) { if (handlers[p.fn]) handlers[p.fn](p, clamp((y - p.top) / Math.max(1, p.h - vh))); });
  }
  function fire(it) {                         // fade·onoff 는 한 번만(되돌아가도 다시 흐리게 하지 않음)
    if (it.st) return;
    it.st = 1;
    it.n.classList.add(it.t === "onoff" ? "is-play" : "is-in");
    if (it.n.hasAttribute("data-count")) countUp(it.n);
  }
  function onScroll() { if (!ticking) { ticking = true; W.requestAnimationFrame(frame); } }
  /* 보강: 캐시한 기하가 낡아도(높이 변화·부드러운 스크롤) 화면 아래 25% 선을 넘으면 IO 가 켠다 */
  if (MOTION && HAS_IO) {
    var once = items.filter(function (it) { return it.t !== "offset"; });
    var fio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        fio.unobserve(e.target);
        once.forEach(function (it) { if (it.n === e.target) fire(it); });
      });
    }, { rootMargin: "0px 0px -25% 0px" });
    once.forEach(function (it) { fio.observe(it.n); });
  }

  /* ---------- 진행률 장면 ---------- */
  var handlers = {
    cms: function (p, r) {          // 관리 시스템: 0→.6 노트북 열림(프레임), .6 넘으면 화면 캡처·카드 3장
      if (!DESK.matches) return;
      p.el.classList.toggle("is-open", r >= .6);
      if (scrub && scrub.ready) drawFrame(Math.round(clamp(r / .6) * (scrub.n - 1)));
    },
    sermon: function (p, r) {       // 설교방송: .25 에서 태블릿 화면 자리로 축소(도착 사각형은 처음·리사이즈 때 잰다)
      var on = DESK.matches && r >= .25;
      if (on && !p.m) { measureSermon(p.el); p.m = true; }
      p.el.classList.toggle("is-shrunk", on);
    }
  };
  function measureSermon(sec) {
    var st = sec.querySelector(".cb-sermon__stage").getBoundingClientRect();
    var sc = sec.querySelector(".cb-sermon__screen").getBoundingClientRect();
    var l = sc.left - st.left, t = sc.top - st.top, set = function (k, v) { sec.style.setProperty(k, v.toFixed(1) + "px"); };
    set("--cl", l); set("--ct", t); set("--cr", st.width - l - sc.width); set("--cb", st.height - t - sc.height);
    set("--sw", sc.width); set("--sh", sc.height);
    set("--tx", l + sc.width / 2 - st.width / 2); set("--ty", t + sc.height / 2 - st.height / 2);   // 화면 가운데로 옮긴 뒤 cover 배율
    sec.style.setProperty("--cs", Math.max(sc.width / st.width, sc.height / st.height).toFixed(4));
  }

  /* 노트북 프레임 스크럽: 데스크톱·Save-Data 아님, 섹션 800px 전에 0·끝 → 가운데 → … 이분 순서로 */
  function sizeCanvas() {
    var c = scrub.c, r = c.getBoundingClientRect(), k = Math.min(W.devicePixelRatio || 1, 2);
    var w = Math.round(r.width * k), h = Math.round(r.height * k);
    if (w && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; scrub.last = scrub.drawn = -1; }
  }
  function drawFrame(idx) {
    if (idx === scrub.last) return;
    var best = -1, im = scrub.img;
    for (var k = 0; k < scrub.n && best < 0; k++) {
      if (im[idx - k] && im[idx - k].ok) best = idx - k;
      else if (im[idx + k] && im[idx + k].ok) best = idx + k;
    }
    scrub.last = idx;
    if (best < 0 || best === scrub.drawn) return;
    scrub.ctx.drawImage(im[best], 0, 0, scrub.c.width, scrub.c.height);
    scrub.drawn = best;
  }
  function order(n) {
    var out = [0, n - 1], seen = {}, q = [[0, n - 1]];
    seen[0] = seen[n - 1] = 1;
    while (q.length) {
      var a = q.shift(), m = (a[0] + a[1]) >> 1;
      if (!seen[m]) { seen[m] = 1; out.push(m); }
      if (m - a[0] > 1) q.push([a[0], m]);
      if (a[1] - m > 1) q.push([m, a[1]]);
    }
    return out;
  }
  var cms = d.querySelector(".cb-cms");
  if (MOTION && !SAVE && cms && DESK.matches) near(cms, "800px", function () {
    media().then(function (m) {
      var n = m["V-06"] && m["V-06"].frames;
      if (!n) return;
      var c = cms.querySelector(".cb-cms__canvas");
      scrub = { c: c, ctx: c.getContext("2d"), n: n, img: [], last: -1, drawn: -1, ready: false };
      sizeCanvas();
      var q = order(n);
      var next = function () {
        if (!q.length) return;
        var i = q.shift(), im = new Image();
        im.decoding = "async";
        im.onload = function () {
          im.ok = true;
          if (!scrub.ready && scrub.img[0] && scrub.img[0].ok && scrub.img[n - 1] && scrub.img[n - 1].ok) {
            scrub.ready = true; cms.classList.add("is-frames");
          }
          if (scrub.ready) { scrub.last = -1; frame(); }
          next();
        };
        im.onerror = next;
        im.src = BASE + "/assets/img/cb/cb-scrub/f" + ("00" + i).slice(-3) + ".webp";
        scrub.img[i] = im;
      };
      next(); next(); next();
    });
  });

  /* ---------- 26 카운트업(한 번, 최종값은 HTML) ---------- */
  function countUp(el) {
    var to = parseInt(el.getAttribute("data-count"), 10), from = parseInt(el.getAttribute("data-from"), 10) || 0, t0 = null;
    if (isNaN(to)) return;
    el.textContent = from;
    W.requestAnimationFrame(function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / 900);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) W.requestAnimationFrame(step);
    });
  }

  /* ---------- 포트폴리오 2줄 마퀴: 원본 목록 그대로 + aria-hidden 복제(링크 포커스 제외, h3 → div) ---------- */
  function ghost(node) {
    var c = node.cloneNode(true);
    c.setAttribute("aria-hidden", "true");
    $$("a", c).forEach(function (a) { a.setAttribute("tabindex", "-1"); });
    $$("h3", c).forEach(function (h) {
      var x = d.createElement("div"); x.className = "cb-h3";
      while (h.firstChild) x.appendChild(h.firstChild);
      h.replaceWith(x);
    });
    return c;
  }
  if (MOTION && DESK.matches) $$("[data-marquee]").forEach(function (mq) { near(mq, "900px", function () {   // 복제 그림을 일찍 받지 않게 접근 때
    var row = mq.querySelector(".cb-marquee__row"), track = row.querySelector(".cb-marquee__track"), list = track.querySelector("ul");
    track.append(ghost(list));                 // 원본 + 복제 1 = 2벌(-50% 이동), 둘째 줄은 2벌 모두 복제
    var row2 = ghost(row);
    row2.classList.add("cb-marquee__row--rev");
    $$("ul", row2).forEach(function (u) { for (var i = 0; i < 3; i++) u.appendChild(u.firstElementChild); });
    row.after(row2);
    mq.classList.add("is-running");
    W.requestAnimationFrame(measure);          // 둘째 줄만큼 쪽이 길어졌으니 아래 섹션 기하를 다시 잰다
    var btn = mq.querySelector(".cb-marquee__toggle");
    if (btn) {
      btn.hidden = false;
      btn.addEventListener("click", function () {
        var off = !mq.classList.contains("is-paused");
        mq.classList.toggle("is-paused", off); btn.setAttribute("aria-pressed", String(off));
        btn.textContent = off ? "흐름 재생" : "흐름 멈춤";
      });
    }
    new IntersectionObserver(function (es) { mq.classList.toggle("is-off", !es[0].isIntersecting); }).observe(mq);
  }); });

  /* ---------- FAQ 쪽: 주제 칩 중 지금 읽는 주제 ---------- */
  var topics = $$('main .related-links a[href^="#"]');
  if (HAS_IO && topics.length && d.querySelector(".faq-group[id]")) {
    var tio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) topics.forEach(function (a) { a.classList.toggle("is-current", a.getAttribute("href") === "#" + e.target.id); });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    $$(".faq-group[id]").forEach(function (g) { tio.observe(g); });
  }

  /* ---------- 히어로 무대 포인터 기울기(정밀 포인터만, 최대 ±4°) ---------- */
  var stage = hero && hero.querySelector(".cb-hero__media");
  if (MOTION && stage && mm("(pointer: fine)")) hero.addEventListener("pointermove", function (e) {
    var r = hero.getBoundingClientRect();
    stage.style.setProperty("--ry", (((e.clientX - r.left) / r.width - .5) * 8).toFixed(2) + "deg");
    stage.style.setProperty("--rx", ((.5 - (e.clientY - r.top) / r.height) * 5).toFixed(2) + "deg");
  });

  /* ---------- 시작 ---------- */
  W.addEventListener("scroll", onScroll, { passive: true });
  var rt;
  W.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(measure, 120); });
  W.addEventListener("load", measure);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(measure);
  if ("ResizeObserver" in W) {
    var rq = false;
    new ResizeObserver(function () { if (!rq) { rq = true; W.requestAnimationFrame(function () { rq = false; measure(); }); } }).observe(B);
  }
  measure();
})();
