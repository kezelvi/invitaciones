/* ==========================================================================
   Cuando te veo canto ♥ — Kezelvi | Lógica Interactiva Principal (app.js)
   Incluye:
   1. Renderizador Canvas de onda crayón azul + arcoíris de 6 franjas con grano de cera.
   2. Motor de síntesis musical Web Audio API + soporte para cargar archivos MP3/WAV.
   3. Sincronización en tiempo real de letras (Lyrics) y giro del disco de vinilo.
   4. Navegación por pestañas (MUSIC, LYRICS, GALLERY, ABOUT) e inspector de código.
   ========================================================================== */

(function () {
  'use strict';

  // Catálogo de pistas y letras sincronizadas (en segundos)
  const TRACKS = [
    {
      id: 'cuando-te-veo-canto',
      titleLines: ['Cuando te', 'veo cant'],
      hasHeartO: true,
      titlePlain: 'Cuando te veo canto ♥',
      artist: 'Kezelvi',
      duration: 202, // 03:22 (202 segundos)
      initialTime: 74, // 01:14 como en la imagen de referencia
      tempo: 108,
      lyrics: [
        { time: 0,   text: 'Cuando te veo\\ncanto ♥' },
        { time: 28,  text: 'Bajo el cielo y\\ny el arcoíris...' },
        { time: 58,  text: 'El río sigue su\\ncamino...' },
        { time: 72,  text: 'Cuando te veo\\ncanto ♥' },
        { time: 96,  text: 'Bajo el cielo y\\ny el arcoíris...' },
        { time: 124, text: 'El río sigue su\\ncamino...' },
        { time: 152, text: 'Brilla el sol entre\\nlas flores del jardín...' },
        { time: 178, text: 'Contigo siempre\\nvuelvo a sonreír ♥' }
      ]
    },
    {
      id: 'bajo-el-arcoiris',
      titleLines: ['Bajo el', 'arcoíris'],
      hasHeartO: false,
      titlePlain: 'Bajo el arcoíris',
      artist: 'Kezelvi',
      duration: 174, // 02:54
      initialTime: 0,
      tempo: 116,
      lyrics: [
        { time: 0,   text: 'Siete colores pintan\\nla mañana...' },
        { time: 32,  text: 'Crayones de luz\\nen mi ventana...' },
        { time: 68,  text: 'Corre el agua clara\\njunto al manzano...' },
        { time: 105, text: 'Tomados de la mano\\ntodo el verano ♥' },
        { time: 140, text: 'Bajo el cielo azul\\nsiempre estás tú...' }
      ]
    },
    {
      id: 'el-rio-sigue',
      titleLines: ['El río', 'sigue'],
      hasHeartO: true,
      titlePlain: 'El río sigue su camino',
      artist: 'Kezelvi',
      duration: 225, // 03:45
      initialTime: 0,
      tempo: 98,
      lyrics: [
        { time: 0,   text: 'El río sigue su\\ncamino...' },
        { time: 40,  text: 'Entre tulipanes rojos\\ny lirios de papel...' },
        { time: 85,  text: 'Gira el vinilo lento\\ncomo un carrusel...' },
        { time: 135, text: 'Cada nota guarda\\nun recuerdo fiel...' },
        { time: 180, text: 'Cuando te veo\\ncanto otra vez ♥' }
      ]
    }
  ];

  // Estado reactivo del reproductor
  const state = {
    currentTrackIndex: 0,
    isPlaying: false,
    currentTime: 74, // Inicia en 01:14 exacto como en la captura
    duration: 202,   // 03:22
    volume: 0.8,
    isMuted: false,
    activeLyricIndex: 3, // "Cuando te veo canto ♥" en el minuto 01:14
    activeNav: 'music',
    wavePhase: 0,
    isDraggingWave: false,
    usingCustomAudio: false
  };

  // Referencias a elementos del DOM
  let vinylDisc, playPauseBtn, playIconSvg, pauseIconSvg;
  let timeDisplayEl, durationEndEl, lyricsContainer, karaokeContainer;
  let stageSongTitleEl, stageSongArtistEl;
  let waveCanvas, waveCtx, waveWrapper, waveTooltip;
  let audioCtx = null;
  let synthSchedulerId = null;
  let animFrameId = null;
  let lastTickTime = 0;
  let nextNoteTime = 0;
  let noteStep = 0;
  let customAudioEl = null;

  // Semilla pseudoaleatoria determinista para la textura de crayón de la onda
  function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return String(m).padStart(2, '0') + ':' + String(rem).padStart(2, '0');
  }

  function showToast(msg) {
    const toast = document.getElementById('toastBanner');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.classList.remove('visible');
    }, 2400);
  }

  // =========================================================================
  // 1. Renderizador de la Onda Crayón Azul + Arcoíris en HTML5 Canvas
  // =========================================================================
  function getWaveCenterY(normX, H, phase) {
    // Recrea la silueta exacta de la onda en la imagen de referencia:
    // 2 crestas azules a la izquierda y una gran curva arcoíris suave a la derecha
    if (normX < 0.30) {
      const local = normX / 0.30;
      return H * 0.54 - Math.sin(local * Math.PI * 2.15 + phase * 0.6) * (H * 0.24);
    } else {
      const local = (normX - 0.30) / 0.70;
      return H * 0.52 - Math.sin(local * Math.PI * 2.05 - 0.2 + phase * 0.45) * (H * 0.27);
    }
  }

  function renderRainbowWave() {
    if (!waveCanvas || !waveCtx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = waveCanvas.getBoundingClientRect();
    const W = Math.max(240, rect.width);
    const H = Math.max(48, rect.height);

    if (waveCanvas.width !== Math.floor(W * dpr) || waveCanvas.height !== Math.floor(H * dpr)) {
      waveCanvas.width = Math.floor(W * dpr);
      waveCanvas.height = Math.floor(H * dpr);
    }

    waveCtx.save();
    waveCtx.scale(dpr, dpr);
    waveCtx.clearRect(0, 0, W, H);

    const progressRatio = Math.min(1, Math.max(0, state.currentTime / Math.max(1, state.duration)));
    const splitX = 0.27; // Transición del trazo de crayón azul al arcoíris completo

    // Bandas del arcoíris (de arriba a abajo)
    const rainbowBands = [
      { color: '#f32b3b', offset: -9.5, width: 3.4 }, // Rojo crayón
      { color: '#ff8e18', offset: -5.8, width: 3.2 }, // Naranja
      { color: '#f9df16', offset: -2.2, width: 3.2 }, // Amarillo
      { color: '#24c642', offset:  1.4, width: 3.2 }, // Verde
      { color: '#216ce8', offset:  5.0, width: 3.4 }, // Azul
      { color: '#8f39ec', offset:  8.6, width: 3.4 }  // Violeta
    ];

    // 1) Dibujar la sección del arcoíris (desde splitX hasta el final con desvanecimiento suave)
    const startRainbowPx = Math.floor(W * (splitX - 0.02));
    const endRainbowPx = Math.floor(W * 0.985);

    rainbowBands.forEach(function (band, bIdx) {
      waveCtx.beginPath();
      waveCtx.strokeStyle = band.color;
      waveCtx.lineWidth = band.width;
      waveCtx.lineCap = 'round';
      waveCtx.lineJoin = 'round';

      for (let px = startRainbowPx; px <= endRainbowPx; px += 2) {
        const normX = px / W;
        const baseY = getWaveCenterY(normX, H, state.wavePhase);
        const jitter = (seededRandom(px * 1.7 + bIdx * 31) - 0.5) * 1.3;
        const y = baseY + band.offset + jitter;
        if (px === startRainbowPx) {
          waveCtx.moveTo(px, y);
        } else {
          waveCtx.lineTo(px, y);
        }
      }
      waveCtx.stroke();

      // Textura granulada de crayón/pastel sobre las bandas del arcoíris
      waveCtx.fillStyle = band.color;
      for (let px = startRainbowPx; px <= endRainbowPx; px += 3) {
        const normX = px / W;
        const fadeEdge = normX > 0.90 ? (1 - (normX - 0.90) / 0.10) : 1;
        if (fadeEdge <= 0) continue;
        const baseY = getWaveCenterY(normX, H, state.wavePhase) + band.offset;
        const grainY = baseY + (seededRandom(px * 3.1 + bIdx * 17) - 0.5) * 4.8;
        waveCtx.globalAlpha = 0.55 * fadeEdge;
        waveCtx.fillRect(px, grainY, 1.8, 1.8);
      }
    });

    waveCtx.globalAlpha = 1;

    // 2) Dibujar el trazo grueso de crayón azul cobalto en la sección izquierda (0 -> splitX)
    const endBluePx = Math.floor(W * (splitX + 0.015));
    const blueShades = ['#1b5ec0', '#2b77e0', '#5a9cf2', '#174ea6'];

    for (let layer = 0; layer < 4; layer++) {
      waveCtx.beginPath();
      waveCtx.strokeStyle = blueShades[layer];
      waveCtx.lineWidth = 11 - layer * 2.2;
      waveCtx.lineCap = 'round';
      for (let px = 8; px <= endBluePx; px += 2) {
        const normX = px / W;
        const baseY = getWaveCenterY(normX, H, state.wavePhase);
        const jitter = (seededRandom(px * 2.3 + layer * 19) - 0.5) * 2.6;
        const y = baseY + (layer - 1.5) * 1.4 + jitter;
        if (px === 8) {
          waveCtx.moveTo(px, y);
        } else {
          waveCtx.lineTo(px, y);
        }
      }
      waveCtx.stroke();
    }

    // Estipulado de cera azul en los bordes para textura auténtica de crayón
    for (let px = 6; px <= endBluePx; px += 2) {
      const normX = px / W;
      const baseY = getWaveCenterY(normX, H, state.wavePhase);
      for (let g = 0; g < 5; g++) {
        const spread = (seededRandom(px * 7.1 + g * 23) - 0.5) * 15;
        const dotSize = seededRandom(px * 3.7 + g) * 2.1 + 0.8;
        waveCtx.fillStyle = g % 2 === 0 ? '#1c62c6' : '#5396f0';
        waveCtx.globalAlpha = 0.68;
        waveCtx.fillRect(px + (seededRandom(px + g) - 0.5) * 2, baseY + spread, dotSize, dotSize);
      }
    }

    waveCtx.globalAlpha = 1;

    // 3) Indicador sutil de posición actual (playhead brillante sobre la onda)
    const playheadX = Math.max(12, Math.min(W - 14, progressRatio * W));
    const playheadY = getWaveCenterY(progressRatio, H, state.wavePhase);

    waveCtx.beginPath();
    waveCtx.arc(playheadX, playheadY, 7.5, 0, Math.PI * 2);
    waveCtx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    waveCtx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    waveCtx.shadowBlur = 6;
    waveCtx.fill();

    waveCtx.beginPath();
    waveCtx.arc(playheadX, playheadY, 3.8, 0, Math.PI * 2);
    waveCtx.fillStyle = progressRatio < splitX ? '#1b5ec0' : '#ff4757';
    waveCtx.fill();

    waveCtx.restore();
  }

  // =========================================================================
  // 2. Motor de Audio (Web Audio API Melódico + Soporte MP3 Personalizado)
  // =========================================================================
  function ensureAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Melodía dulce estilo indie/music-box ("Cuando te veo canto")
  const MELODY_NOTES = [
    523.25, 659.25, 783.99, 659.25, 880.00, 783.99, 659.25, 587.33,
    523.25, 587.33, 659.25, 783.99, 698.46, 659.25, 587.33, 523.25,
    440.00, 523.25, 659.25, 783.99, 880.00, 783.99, 659.25, 523.25
  ];

  function playSynthNote(freq, startTime, duration) {
    if (!audioCtx || state.isMuted || state.volume <= 0.01) return;

    const osc = audioCtx.createOscillator();
    const subOsc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    subOsc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    subOsc.frequency.setValueAtTime(freq * 0.5, startTime);

    const peakGain = 0.11 * state.volume;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(startTime);
    subOsc.start(startTime);
    osc.stop(startTime + duration + 0.02);
    subOsc.stop(startTime + duration + 0.02);
  }

  function startAudioEngine() {
    if (state.usingCustomAudio && customAudioEl) {
      customAudioEl.volume = state.isMuted ? 0 : state.volume;
      customAudioEl.play().catch(function () {});
      return;
    }

    ensureAudioContext();
    if (!audioCtx) return;

    nextNoteTime = audioCtx.currentTime + 0.05;
    clearInterval(synthSchedulerId);
    synthSchedulerId = setInterval(function () {
      if (!state.isPlaying || !audioCtx) return;
      const track = TRACKS[state.currentTrackIndex];
      const secPerBeat = 60 / (track.tempo || 108) / 2;
      while (nextNoteTime < audioCtx.currentTime + 0.2) {
        const freq = MELODY_NOTES[noteStep % MELODY_NOTES.length];
        playSynthNote(freq, nextNoteTime, secPerBeat * 1.4);
        nextNoteTime += secPerBeat;
        noteStep++;
      }
    }, 60);
  }

  function stopAudioEngine() {
    clearInterval(synthSchedulerId);
    synthSchedulerId = null;
    if (state.usingCustomAudio && customAudioEl) {
      customAudioEl.pause();
    }
  }

  // =========================================================================
  // 3. Sincronización de Letras, Tiempo y Animación Principal
  // =========================================================================
  function renderLyricsList() {
    const track = TRACKS[state.currentTrackIndex];
    if (!lyricsContainer) return;

    lyricsContainer.innerHTML = '';
    if (karaokeContainer) karaokeContainer.innerHTML = '';

    track.lyrics.forEach(function (item, idx) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lyric-line' + (idx === state.activeLyricIndex ? ' active-lyric' : '');
      btn.innerHTML = item.text.replace(/\\n/g, '<br>');
      btn.addEventListener('click', function () {
        seekTo(item.time);
        spawnMusicNotes(btn, '♥');
      });
      lyricsContainer.appendChild(btn);

      if (karaokeContainer) {
        const kBtn = document.createElement('button');
        kBtn.type = 'button';
        kBtn.className = 'karaoke-verse-btn' + (idx === state.activeLyricIndex ? ' active-lyric' : '');
        kBtn.innerHTML = '<span>' + item.text.replace(/\\n/g, ' ') + '</span><small>' + formatTime(item.time) + '</small>';
        kBtn.addEventListener('click', function () {
          seekTo(item.time);
          if (!state.isPlaying) togglePlay();
        });
        karaokeContainer.appendChild(kBtn);
      }
    });
  }

  function updateActiveLyric() {
    const track = TRACKS[state.currentTrackIndex];
    let foundIdx = 0;
    for (let i = 0; i < track.lyrics.length; i++) {
      if (state.currentTime >= track.lyrics[i].time) {
        foundIdx = i;
      }
    }

    if (foundIdx !== state.activeLyricIndex) {
      state.activeLyricIndex = foundIdx;
      const lines = lyricsContainer ? lyricsContainer.querySelectorAll('.lyric-line') : [];
      lines.forEach(function (el, idx) {
        el.classList.toggle('active-lyric', idx === foundIdx);
        if (idx === foundIdx && state.isPlaying) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });

      const kLines = karaokeContainer ? karaokeContainer.querySelectorAll('.karaoke-verse-btn') : [];
      kLines.forEach(function (el, idx) {
        el.classList.toggle('active-lyric', idx === foundIdx);
      });
    }
  }

  function updateTimeReadout() {
    const formattedCur = formatTime(state.currentTime);
    const formattedTot = formatTime(state.duration);
    if (timeDisplayEl) {
      timeDisplayEl.textContent = formattedCur + ' / ' + formattedTot;
    }
    if (durationEndEl) {
      durationEndEl.textContent = '/ ' + formattedTot;
    }
  }

  function mainLoop(timestamp) {
    if (!lastTickTime) lastTickTime = timestamp;
    const dt = (timestamp - lastTickTime) / 1000;
    lastTickTime = timestamp;

    if (state.isPlaying && !state.isDraggingWave) {
      if (state.usingCustomAudio && customAudioEl) {
        state.currentTime = customAudioEl.currentTime;
        state.duration = customAudioEl.duration || state.duration;
      } else {
        state.currentTime += dt;
        if (state.currentTime >= state.duration) {
          state.currentTime = 0;
        }
      }
      state.wavePhase += dt * 3.2;
      updateTimeReadout();
      updateActiveLyric();
    }

    renderRainbowWave();
    animFrameId = requestAnimationFrame(mainLoop);
  }

  // =========================================================================
  // 4. Controles de Transporte, Pistas y Efectos Visuales
  // =========================================================================
  function updateTransportUI() {
    if (vinylDisc) {
      vinylDisc.classList.toggle('is-spinning', state.isPlaying);
    }
    if (playIconSvg && pauseIconSvg) {
      // En la imagen de referencia se muestran las dos barras de pausa (||)
      playIconSvg.style.display = state.isPlaying ? 'none' : 'block';
      pauseIconSvg.style.display = state.isPlaying ? 'block' : 'none';
    }
  }

  function togglePlay() {
    state.isPlaying = !state.isPlaying;
    if (state.isPlaying) {
      startAudioEngine();
    } else {
      stopAudioEngine();
    }
    updateTransportUI();
  }

  function seekTo(seconds) {
    state.currentTime = Math.max(0, Math.min(state.duration, seconds));
    if (state.usingCustomAudio && customAudioEl) {
      customAudioEl.currentTime = state.currentTime;
    }
    updateTimeReadout();
    updateActiveLyric();
    renderRainbowWave();
  }

  function loadTrack(index, autoPlay) {
    state.usingCustomAudio = false;
    if (customAudioEl) {
      customAudioEl.pause();
    }
    state.currentTrackIndex = (index + TRACKS.length) % TRACKS.length;
    const track = TRACKS[state.currentTrackIndex];
    state.duration = track.duration;
    state.currentTime = track.initialTime || 0;
    state.activeLyricIndex = 0;

    if (stageSongTitleEl) {
      const heartHtml = track.hasHeartO ? '<span class="heart-o" aria-label="o">🖤</span>' : 'o';
      stageSongTitleEl.innerHTML = track.titleLines[0] + '<br>' + track.titleLines[1] + heartHtml;
    }
    if (stageSongArtistEl) {
      stageSongArtistEl.textContent = track.artist;
    }

    renderLyricsList();
    updateActiveLyric();
    updateTimeReadout();
    renderQueueList();

    if (autoPlay) {
      state.isPlaying = true;
      startAudioEngine();
    }
    updateTransportUI();
  }

  function renderQueueList() {
    const queueListEl = document.getElementById('queueListContainer');
    if (!queueListEl) return;
    queueListEl.innerHTML = '';

    TRACKS.forEach(function (t, i) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'queue-item' + (i === state.currentTrackIndex && !state.usingCustomAudio ? ' active-track' : '');
      btn.innerHTML =
        '<span class="queue-item-name">' + (i + 1) + '. ' + t.titlePlain + '</span>' +
        '<span class="queue-item-time">' + formatTime(t.duration) + '</span>';
      btn.addEventListener('click', function () {
        loadTrack(i, true);
        showToast('Reproduciendo: ' + t.titlePlain);
      });
      queueListEl.appendChild(btn);
    });
  }

  function spawnMusicNotes(anchorEl, customSymbol) {
    const layer = document.getElementById('floatingNotesLayer');
    if (!layer) return;
    const symbols = customSymbol ? [customSymbol, '♪', '♫', '♥'] : ['♪', '♫', '♥', '✨'];
    const colors = ['#fb3858', '#02d4f9', '#ff8e18', '#24c642', '#8f39ec'];

    const layerRect = layer.getBoundingClientRect();
    const targetRect = anchorEl ? anchorEl.getBoundingClientRect() : layerRect;
    const baseX = targetRect.left - layerRect.left + targetRect.width * 0.5;
    const baseY = targetRect.top - layerRect.top + targetRect.height * 0.35;

    for (let i = 0; i < 4; i++) {
      const span = document.createElement('span');
      span.className = 'music-particle';
      span.textContent = symbols[i % symbols.length];
      span.style.color = colors[(i + Math.floor(Math.random() * colors.length)) % colors.length];
      span.style.left = Math.max(16, Math.min(layerRect.width - 24, baseX + (Math.random() - 0.5) * 70)) + 'px';
      span.style.top = Math.max(16, Math.min(layerRect.height - 24, baseY + (Math.random() - 0.5) * 30)) + 'px';
      layer.appendChild(span);
      setTimeout(function () {
        span.remove();
      }, 1400);
    }
  }

  // =========================================================================
  // 5. Inicialización de Eventos y Navegación
  // =========================================================================
  function initApp() {
    vinylDisc = document.getElementById('vinylDisc');
    playPauseBtn = document.getElementById('playPauseBtn');
    playIconSvg = document.getElementById('playIconSvg');
    pauseIconSvg = document.getElementById('pauseIconSvg');
    timeDisplayEl = document.getElementById('timeDisplay');
    durationEndEl = document.getElementById('durationEnd');
    lyricsContainer = document.getElementById('lyricsScrollArea');
    karaokeContainer = document.getElementById('karaokeVersesList');
    stageSongTitleEl = document.getElementById('stageSongTitle');
    stageSongArtistEl = document.getElementById('stageSongArtist');
    waveCanvas = document.getElementById('rainbowWaveCanvas');
    waveWrapper = document.getElementById('waveformWrapper');
    waveTooltip = document.getElementById('waveformTooltip');

    if (waveCanvas) {
      waveCtx = waveCanvas.getContext('2d');
    }

    // Cargar el estado inicial exacto de la captura ("Cuando te veo canto ♥" en 01:14 / 03:22)
    renderLyricsList();
    updateActiveLyric();
    updateTimeReadout();
    renderQueueList();

    // Controles de transporte
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', togglePlay);
    }
    const prevBtn = document.getElementById('prevTrackBtn');
    const nextBtn = document.getElementById('nextTrackBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (state.currentTime > 10) {
          seekTo(0);
        } else {
          loadTrack(state.currentTrackIndex - 1, state.isPlaying);
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        loadTrack(state.currentTrackIndex + 1, state.isPlaying);
      });
    }

    // Clic en el vinilo para reproducir/pausar
    const vinylAssembly = document.getElementById('vinylAssembly');
    if (vinylAssembly) {
      vinylAssembly.addEventListener('click', function () {
        togglePlay();
        spawnMusicNotes(vinylAssembly);
      });
    }

    // Stickers interactivos
    document.querySelectorAll('.sticker-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        spawnMusicNotes(btn);
      });
    });

    // Interacción con la barra de onda arcoíris (Scrubbing y vista previa de tiempo)
    if (waveWrapper && waveCanvas) {
      const handleWavePointer = function (clientX) {
        const rect = waveCanvas.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        seekTo(ratio * state.duration);
      };

      waveWrapper.addEventListener('pointerdown', function (e) {
        state.isDraggingWave = true;
        handleWavePointer(e.clientX);
      });

      window.addEventListener('pointermove', function (e) {
        if ( waveWrapper ) {
          const rect = waveCanvas.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right) {
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (waveTooltip) {
              waveTooltip.style.left = (ratio * 100) + '%';
              waveTooltip.textContent = formatTime(ratio * state.duration);
            }
          }
        }
        if (state.isDraggingWave) {
          handleWavePointer(e.clientX);
        }
      });

      window.addEventListener('pointerup', function () {
        state.isDraggingWave = false;
      });
    }

    // Navegación superior (MUSIC • LYRICS • GALLERY • ABOUT)
    const navButtons = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view-panel');

    function switchNavView(targetView) {
      state.activeNav = targetView;
      navButtons.forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-view') === targetView);
      });
      views.forEach(function (v) {
        v.classList.toggle('active-view', v.id === 'view-' + targetView);
      });
    }

    navButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = btn.getAttribute('data-view');
        switchNavView(target);
      });
    });

    // Botón rápido para ver los archivos index.html / styles.css / app.js
    const openCodeBtn = document.getElementById('openSourceFilesBtn');
    if (openCodeBtn) {
      openCodeBtn.addEventListener('click', function () {
        switchNavView('about');
      });
    }

    // Botones de la barra derecha (Volumen, Cola de canciones, Karaoke/Letras)
    const volBtn = document.getElementById('volumeToggleBtn');
    const queueBtn = document.getElementById('queueToggleBtn');
    const lyricsModeBtn = document.getElementById('lyricsModeBtn');
    const volPopover = document.getElementById('volumePopover');
    const queuePopover = document.getElementById('queuePopover');

    function closeAllPopovers() {
      if (volPopover) volPopover.classList.remove('open');
      if (queuePopover) queuePopover.classList.remove('open');
    }

    if (volBtn && volPopover) {
      volBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = volPopover.classList.contains('open');
        closeAllPopovers();
        if (!isOpen) volPopover.classList.add('open');
      });
    }

    if (queueBtn && queuePopover) {
      queueBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = queuePopover.classList.contains('open');
        closeAllPopovers();
        if (!isOpen) queuePopover.classList.add('open');
      });
    }

    if (lyricsModeBtn) {
      lyricsModeBtn.addEventListener('click', function () {
        closeAllPopovers();
        const nextView = state.activeNav === 'lyrics' ? 'music' : 'lyrics';
        switchNavView(nextView);
      });
    }

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.player-utilities')) {
        closeAllPopovers();
      }
    });

    // Control deslizante de volumen y botón de silencio
    const volSlider = document.getElementById('volumeRangeSlider');
    const muteBtn = document.getElementById('muteQuickBtn');
    if (volSlider) {
      volSlider.addEventListener('input', function () {
        state.volume = parseFloat(volSlider.value);
        state.isMuted = state.volume === 0;
        if (customAudioEl) customAudioEl.volume = state.volume;
      });
    }
    if (muteBtn) {
      muteBtn.addEventListener('click', function () {
        state.isMuted = !state.isMuted;
        if (customAudioEl) customAudioEl.volume = state.isMuted ? 0 : state.volume;
        showToast(state.isMuted ? 'Audio silenciado' : 'Audio activado');
      });
    }

    // Carga opcional de archivo MP3/WAV local del usuario
    const audioInput = document.getElementById('customAudioInput');
    if (audioInput) {
      audioInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        if (!customAudioEl) {
          customAudioEl = new Audio();
        }
        customAudioEl.src = url;
        customAudioEl.onloadedmetadata = function () {
          state.usingCustomAudio = true;
          state.duration = customAudioEl.duration || 202;
          state.currentTime = 0;
          const cleanName = file.name.replace(/\\.[^/.]+$/, '');
          if (stageSongTitleEl) stageSongTitleEl.textContent = cleanName.slice(0, 22);
          if (stageSongArtistEl) stageSongArtistEl.textContent = 'Audio Local';
          state.isPlaying = true;
          startAudioEngine();
          updateTransportUI();
          updateTimeReadout();
          showToast('Cargado: ' + file.name);
        };
      });
    }

    // Botones de ventana estilo macOS (modo papel oscuro, reiniciar vista, centrar)
    const dotClose = document.getElementById('winDotClose');
    const dotMin = document.getElementById('winDotMin');
    const dotMax = document.getElementById('winDotMax');
    if (dotClose) {
      dotClose.addEventListener('click', function () {
        switchNavView('music');
        seekTo(74);
        showToast('Vista original restaurada (01:14 / 03:22)');
      });
    }
    if (dotMin) {
      dotMin.addEventListener('click', function () {
        document.body.classList.toggle('dark-paper-mode');
        showToast(document.body.classList.contains('dark-paper-mode') ? 'Marco nocturno activado' : 'Marco de papel claro activado');
      });
    }
    if (dotMax) {
      dotMax.addEventListener('click', function () {
        togglePlay();
      });
    }

    // Selector de archivos fuente en la pestaña ABOUT (index.html, styles.css, app.js)
    const sourceTabs = document.querySelectorAll('.source-tab-btn');
    const sourceCodeDisplay = document.getElementById('sourceCodeDisplay');
    const copySourceBtn = document.getElementById('copySourceCodeBtn');

    const SOURCE_SNIPPETS = {
      'index.html': '<!DOCTYPE html>\\n<html lang="es">\\n<head>\\n  <meta charset="UTF-8">\\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\\n  <title>Cuando te veo canto ♥ — Kezelvi</title>\\n  <link rel="stylesheet" href="styles.css">\\n</head>\\n<body>\\n  <main class="app-window">\\n    <!-- Barra superior macOS + Navegación MUSIC • LYRICS • GALLERY • ABOUT -->\\n    <!-- Escenario ilustrado + Vinilo giratorio + Funda Glassmorphism + Stickers -->\\n    <!-- Panel de Letras sincronizadas + Barra inferior con onda arcoíris -->\\n  </main>\\n  ' + '<' + 'script src="app.js"><' + '/script>' + '\\n</body>\\n</html>',
      'styles.css': '/* Estructura modular en styles.css */\\n.glass-sleeve {\\n  background: rgba(232, 241, 248, 0.44);\\n  backdrop-filter: blur(11px) saturate(118%);\\n  border: 1.5px solid rgba(255, 255, 255, 0.72);\\n  border-radius: 0 12px 12px 0;\\n}\\n.vinyl-disc.is-spinning {\\n  animation: rotateVinyl 6.5s linear infinite;\\n}',
      'app.js': '// Motor de onda crayón arcoíris + Web Audio API en app.js\\nfunction renderRainbowWave() {\\n  // Dibuja trazo azul cobalto + 6 bandas arcoíris con textura granulada de cera\\n}'
    };

    sourceTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        sourceTabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        const fileKey = tab.getAttribute('data-file');
        if (sourceCodeDisplay) {
          sourceCodeDisplay.textContent = SOURCE_SNIPPETS[fileKey] || '';
        }
      });
    });

    let currentSelectedSourceFile = 'index.html';
    sourceTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        currentSelectedSourceFile = tab.getAttribute('data-file') || 'index.html';
      });
    });

    if (copySourceBtn && sourceCodeDisplay) {
      copySourceBtn.addEventListener('click', function () {
        const temp = document.createElement('textarea');
        temp.value = SOURCE_SNIPPETS[currentSelectedSourceFile] || sourceCodeDisplay.textContent;
        document.body.appendChild(temp);
        temp.select();
        try {
          document.execCommand('copy');
          showToast(currentSelectedSourceFile + ' copiado al portapapeles');
        } catch (err) {
          showToast('Listo para copiar');
        }
        temp.remove();
      });
    }

    const downloadSourceBtn = document.getElementById('downloadSourceFileBtn');
    if (downloadSourceBtn) {
      downloadSourceBtn.addEventListener('click', function () {
        const content = SOURCE_SNIPPETS[currentSelectedSourceFile] || '';
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = currentSelectedSourceFile;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Descargando ' + currentSelectedSourceFile);
      });
    }

    window.addEventListener('resize', renderRainbowWave);
    animFrameId = requestAnimationFrame(mainLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
