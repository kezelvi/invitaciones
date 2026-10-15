# Cuando te veo canto ♥ — Kezelvi (Web Music Player)

Recreación web interactiva del reproductor musical estilo ventana macOS sobre papel artesanal con efectos glassmorphism, vinilo giratorio, stickers de flores troquelados y barra de progreso de onda en crayón arcoíris.

## Estructura de Archivos

- `index.html`: Estructura semántica principal (barra de título macOS, menú `MUSIC • LYRICS • GALLERY • ABOUT`, escenario ilustrado, disco de vinilo con etiqueta central soleada, funda glassmorphism, stickers SVG troquelados, tarjeta de letras y barra inferior).
- `styles.css`: Hoja de estilos con variables CSS, textura de papel artesanal, `backdrop-filter: blur()` para el cristal esmerilado sobre la mitad izquierda del vinilo y sobre la barra inferior, animaciones del disco y diseño adaptable (responsive).
- `app.js`: Lógica completa del reproductor:
  - Renderizador HTML5 `<canvas>` para la onda de crayón azul cobalto + arcoíris de 6 franjas con textura granulada de cera y scrubbing interactivo.
  - Sintetizador melódico integrado con Web Audio API (para escuchar música sin depender de servidores externos) + cargador de archivos `.mp3`/`.wav` propios.
  - Sincronización automática de versos en el panel `Lyrics` y modo estudio expandido.
- `assets/landscape.jpg`: Ilustración de fondo en crayón y pastel al óleo.
