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

    const THUNDER_VARIANTS = [
      "audio/thunder-1.mp3",
      "audio/thunder-2.mp3",
      "audio/thunder-3.mp3",
      "audio/thunder-4.mp3",
    ];

    let rainAudio = null;
    let thunderAudios = [];
    let enabled = false;
    let flashTimer = null;
    let nextFlashAt = 0;
    let autoplayFailed = false;

    const RAIN_VOLUME = 0.5;
    const THUNDER_VOLUME = 0.75;

    function createAudio(src) {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      return audio;
    }

    function getThunderAudio() {
      if (thunderAudios.length === 0) {
        thunderAudios = THUNDER_VARIANTS.map(createAudio);
      }
      const idx = Math.floor(Math.random() * thunderAudios.length);
      return thunderAudios[idx];
    }

    function playThunder() {
      if (!enabled) return;
      const audio = getThunderAudio();
      audio.currentTime = 0;
      audio.volume = THUNDER_VOLUME;
      const play = audio.play();
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
      const delay = enabled ? 5000 + Math.random() * 7000 : Infinity;
      nextFlashAt = Date.now() + delay;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(function () {
        triggerFlash();
        scheduleFlash();
      }, delay);
    }

    function updateToggleUI(on) {
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
    }

    function setEnabled(on) {
      enabled = on;
      updateToggleUI(on);

      if (on) {
        if (!rainAudio) rainAudio = createAudio("audio/rain.mp3");
        if (thunderAudios.length === 0) {
          thunderAudios = THUNDER_VARIANTS.map(createAudio);
        }
        rainAudio.loop = true;
        rainAudio.volume = RAIN_VOLUME;
        const play = rainAudio.play();
        if (play && typeof play.catch === "function") {
          play.catch(function () {
            // Browser blocked autoplay; mute UI until user toggles
            autoplayFailed = true;
            enabled = false;
            updateToggleUI(false);
          });
        }
        scheduleFlash();
      } else {
        if (rainAudio) {
          rainAudio.pause();
          rainAudio.currentTime = 0;
        }
        thunderAudios.forEach(function (audio) {
          audio.pause();
        });
        if (flashTimer) clearTimeout(flashTimer);
      }
    }

    toggle.addEventListener("click", function () {
      autoplayFailed = false;
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

    // Ambience is on by default; browsers may block until first user gesture
    setEnabled(true);
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

})();
