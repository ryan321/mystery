(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Scroll reveal
  function initReveal() {
    const reveals = document.querySelectorAll(".reveal");
    if (!reveals.length) return;

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    reveals.forEach(function (el) {
      observer.observe(el);
    });
  }

  // Manor parallax
  function initParallax() {
    const manor = document.querySelector(".manor-img");
    if (!manor || prefersReducedMotion) return;

    let ticking = false;
    function update() {
      const scrollY = window.scrollY || window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? scrollY / docHeight : 0;
      const yShift = progress * 28; // px
      manor.style.transform = `translateY(${yShift}px) scale(1.02)`;
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );

    update();
  }

  initReveal();
  initParallax();

  // Ambient audio (rain loop + thunder on lightning)
  function initAudio() {
    const toggle = document.getElementById("audio-toggle");
    const lightning = document.querySelector(".lightning");
    const manor = document.querySelector(".manor-img");
    if (!toggle) return;

    let rainAudio = null;
    let thunderAudio = null;
    let enabled = false;
    let flashTimer = null;
    let nextFlashAt = 0;

    function createAudio(src) {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      return audio;
    }

    function playThunder() {
      if (!enabled || !thunderAudio) return;
      thunderAudio.currentTime = 0;
      thunderAudio.volume = 0.55;
      const play = thunderAudio.play();
      if (play && typeof play.catch === "function") {
        play.catch(function () {
          // Ignore autoplay/policy errors
        });
      }
    }

    function triggerFlash() {
      if (!lightning) return;
      lightning.classList.remove("is-flashing");
      if (manor) manor.classList.remove("is-flashing");
      // Force reflow so the animation restarts
      void lightning.offsetWidth;
      lightning.classList.add("is-flashing");
      if (manor) manor.classList.add("is-flashing");
      playThunder();
    }

    function scheduleFlash() {
      const now = Date.now();
      const delay = enabled ? 6000 + Math.random() * 9000 : Infinity;
      nextFlashAt = now + delay;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(function () {
        triggerFlash();
        scheduleFlash();
      }, delay);
    }

    function setEnabled(on) {
      enabled = on;
      toggle.setAttribute("aria-pressed", on ? "true" : "false");
      toggle.classList.toggle("is-active", on);

      const icon = toggle.querySelector(".audio-icon");
      const label = toggle.querySelector(".audio-label");
      if (icon) icon.textContent = on ? "🔊" : "🔇";
      if (label) label.textContent = on ? "Sound on" : "Sound";
      toggle.setAttribute(
        "aria-label",
        on ? "Disable rain and thunder ambience" : "Enable rain and thunder ambience"
      );

      if (on) {
        if (!rainAudio) rainAudio = createAudio("audio/rain.mp3");
        if (!thunderAudio) thunderAudio = createAudio("audio/thunder.mp3");
        rainAudio.loop = true;
        rainAudio.volume = 0.2;
        const play = rainAudio.play();
        if (play && typeof play.catch === "function") {
          play.catch(function () {
            // Browser may block until next user gesture
          });
        }
        // Flash soon after enabling, then on a natural interval
        if (Date.now() >= nextFlashAt) {
          clearTimeout(flashTimer);
          flashTimer = setTimeout(function () {
            triggerFlash();
            scheduleFlash();
          }, 1200);
        } else {
          scheduleFlash();
        }
      } else {
        if (rainAudio) {
          rainAudio.pause();
          rainAudio.currentTime = 0;
        }
        if (thunderAudio) thunderAudio.pause();
        if (flashTimer) clearTimeout(flashTimer);
      }
    }

    toggle.addEventListener("click", function () {
      setEnabled(!enabled);
    });

    // Pause rain when the tab is hidden to be polite
    document.addEventListener("visibilitychange", function () {
      if (!enabled || !rainAudio) return;
      if (document.hidden) {
        rainAudio.pause();
      } else {
        rainAudio.play().catch(function () {});
      }
    });

    // Clean up flash animation class when it ends
    if (lightning) {
      lightning.addEventListener("animationend", function () {
        lightning.classList.remove("is-flashing");
      });
    }
    if (manor) {
      manor.addEventListener("animationend", function () {
        manor.classList.remove("is-flashing");
      });
    }
  }

  initAudio();

  // Canvas rain overlay
  const canvas = document.querySelector(".rain-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let drops = [];
    let rafId = null;
    let lastTime = 0;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.floor(rect.width * dpr);
      height = Math.floor(rect.height * dpr);
      canvas.width = width;
      canvas.height = height;
      ctx.scale(dpr, dpr);
      initDrops(rect.width, rect.height);
    }

    function initDrops(w, h) {
      const count = Math.floor((w * h) / 6500); // density
      drops = [];
      for (let i = 0; i < count; i++) {
        drops.push(createDrop(w, h, true));
      }
    }

    function createDrop(w, h, randomY) {
      const z = Math.random(); // depth 0..1
      const depth = 0.2 + z * 0.8;
      return {
        x: Math.random() * w,
        y: randomY ? Math.random() * h : -40,
        len: 8 + z * 24,
        speed: (340 + z * 460) / 1000, // px per ms
        opacity: 0.06 + z * 0.22,
        width: 0.5 + z * 1.3,
        angle: 0.12 + z * 0.07, // slight slant
      };
    }

    function draw(dt, w, h) {
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";

      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.speed * dt;
        d.x += d.speed * dt * d.angle;

        if (d.y > h + d.len || d.x > w + 20) {
          drops[i] = createDrop(w, h, false);
          continue;
        }

        const grad = ctx.createLinearGradient(d.x, d.y, d.x - d.len * d.angle, d.y - d.len);
        grad.addColorStop(0, `rgba(200, 215, 235, ${d.opacity})`);
        grad.addColorStop(1, "rgba(200, 215, 235, 0)");

        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = d.width;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.len * d.angle, d.y - d.len);
        ctx.stroke();
      }
    }

    function loop(timestamp) {
      if (!lastTime) lastTime = timestamp;
      const dt = timestamp - lastTime;
      lastTime = timestamp;

      const rect = canvas.getBoundingClientRect();
      draw(dt, rect.width, rect.height);
      rafId = requestAnimationFrame(loop);
    }

    if (!prefersReducedMotion) {
      resize();
      window.addEventListener("resize", resize);
      rafId = requestAnimationFrame(loop);

      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = null;
        } else if (!rafId) {
          lastTime = 0;
          rafId = requestAnimationFrame(loop);
        }
      });
    }
  }

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
