(function () {
  const clockEl = document.getElementById("clock");
  const yearEl = document.getElementById("year");

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function tick() {
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

  yearEl.textContent = String(new Date().getFullYear());
  tick();
  setInterval(tick, 1000);
  syncHeaderScrollOffset();
  window.addEventListener("resize", syncHeaderScrollOffset);
})();
