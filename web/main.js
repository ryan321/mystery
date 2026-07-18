(function () {
  // Waitlist
  const form = document.getElementById("waitlist-form");
  const status = document.getElementById("form-status");
  const storageKey = "mystery_waitlist_emails";

  if (form && status) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const input = form.querySelector('input[name="email"]');
      const email = (input && input.value ? input.value : "").trim().toLowerCase();

      status.hidden = false;
      status.classList.remove("error");

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        status.textContent = "Enter a valid email so we can send the free case.";
        status.classList.add("error");
        return;
      }

      let list = [];
      try {
        list = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [];
      }

      if (!list.includes(email)) {
        list.push(email);
        localStorage.setItem(storageKey, JSON.stringify(list));
      }

      status.textContent =
        "You’re on the list. We’ll email you when the free case is ready.";
      form.reset();
    });
  }

  // Sample play tabs
  const demo = document.querySelector("[data-play-demo]");
  if (!demo) return;

  const tabs = Array.from(demo.querySelectorAll("[data-tab]"));
  const panels = Array.from(demo.querySelectorAll("[data-panel]"));

  function activate(name) {
    tabs.forEach(function (tab) {
      const on = tab.getAttribute("data-tab") === name;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
    });

    panels.forEach(function (panel) {
      const on = panel.getAttribute("data-panel") === name;
      panel.classList.toggle("is-active", on);
      if (on) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      activate(tab.getAttribute("data-tab"));
    });
  });
})();
