(function () {
  const form = document.getElementById("waitlist-form");
  const status = document.getElementById("form-status");
  const storageKey = "mystery_waitlist_emails";

  if (!form || !status) return;

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

    // Hook for real backend later (Formspree, API, etc.)
    // fetch("/api/waitlist", { method: "POST", body: JSON.stringify({ email }) })

    status.textContent =
      "You’re on the list. We’ll email you when the free case is ready.";
    form.reset();
  });
})();
