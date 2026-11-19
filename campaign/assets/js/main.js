// GEO 리뉴얼 공통 — 모바일 메뉴 토글 (본문 콘텐츠는 JS 없이도 모두 보인다)
(function () {
  "use strict";

  document.documentElement.classList.remove("no-js");

  var toggle = document.querySelector(".nav-toggle");
  var gnb = document.getElementById("gnb");
  if (toggle && gnb) {
    toggle.addEventListener("click", function () {
      var open = gnb.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector(".visually-hidden").textContent = open ? "메뉴 닫기" : "메뉴 열기";
    });
  }

  document.querySelectorAll(".gnb__sub-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var sub = btn.parentElement.querySelector(".gnb__sub");
      if (!sub) return;
      var open = sub.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && gnb && gnb.classList.contains("is-open")) {
      gnb.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }
  });
})();
