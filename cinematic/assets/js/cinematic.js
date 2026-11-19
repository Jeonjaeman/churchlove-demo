// 데모 A · 시네마틱 — 라이브러리 없는 연출 레이어 (defer).
// 원칙: 본문은 JS 없이도 모두 보인다. 이 파일은 클래스를 붙여 연출을 "켜기"만 하고, 글자는 만들지 않는다
// (예외: 기능 탭 라벨 = h3 복제, 서브 LNB = <main> 밖 내비).
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var body = doc.body;
  var base = (body && body.getAttribute("data-base")) || "";
  var mq = function (q) { return window.matchMedia(q); };
  var reduce = mq("(prefers-reduced-motion: reduce)");
  var narrow = mq("(max-width: 860px)");
  var finePointer = mq("(hover: hover) and (pointer: fine)");
  var seqRoom = mq("(min-width: 861px) and (min-height: 700px)");
  var conn = navigator.connection;
  var saveData = !!(conn && conn.saveData);

  function all(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function onChange(m, fn) { if (m.addEventListener) m.addEventListener("change", fn); else if (m.addListener) m.addListener(fn); }
  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }
  function pathOf(href) {
    var a = doc.createElement("a");
    a.href = href;
    var p = a.pathname;
    if (base && p.indexOf(base) === 0) p = p.slice(base.length) || "/";
    return p;
  }
  var here = pathOf(location.href);
  var motionOK = function () { return !reduce.matches; };

  root.classList.remove("no-js");

  // ---------- 헤더: 스크롤 8px↑ 면 선 + 그림자, 현재 1단 표시 ----------
  function initHeader() {
    var header = doc.querySelector(".site-header");
    if (!header) return;
    var on = false;
    function check() {
      var next = window.scrollY > 8;
      if (next !== on) { on = next; header.classList.toggle("is-scrolled", on); }
    }
    window.addEventListener("scroll", check, { passive: true });
    check();
  }

  // ---------- 메가 패널 키보드(1101px↑): 포커스만으로는 열지 않는다(CSS 가 :hover·.is-open 에만 연다) →
  // Tab 은 1단끼리만 지나가고, ↓ 로 열어 첫 하위 링크로, Esc 로 닫고 1단으로 돌아온다. 패널 밖으로 나가면 닫힘 ----------
  function initMega() {
    var wide = mq("(min-width: 1101px)");
    all(".gnb__item").forEach(function (item) {
      var link = item.querySelector(".gnb__link");
      var sub = item.querySelector(".gnb__sub");
      if (!link || !sub) return;
      link.addEventListener("keydown", function (e) {
        if (!wide.matches || e.key !== "ArrowDown") return;
        e.preventDefault();
        item.classList.add("is-open");
        var first = sub.querySelector("a");
        if (first) first.focus();   // 바로(rAF 를 기다리면 화면이 안 그려지는 탭에서 포커스가 늦음). focus() 가 스타일을 새로 계산하므로 visible 상태에서 잡힌다
      });
      item.addEventListener("keydown", function (e) {
        if (e.key !== "Escape" || !item.classList.contains("is-open")) return;
        e.stopPropagation();
        item.classList.remove("is-open");
        link.focus();
      });
      item.addEventListener("focusout", function (e) {
        if (!item.contains(e.relatedTarget)) item.classList.remove("is-open");
      });
    });
  }

  // 현재 쪽이 속한 GNB 1단 (자기 링크 또는 하위 링크가 경로 앞부분과 같은 것 중 가장 긴 것)
  function currentItem() {
    if (here === "/") return null;
    var best = null;
    var bestLen = 0;
    all(".gnb__item").forEach(function (li) {
      all("a", li).forEach(function (a) {
        var p = pathOf(a.href);
        var external = a.host !== location.host;
        if (external || a.getAttribute("href").indexOf("#") >= 0 || p === "/") return;
        if (here.indexOf(p) === 0 && p.length > bestLen) { best = li; bestLen = p.length; }
      });
    });
    return best;
  }

  // ---------- 서브 LNB: <main> 밖, 헤더 아래 sticky (삼성 I19) ----------
  var INST = [["/institutions/", "기관 홈페이지"], ["/institutions/presbytery/", "노회"], ["/institutions/general-assembly/", "총회·교단·연회"],
    ["/institutions/seminary/", "신학교·신학대학"], ["/institutions/graduate-school/", "신학대학원"], ["/institutions/mission/", "선교단체·선교회"],
    ["/institutions/council/", "교회 연합회·협의회"], ["/institutions/christian-school/", "기독교 학교·대안학교"], ["/institutions/prayer-retreat/", "기도원·수련원"]];

  function initLnb(item) {
    var main = doc.getElementById("main");
    var header = doc.querySelector(".site-header");
    if (!main || !header || here === "/") return;
    var links = [];
    if (here.indexOf("/institutions/") === 0) {
      links = INST.map(function (x) { return { href: base + x[0], label: x[1], path: x[0] }; });
    } else if (item && item.querySelector(".gnb__sub")) {
      // 같은 쪽 안 앵커(/about/#history 등)는 현재 쪽 표시에서 뺀다 — 안 그러면 회사소개 LNB 4칸이 모두 현재로 잡힘
      links = all(".gnb__sub a", item).map(function (a) { return { href: a.getAttribute("href"), label: a.textContent, path: a.hash ? null : pathOf(a.href) }; });
    }
    var anchors = false;
    if (links.length < 2) {
      links = all("main section[id]").map(function (s) {
        var h = s.querySelector("h2:not(.visually-hidden)");
        return h ? { href: "#" + s.id, label: h.textContent.trim(), path: null, el: s } : null;
      }).filter(Boolean);
      anchors = true;
    }
    if (links.length < 2) return;
    var nav = doc.createElement("nav");
    nav.className = "cine-lnb";
    nav.setAttribute("aria-label", anchors ? "이 쪽 목차" : "하위 메뉴");
    var ul = doc.createElement("ul");
    links.forEach(function (l) {
      var li = doc.createElement("li");
      var a = doc.createElement("a");
      a.href = l.href;
      a.textContent = l.label;
      if (l.path && l.path === here) a.setAttribute("aria-current", "page");
      l.a = a;
      li.appendChild(a);
      ul.appendChild(li);
    });
    nav.appendChild(ul);
    header.parentNode.insertBefore(nav, header.nextSibling);
    body.classList.add("has-lnb");
    var cur = nav.querySelector("[aria-current]");
    if (cur && ul.scrollWidth > ul.clientWidth) ul.scrollLeft = cur.offsetLeft - (ul.clientWidth - cur.offsetWidth) / 2;
    if (anchors && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (l) { l.a.classList.toggle("is-active", l.el === e.target); });
        });
      }, { rootMargin: "-30% 0px -60% 0px" });
      links.forEach(function (l) { io.observe(l.el); });
    }
  }

  // ---------- 1 히어로: load 뒤 데스크톱만 영상, 3칸 진행 바, 일시정지, 화면 밖 정지 ----------
  function initHero() {
    var hero = doc.querySelector("[data-hero]");
    var video = hero && hero.querySelector(".cine-hero__video");
    if (!video || !video.getAttribute("data-src") || reduce.matches || narrow.matches || saveData) return;
    var bars = all(".cine-hero__bar i", hero);
    var btn = hero.querySelector(".cine-hero__pause");
    var userPaused = false;
    var inView = true;
    var failed = false;
    var raf = 0;

    function paint() {
      raf = 0;
      if (video.duration) {
        var p = (video.currentTime / video.duration) * bars.length;
        bars.forEach(function (b, i) { b.style.transform = "scaleX(" + clamp01(p - i).toFixed(4) + ")"; });
      }
      if (!video.paused) raf = requestAnimationFrame(paint);
    }
    function fail() {
      if (failed) return;
      failed = true;
      hero.classList.remove("is-video");
      video.classList.remove("is-playing");
      video.pause();
      bars.forEach(function (b) { b.style.transform = ""; });
      if (btn) btn.hidden = true;
    }
    function sync() {
      if (failed) return;
      if (!userPaused && inView && !reduce.matches) {
        var pr = video.play();
        if (pr && pr.catch) pr.catch(fail);
      } else {
        video.pause();
      }
    }
    video.addEventListener("playing", function () {
      video.classList.add("is-playing");
      hero.classList.add("is-video");
      if (btn) btn.hidden = false;
      if (!raf) raf = requestAnimationFrame(paint);
    });
    video.addEventListener("error", fail);
    if (btn) {
      // 이름("영상 멈춤")은 고정하고 상태는 aria-pressed 하나로만 알린다(둘 다 바꾸면 화면낭독기가 상태를 두 번 읽음)
      btn.addEventListener("click", function () {
        userPaused = !userPaused;
        btn.setAttribute("aria-pressed", String(userPaused));
        sync();
      });
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; sync(); }).observe(hero);
    }
    onChange(reduce, sync);
    video.src = video.getAttribute("data-src");
    sync();
  }

  // ---------- 섹션 배경 영상(설교방송): 데스크톱·화면 접근 시에만 src, 보일 때만 재생, 멈춤 버튼(WCAG 2.2.2) ----------
  function initBgVideos() {
    if (!("IntersectionObserver" in window)) return;
    all("[data-bgv]").forEach(function (sec) {
      var video = sec.querySelector("video[data-src]");
      if (!video) return;
      var btn = sec.querySelector(".cine-vbtn");
      var loaded = false;
      var visible = false;
      var userPaused = false;
      function ok() { return !reduce.matches && !narrow.matches && !saveData; }
      function sync() {
        if (btn && !ok()) btn.hidden = true;
        if (visible && ok() && !userPaused) {
          if (!loaded) { loaded = true; video.src = video.getAttribute("data-src"); }
          var pr = video.play();
          if (pr && pr.catch) pr.catch(function () { video.classList.remove("is-playing"); });
        } else if (loaded) {
          video.pause();
        }
      }
      video.addEventListener("playing", function () { video.classList.add("is-playing"); if (btn) btn.hidden = false; });
      if (btn) {
        btn.addEventListener("click", function () {
          userPaused = !userPaused;
          btn.setAttribute("aria-pressed", String(userPaused));
          sync();
        });
      }
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); }, { rootMargin: "200px 0px" }).observe(sec);
      onChange(reduce, sync);
      onChange(narrow, sync);
    });
  }

  // ---------- 5 관리 시스템: 번호 목록 hover·click → 겹친 캡처 교체 ----------
  function initCms() {
    var box = doc.querySelector("[data-cms]");
    if (!box) return;
    var lis = all(".cine-cms__list > li", box);
    var imgs = all(".cine-cms__screens img", box);
    if (lis.length < 2 || imgs.length < 2) return;
    function set(i) {
      lis.forEach(function (li, k) { li.classList.toggle("is-active", k === i); });
      imgs.forEach(function (im, k) { im.classList.toggle("is-active", k === Math.min(i, imgs.length - 1)); });
    }
    lis.forEach(function (li, i) {
      li.addEventListener("mouseenter", function () { set(i); });
      li.addEventListener("click", function () { set(i); });
    });
    box.closest("section").classList.add("is-ready");
    set(0);
  }

  // ---------- 7 앱: 포인터 틸트 (데스크톱·정밀 포인터만, 최대 6°) ----------
  function initTilt() {
    all("[data-tilt]").forEach(function (box) {
      var card = box.querySelector(".cine-tilt__card");
      if (!card) return;
      var raf = 0;
      var ev = null;
      function apply() {
        raf = 0;
        if (!ev) return;
        var r = box.getBoundingClientRect();
        var x = clamp01((ev.clientX - r.left) / r.width) - 0.5;
        var y = clamp01((ev.clientY - r.top) / r.height) - 0.5;
        card.style.setProperty("--ry", (x * 12).toFixed(2) + "deg");
        card.style.setProperty("--rx", (-y * 12).toFixed(2) + "deg");
      }
      box.addEventListener("pointermove", function (e) {
        if (!finePointer.matches || reduce.matches || narrow.matches) return;
        ev = e;
        box.classList.add("is-tilting");
        if (!raf) raf = requestAnimationFrame(apply);
      });
      box.addEventListener("pointerleave", function () {
        ev = null;
        box.classList.remove("is-tilting");
        card.style.removeProperty("--rx");
        card.style.removeProperty("--ry");
      });
    });
  }

  // ---------- 9 기능 8카드 → ARIA 텍스트 탭 (←→ Home End, 비활성 패널 inert) ----------
  function initTabs() {
    var list = doc.querySelector("[data-feat]");
    if (!list) return;
    var items = all(".cine-feat__item", list);
    if (items.length < 2) return;
    var tablist = doc.createElement("div");
    tablist.className = "cine-tabs";
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "기능 선택");
    var tabs = items.map(function (li, i) {
      var h = li.querySelector("h3");
      var tab = doc.createElement("button");
      tab.type = "button";
      tab.className = "cine-tab";
      tab.id = "cine-tab-" + i;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", "cine-panel-" + i);
      tab.textContent = h ? h.textContent.trim() : String(i + 1);
      li.id = "cine-panel-" + i;
      li.setAttribute("role", "tabpanel");
      li.setAttribute("aria-labelledby", tab.id);
      tab.addEventListener("click", function () { select(i, false); });
      tablist.appendChild(tab);
      return tab;
    });
    function keepVisible(tab) {
      if (tablist.scrollWidth <= tablist.clientWidth) return;
      tablist.scrollTo({ left: tab.offsetLeft - (tablist.clientWidth - tab.offsetWidth) / 2, behavior: reduce.matches ? "auto" : "smooth" });
    }
    function select(i, focus) {
      tabs.forEach(function (tab, k) {
        var on = k === i;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        items[k].classList.toggle("is-active", on);
        items[k].inert = !on;
      });
      if (focus) tabs[i].focus();
      keepVisible(tabs[i]);
    }
    tablist.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(doc.activeElement);
      if (i < 0) return;
      var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
      if (n === null) return;
      e.preventDefault();
      select((n + tabs.length) % tabs.length, true);
    });
    list.parentNode.insertBefore(tablist, list);
    list.classList.add("is-tabs");
    // 목록이 더는 목록이 아니므로(탭 패널) 목록 역할을 뗀다
    list.setAttribute("role", "presentation");
    select(0, false);
  }

  // ---------- 11 7단계: 스크롤 진행률 → 캔버스 프레임(64장) + 단계 활성 + 진행 바 ----------
  function initSequence() {
    var sec = doc.querySelector("[data-seq]");
    if (!sec) return;
    var track = sec.querySelector(".cine-process__track");
    var stage = sec.querySelector(".cine-process__stage");
    var media = sec.querySelector(".cine-process__media");
    var steps = all(".steps > li", sec);
    var bar = sec.querySelector(".cine-process__progress i");
    if (!track || !stage || !media || !steps.length) return;
    var COUNT = 64;
    var dir = media.getAttribute("data-src") || "";
    var frames = [];
    var started = false;
    var canvas = null;
    var ctx = null;
    var enabled = false;
    var listening = false;
    var raf = 0;
    var stickTop = 0;
    var lastFrame = -1;
    var lastDrawn = null;
    var lastStep = -1;
    var canDraw = !!doc.createElement("canvas").getContext;

    function frameUrl(n) { return dir + ("000" + n).slice(-4) + ".webp"; }
    function progress() {
      var r = track.getBoundingClientRect();
      var span = r.height - stage.offsetHeight;
      return span > 0 ? clamp01((stickTop - r.top) / span) : 0;
    }
    function nearest(idx) {
      if (frames[idx]) return frames[idx];
      for (var d = 1; d < COUNT; d++) {
        if (frames[idx - d]) return frames[idx - d];
        if (frames[idx + d]) return frames[idx + d];
      }
      return null;
    }
    function draw(idx) {
      if (!ctx) return;
      var im = nearest(idx);
      if (!im || im === lastDrawn) return;
      ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
      lastDrawn = im;
      canvas.classList.add("is-ready");
    }
    function load(n, next) {
      var im = new Image();
      im.decoding = "async";
      im.onload = function () {
        frames[n - 1] = im;
        if (enabled) draw(lastFrame < 0 ? 0 : lastFrame);
        if (next) next();
      };
      im.src = frameUrl(n);
    }
    function preload() {
      if (started || !dir) return;
      started = true;
      load(1, function () { for (var n = 2; n <= COUNT; n++) load(n); });
    }
    function update() {
      raf = 0;
      if (!enabled) return;
      var p = progress();
      if (bar) bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
      var k = Math.min(steps.length - 1, Math.floor(p * steps.length));
      if (k !== lastStep) {
        lastStep = k;
        steps.forEach(function (s, j) { s.classList.toggle("is-active", j === k); });
      }
      var f = Math.round(p * (COUNT - 1));
      if (f !== lastFrame) { lastFrame = f; draw(f); }
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
    function listen(on) {
      if (on === listening) return;
      listening = on;
      if (on) window.addEventListener("scroll", onScroll, { passive: true });
      else window.removeEventListener("scroll", onScroll);
    }
    function measure() { stickTop = parseFloat(window.getComputedStyle(stage).top) || 0; onScroll(); }
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
      var near = entries[0].isIntersecting;
      if (near) preload();
      listen(near);
      if (near) onScroll();
    }, { rootMargin: "1000px 0px" }) : null;

    function enable() {
      if (enabled) return;
      enabled = true;
      sec.classList.add("is-seq");
      if (!canvas) {
        canvas = doc.createElement("canvas");
        canvas.width = 960;
        canvas.height = 540;
        canvas.setAttribute("aria-hidden", "true");
        ctx = canvas.getContext("2d");
        media.appendChild(canvas);
      }
      lastDrawn = null;
      lastFrame = -1;
      measure();
      if (io) io.observe(sec); else { preload(); listen(true); }
      window.addEventListener("resize", measure, { passive: true });
    }
    function disable() {
      if (!enabled) return;
      enabled = false;
      sec.classList.remove("is-seq");
      if (io) io.unobserve(sec);
      listen(false);
      window.removeEventListener("resize", measure);
      steps.forEach(function (s) { s.classList.remove("is-active"); });
      lastStep = -1;
    }
    function apply() { if (canDraw && motionOK() && seqRoom.matches) enable(); else disable(); }
    apply();
    onChange(reduce, apply);
    onChange(seqRoom, apply);
  }

  // ---------- 전역 리빌: 첫 화면 아래 요소가 화면에 들어오는 순간에만 .4 → 1 + 32px (미리 숨기지 않음) ----------
  function initReveal() {
    if (reduce.matches || !("IntersectionObserver" in window)) return;
    var sel = [
      ".section-head", ".cine-intro .definition", ".cine-cube > li", ".included-grid > li", ".cine-cms__media", ".cine-cms__copy",
      ".cine-sermon__copy", ".cine-sermon__shot", ".cine-tilt", ".cine-window", ".cine-form .steps > li", ".cine-tabs",
      ".table-wrap", ".card-grid > li", ".cine-inst__band", ".cine-cubes > div", ".board-list > li", ".faq-item",
      ".cta-band__inner > *", ".feature-list > div", ".check-list > li", ".plan-grid > li", ".shot", ".screen-item",
      ".history-list > li", ".device-figure", ".num-list > li", ".info-list > div"
    ].join(",");
    // getBoundingClientRect 로 고르지 않는다(긴 쪽 전체 강제 레이아웃 방지): 첫 콜백에서 이미 보이는 요소는 연출 없이 뺀다
    var els = all(sel).filter(function (el) { return !el.closest(".cine-hero, .page-hero, .cine-process, [data-feat], .cine-lnb"); });
    var first = true;
    var io = new IntersectionObserver(function (entries) {
      var initial = first;
      first = false;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        if (initial) return;
        var parent = el.parentElement;
        var idx = parent ? Array.prototype.indexOf.call(parent.children, el) % 4 : 0;
        if (idx > 0) el.style.setProperty("--rd", idx * 80 + "ms");
        el.classList.add("rv-in");
        el.addEventListener("animationend", function done(ev) {
          if (ev.target !== el) return;
          el.removeEventListener("animationend", done);
          el.classList.remove("rv-in");
          el.style.removeProperty("--rd");
        });
      });
    });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---------- 맨 위로: 위로 스크롤 + 300px 지남에만 (삼성 FAB) ----------
  function initTop() {
    var btn = doc.querySelector(".cine-top");
    if (!btn) return;
    btn.hidden = false;
    var lastY = window.scrollY;
    var on = false;
    var raf = 0;
    function check() {
      raf = 0;
      var y = window.scrollY;
      var next = y > 300 && y < lastY;
      if (Math.abs(y - lastY) > 4) lastY = y;
      if (next !== on) { on = next; btn.classList.toggle("is-on", on); }
    }
    window.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(check); }, { passive: true });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduce.matches ? "auto" : "smooth" });
      var skip = doc.querySelector(".skip-link");
      if (skip) skip.focus({ preventScroll: true });
    });
  }

  // ---------- 줄바꿈 보정: "55,000원~," "9시~12시" 의 ~ 앞에서 줄이 갈리지 않게 엔진과 같은 span.nobr 로 묶는다 ----------
  // (글자는 그대로. 엔진 korean_wrap 은 + > 만 묶고 ~ 는 묶지 않음 — 엔진 보강 전 임시. FAQ 답만 대상)
  function initGlue() {
    all(".faq-answer p").forEach(function (p) {
      var walker = doc.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      var nodes = [];
      while (walker.nextNode()) if (walker.currentNode.nodeValue.indexOf("~") >= 0 && !walker.currentNode.parentNode.closest(".nobr")) nodes.push(walker.currentNode);
      nodes.forEach(function (t) {
        var frag = doc.createDocumentFragment();
        t.nodeValue.split(/(\S*~\S*)/).forEach(function (part, i) {
          if (!part) return;
          if (i % 2) {
            var s = doc.createElement("span");
            s.className = "nobr";
            s.textContent = part;
            frag.appendChild(s);
          } else {
            frag.appendChild(doc.createTextNode(part));
          }
        });
        t.parentNode.replaceChild(frag, t);
      });
    });
  }

  function start() {
    // 첫 화면에 닿는 것만 바로(헤더·현재 메뉴·LNB), 나머지 연출은 첫 그림(LCP) 뒤 한가할 때 — 저속 CPU 에서 긴 작업이 LCP 를 막지 않게
    initHeader();
    initMega();
    var item = currentItem();
    if (item) item.classList.add("is-current");
    initLnb(item);
    initTop();
    var later = function () {
      initGlue();
      initCms();
      initTilt();
      initTabs();
      initSequence();
      initBgVideos();
      initReveal();
    };
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 1); };
    requestAnimationFrame(function () { setTimeout(function () { idle(later, { timeout: 1200 }); }, 0); });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start);
  else start();
  // 히어로 영상은 페이지 load 이후에만 받는다 (LCP = 포스터)
  if (doc.readyState === "complete") initHero();
  else window.addEventListener("load", initHero);
})();
