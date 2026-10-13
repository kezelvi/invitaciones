# Yahir-fest — invitación digital

- Invitación: https://kezinvites.site/yahirfest/
- Administración: https://kezinvites.site/yahirfest/administrador/
- Código: https://github.com/kezelvi/invitaciones/tree/main/yahirfest

## Archivos multimedia
Coloca estos archivos en esta carpeta:
- foto_antro.jpg: fotografía que aparecerá en la sección del lugar.
- musica_yahirfest.mp3: música de fondo que se repite continuamente.

Estos dos archivos no aparecen actualmente en el árbol de archivos de GitHub. El HTML ya los referencia, pero es necesario subirlos para que se vean y suenen. No se sustituyó la música por otra pista ni se inventó una fotografía.

## Lista compartida
GitHub Pages sirve archivos estáticos y no puede escribir respuestas de forma segura directamente en el repositorio desde el navegador del invitado. La lista compartida usa Supabase.

1. Crea un proyecto en https://supabase.com/.
2. Ejecuta schema.sql desde SQL Editor.
3. Desactiva los registros públicos en Authentication y crea un usuario administrador manualmente.
4. En Project Settings / API copia Project URL y la clave pública anon/publishable.
5. Edita supabase-config.js y pega esos valores. No pegues claves service_role ni contraseñas.
6. Inicia sesión en el panel de administración y comprueba que Realtime esté activo para public.yahirfest_rsvps.

El SQL elimina la columna antigua de recordatorio si existía. Los visitantes solo pueden añadir respuestas; la lista completa solo está disponible para usuarios autenticados.

## Música en Safari / iPhone
La etiqueta de audio usa reproducción en bucle. Safari iOS bloquea la reproducción automática hasta que detecta una interacción; por eso el código intenta arrancar directamente desde touchstart, touchmove, pointerdown y wheel, y mantiene el botón fijo para el control manual. Si Safari rechaza el primer intento, toca la página o usa el botón. Al ocultar la página o salir de ella, el audio se pausa.

## Protección de la fotografía
Se deshabilita el menú contextual, el arrastre y la selección de la fotografía en navegadores compatibles. Esto reduce el menú al mantener pulsada la foto, pero HTML no puede impedir por completo capturas de pantalla ni métodos externos para copiarla.