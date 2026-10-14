(() => {
  "use strict";

  const EVENT_DATE = new Date("2026-11-21T20:00:00-06:00");
  const AUDIO_URL = "./musica_yahirfest.mp3";
  const DEMO_KEY = "yahirfest-demo-rsvps";
  const CLIENT_ID_KEY = "yahirfest-client-id-v1";
  const SUBMITTED_KEY = "yahirfest-rsvp-submitted-v1";
  let memoryClientId = null;

  const config = window.YAHIRFEST_CONFIG || {};
  const cloudReady = Boolean(
    window.supabase &&
    /^https:\/\/.+/.test(config.supabaseUrl || "") &&
    (config.supabaseAnonKey || "").length > 20 &&
    !String(config.supabaseUrl).includes("PEGA_AQUI") &&
    !String(config.supabaseAnonKey).includes("PEGA_AQUI")
  );
  const db = cloudReady
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

  const $ = (s) => document.querySelector(s);
  const audio = $("#backgroundMusic"),
    musicToggle = $("#musicToggle"),
    musicLabel = $("#musicLabel"),
    form = $("#rsvpForm"),
    guestName = $("#guestName"),
    status = $("#rsvpStatus"),
    submit = $("#submitRsvp");
  const choices = [...document.querySelectorAll("[data-attending]")],
    attendanceField = $("#attendingValue");

  let selected = null,
    saving = false,
    manuallyPaused = false;

  // Desactivar la etiqueta <audio> nativa para que iOS no la registre en el Centro de Control
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  // Animación del borde en la tarjeta de fecha compatible con todos los navegadores
  const dateCard = document.querySelector(".date-card");
  if (dateCard) {
    let lastFrame = 0;
    const animateRgbFrame = (now) => {
      if (!document.hidden && now - lastFrame >= 30) {
        const angle = (((now % 5200) / 5200) * 360).toFixed(2) + "deg";
        dateCard.style.setProperty("--rgb-angle", angle);
        dateCard.style.setProperty("--yahir-final-angle", angle);
        lastFrame = now;
      }
      requestAnimationFrame(animateRgbFrame);
    };
    requestAnimationFrame(animateRgbFrame);
  }

  // Cuenta regresiva
  function updateCountdown() {
    const remaining = Math.max(0, EVENT_DATE.getTime() - Date.now());
    $("#days").textContent = String(Math.floor(remaining / 86400000)).padStart(2, "0");
    $("#hours").textContent = String(Math.floor((remaining % 86400000) / 3600000)).padStart(2, "0");
    $("#minutes").textContent = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, "0");
    $("#seconds").textContent = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
    if (!remaining) $("#countdownCaption").textContent = "¡ES HOY! · YAHIR-FEST";
  }
  updateCountdown();
  window.setInterval(updateCountdown, 1000);

  // =========================================================================
  // MOTOR DE AUDIO (Web Audio API):
  // - No aparece en el Centro de Control ni pantalla de bloqueo de iOS
  // - Empieza en un punto aleatorio (5% a 85%) cada vez que abres la página
  // - Al terminar la canción, repite en bucle desde 0:00
  // =========================================================================
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;
  let audioBuffer = null;
  let sourceNode = null;
  let gainNode = null;
  let isPlaying = false;
  let isLoadingBuffer = false;
  let rawAudioDataPromise = fetch(AUDIO_URL)
    .then((res) => res.arrayBuffer())
    .catch(() => null);

  let currentOffset = null; // null = elegir punto aleatorio nuevo
  let startedAt = 0;

  function updateMusicButton(playing) {
    if (!musicToggle) return;
    musicToggle.setAttribute("aria-pressed", String(playing));
    musicToggle.setAttribute("aria-label", playing ? "Pausar música" : "Activar música");
    if (musicLabel) musicLabel.textContent = playing ? "MÚSICA ACTIVA" : "MÚSICA PAUSADA";
    const sym = musicToggle.querySelector(".music-symbol");
    if (sym) sym.textContent = playing ? "Ⅱ" : "♫";
  }

  function clearSystemMediaControls() {
    try {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      }
    } catch (_) {}
  }

  function ensureAudioContext() {
    if (!audioCtx && AudioCtx) {
      audioCtx = new AudioCtx();
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.78;
      gainNode.connect(audioCtx.destination);
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  async function loadDecodedBuffer() {
    if (audioBuffer) return audioBuffer;
    if (isLoadingBuffer) return null;
    isLoadingBuffer = true;
    try {
      ensureAudioContext();
      if (!rawAudioDataPromise) {
        rawAudioDataPromise = fetch(AUDIO_URL).then((r) => r.arrayBuffer());
      }
      const arrayBuffer = await rawAudioDataPromise;
      if (!arrayBuffer || !audioCtx) return null;
      // Clonar el ArrayBuffer por si se necesita decodificar más de una vez
      audioBuffer = await new Promise((resolve, reject) => {
        audioCtx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
      });
      return audioBuffer;
    } catch (_) {
      return null;
    } finally {
      isLoadingBuffer = false;
    }
  }

  function pickRandomOffset(duration) {
    if (!Number.isFinite(duration) || duration <= 4) return 0;
    const min = duration * 0.05;
    const max = duration * 0.85;
    return min + Math.random() * (max - min);
  }

  async function startMusicFromGesture(event) {
    if (event && event.target instanceof Element && event.target.closest("#musicToggle")) return;
    if (manuallyPaused || isPlaying) return;

    ensureAudioContext();
    const buffer = await loadDecodedBuffer();
    if (!buffer || manuallyPaused || isPlaying || document.hidden) return;

    try {
      if (audioCtx.state === "suspended") await audioCtx.resume();

      if (currentOffset === null) {
        currentOffset = pickRandomOffset(buffer.duration);
      }

      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.loop = true;
      sourceNode.loopStart = 0;
      sourceNode.loopEnd = buffer.duration;
      sourceNode.connect(gainNode);

      startedAt = audioCtx.currentTime - currentOffset;
      sourceNode.start(0, currentOffset);
      isPlaying = true;
      clearSystemMediaControls();
      updateMusicButton(true);
    } catch (_) {
      updateMusicButton(false);
    }
  }

  function pauseMusic(resetRandomPoint) {
    if (sourceNode) {
      try {
        if (isPlaying && audioCtx && audioBuffer) {
          const elapsed = audioCtx.currentTime - startedAt;
          currentOffset = elapsed % audioBuffer.duration;
        }
        sourceNode.stop();
        sourceNode.disconnect();
      } catch (_) {}
      sourceNode = null;
    }
    if (resetRandomPoint) {
      currentOffset = null;
    }
    isPlaying = false;
    if (audioCtx && audioCtx.state === "running") {
      audioCtx.suspend().catch(() => {});
    }
    clearSystemMediaControls();
    updateMusicButton(false);
  }

  if (musicToggle) {
    musicToggle.addEventListener("click", () => {
      if (isPlaying) {
        manuallyPaused = true;
        pauseMusic(false);
      } else {
        manuallyPaused = false;
        startMusicFromGesture();
      }
    });
  }

  document.addEventListener("pointerdown", startMusicFromGesture, { passive: true, capture: true });
  document.addEventListener("touchstart", startMusicFromGesture, { passive: true, capture: true });
  document.addEventListener("touchmove", startMusicFromGesture, { passive: true, capture: true });
  document.addEventListener("wheel", startMusicFromGesture, { passive: true, capture: true });
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) &&
        !["Shift", "Control", "Alt", "Meta"].includes(event.key)
      ) {
        startMusicFromGesture(event);
      }
    },
    { capture: true }
  );

  // Cortar audio al salir o minimizar Safari y elegir otro punto aleatorio al volver
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseMusic(true);
    }
  });
  window.addEventListener("pagehide", () => pauseMusic(true));

  // Scroll suave del botón de portada hacia #confirmar
  const heroCta = document.querySelector(".hero-cta");
  if (heroCta) {
    heroCta.addEventListener("click", (event) => {
      const target = document.querySelector("#confirmar");
      if (!target) return;
      event.preventDefault();
      const start = window.scrollY;
      const delta = target.getBoundingClientRect().top;
      const duration = 760;
      const began = performance.now();
      const previousBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      const step = (now) => {
        const progress = Math.min(1, (now - began) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        window.scrollTo(0, start + delta * eased);
        if (progress < 1) requestAnimationFrame(step);
        else document.documentElement.style.scrollBehavior = previousBehavior;
      };
      requestAnimationFrame(step);
    });
  }

  // Protección de fotos
  const photo = $("#clubPhoto"),
    photoFrame = $(".club-photo"),
    poolPhoto = $("#poolPhoto");
  [photo, photoFrame, poolPhoto].filter(Boolean).forEach((element) => {
    element.addEventListener("contextmenu", (e) => e.preventDefault());
    element.addEventListener("dragstart", (e) => e.preventDefault());
    element.addEventListener("selectstart", (e) => e.preventDefault());
  });

  // Formulario de confirmación (RSVP)
  function setStatus(message, error) {
    status.textContent = message;
    status.classList.toggle("error", Boolean(error));
  }

  function getClientId() {
    try {
      let value = localStorage.getItem(CLIENT_ID_KEY);
      if (value) return value;
      if (window.crypto && typeof crypto.randomUUID === "function") value = crypto.randomUUID();
      else if (window.crypto && typeof crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        value = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      } else value = "yf-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(CLIENT_ID_KEY, value);
      return value;
    } catch (_) {
      if (!memoryClientId)
        memoryClientId = "yf-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      return memoryClientId;
    }
  }

  function hasAlreadySubmitted() {
    try {
      return localStorage.getItem(SUBMITTED_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function lockRsvpForm(message) {
    choices.forEach((button) => (button.disabled = true));
    guestName.disabled = true;
    submit.disabled = true;
    submit.style.opacity = ".55";
    setStatus(message, true);
  }

  if (hasAlreadySubmitted()) {
    lockRsvpForm(
      "Este navegador ya registró una respuesta. Solo se permite una confirmación por navegador."
    );
  }

  window.addEventListener("storage", (event) => {
    if (event.key === SUBMITTED_KEY && event.newValue === "1") {
      lockRsvpForm(
        "Este navegador ya registró una respuesta. Solo se permite una confirmación por navegador."
      );
    }
  });

  choices.forEach((button) =>
    button.addEventListener("click", () => {
      selected = button.dataset.attending === "true";
      attendanceField.value = String(selected);
      choices.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      setStatus("");
    })
  );

  function getDemo() {
    try {
      return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }

  function setDemo(list) {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving) return;
    if (hasAlreadySubmitted()) {
      lockRsvpForm(
        "Este navegador ya registró una respuesta. Solo se permite una confirmación por navegador."
      );
      return;
    }
    const name = guestName.value.trim().replace(/\s+/g, " ");
    if (selected === null) {
      setStatus("Selecciona «Sí voy a ir» o «No podré ir» para continuar.", true);
      return;
    }
    if (name.length < 2) {
      setStatus("Escribe tu nombre para registrar la respuesta.", true);
      guestName.focus();
      return;
    }
    if (name.length > 80) {
      setStatus("El nombre debe tener máximo 80 caracteres.", true);
      return;
    }

    saving = true;
    submit.disabled = true;
    submit.style.opacity = ".65";
    submit.querySelector("span").textContent = "…";
    setStatus("Guardando tu respuesta…");

    const row = { name, attending: selected, client_id: getClientId() };
    let submittedSuccessfully = false;

    try {
      if (db) {
        const { error } = await db.from("yahirfest_rsvps").insert([row]);
        if (error) {
          if (error.code === "23505")
            throw new Error(
              "Ya se registró una respuesta desde este navegador o ese nombre ya está en la lista. Solo se permite una confirmación por navegador."
            );
          if (error.code === "42501" || error.code === "PGRST301")
            throw new Error("La base de datos rechazó el registro. Revisa las políticas de schema.sql.");
          throw new Error("No se pudo guardar la respuesta. Revisa la conexión e inténtalo de nuevo.");
        }
        setStatus(
          row.attending
            ? "¡Listo! Tu asistencia quedó registrada. ✦"
            : "Respuesta registrada. Gracias por avisar. ✦"
        );
      } else {
        const rows = getDemo();
        if (rows.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
          throw new Error("Ese nombre ya está en la lista de prueba de este navegador.");
        if (rows.some((item) => item.client_id && item.client_id === row.client_id))
          throw new Error(
            "Este navegador ya registró una respuesta. Solo se permite una confirmación por navegador."
          );
        rows.unshift({ ...row, created_at: new Date().toISOString(), id: String(Date.now()) });
        setDemo(rows);
        setStatus(
          "Modo de prueba: la respuesta se guardó solo en este navegador. La lista compartida necesita configurar Supabase."
        );
      }
      try {
        localStorage.setItem(SUBMITTED_KEY, "1");
      } catch (_) {}
      submittedSuccessfully = true;
      form.reset();
      selected = null;
      attendanceField.value = "";
      choices.forEach((button) => button.setAttribute("aria-pressed", "false"));
      choices.forEach((button) => (button.disabled = true));
      guestName.disabled = true;
      submit.disabled = true;
      submit.style.opacity = ".55";
      setStatus("Respuesta guardada. Este navegador ya no puede enviar otra confirmación.", false);
    } catch (error) {
      setStatus(error.message || "No se pudo guardar. Inténtalo de nuevo.", true);
    } finally {
      saving = false;
      submit.querySelector("span").textContent = "↗";
      if (!submittedSuccessfully && !hasAlreadySubmitted()) {
        submit.disabled = false;
        submit.style.opacity = "";
      }
    }
  });
})();
