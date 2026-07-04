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

  yearEl.textContent = String(new Date().getFullYear());
  tick();
  setInterval(tick, 1000);
})();
