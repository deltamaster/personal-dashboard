(function () {
  const clockEl = document.getElementById("clock");
  const yearEl = document.getElementById("year");

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function tick() {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  function syncHeaderScrollOffset() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    document.documentElement.style.setProperty(
      "--header-height",
      `${header.getBoundingClientRect().height}px`,
    );
  }

  function getNested(obj, path) {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  function setMeta(name, content, attr) {
    const selector = attr ? `meta[${attr}="${name}"]` : `meta[name="${name}"]`;
    const el = document.querySelector(selector);
    if (el && content) el.setAttribute("content", content);
  }

  function applyI18n(lang) {
    const t = window.SITE_I18N?.[lang];
    if (!t) return;

    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

    document.title = t.meta.title;
    setMeta("description", t.meta.description);
    setMeta("og:title", t.meta.ogTitle, "property");
    setMeta("og:description", t.meta.ogDescription, "property");
    setMeta("og:locale", lang === "zh" ? "zh_CN" : "en_US", "property");
    setMeta("twitter:title", t.meta.twitterTitle);
    setMeta("twitter:description", t.meta.twitterDescription);

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const value = getNested(t, el.dataset.i18n);
      if (typeof value === "string") el.textContent = value;
    });

    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const value = getNested(t, el.dataset.i18nHtml);
      if (typeof value === "string") el.innerHTML = value;
    });

    document.querySelectorAll("[data-i18n-list]").forEach((ul) => {
      const bullets = getNested(t, ul.dataset.i18nList);
      if (!Array.isArray(bullets)) return;
      ul.innerHTML = bullets.map((item) => `<li>${item}</li>`).join("");
    });

    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, path] = pair.split(":").map((part) => part.trim());
        const value = getNested(t, path);
        if (attr && typeof value === "string") el.setAttribute(attr, value);
      });
    });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function getInitialLang() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("lang");
    if (fromUrl === "en" || fromUrl === "zh") return fromUrl;
    const stored = localStorage.getItem("site-lang");
    if (stored === "en" || stored === "zh") return stored;
    return "zh";
  }

  function setLang(lang) {
    if (lang !== "zh" && lang !== "en") return;
    localStorage.setItem("site-lang", lang);
    applyI18n(lang);

    const url = new URL(window.location.href);
    if (lang === "zh") url.searchParams.delete("lang");
    else url.searchParams.set("lang", lang);
    history.replaceState(null, "", url);
  }

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  tick();
  setInterval(tick, 1000);
  syncHeaderScrollOffset();
  window.addEventListener("resize", syncHeaderScrollOffset);

  applyI18n(getInitialLang());

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  const wechatModal = document.getElementById("wechat-modal");
  const wechatOpen = document.getElementById("wechat-open");

  function openWechatModal() {
    if (!wechatModal) return;
    wechatModal.hidden = false;
    document.body.classList.add("modal-open");
    wechatModal.querySelector(".qr-modal-close")?.focus();
  }

  function closeWechatModal() {
    if (!wechatModal) return;
    wechatModal.hidden = true;
    document.body.classList.remove("modal-open");
    wechatOpen?.focus();
  }

  wechatOpen?.addEventListener("click", openWechatModal);
  wechatModal?.querySelectorAll("[data-qr-close]").forEach((el) => {
    el.addEventListener("click", closeWechatModal);
  });
  wechatModal?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeWechatModal();
  });
})();
