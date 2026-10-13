# Yahir-fest — invitación digital

- Invitación: https://kezinvites.site/yahirfest/
- Administración: https://kezinvites.site/yahirfest/administrador/
- Código: https://github.com/kezelvi/invitaciones/tree/main/yahirfest

## Archivos multimedia
Coloca estos archivos en esta carpeta:
- foto_antro.jpg: fotografía que aparecerá en la sección del lugar.
- musica_yahirfest.mp3: música de fondo que se repite continuamente.

Ambos archivos ya están en esta carpeta y la página usa sus rutas relativas. Conserva exactamente estos nombres al reemplazarlos por otras versiones. No se sustituyó la música por otra pista ni se inventó una fotografía.

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

## Cambios recientes
- El panel muestra solo dos contadores: personas que sí asistirán (azul) y personas que no asistirán (rojo).
- La tarjeta de fecha ahora tiene el texto "El plan es divertirnos", y su borde RGB se anima también desde JavaScript para mejorar compatibilidad en Chrome.
- foto_lasers.jpg es el banner de fondo de la cuenta regresiva y foto_alberca.jpg aparece debajo del botón de confirmar asistencia.

## Bloqueo de respuestas repetidas
La invitación genera un client_id persistente por navegador. La base de datos mantiene un índice único y la interfaz bloquea el formulario después de guardar una respuesta. Para activar el control del lado del servidor, vuelve a ejecutar schema.sql desde Supabase SQL Editor; la migración agrega la columna client_id y el índice único de forma compatible con respuestas anteriores.

Esta barrera impide repeticiones ordinarias desde el mismo navegador. No verifica legalmente la identidad de una persona: alguien que borre el almacenamiento del navegador o use otro dispositivo podría intentar responder de nuevo. Para impedirlo con más certeza, se necesitarían códigos únicos de invitación o verificación por teléfono/correo.
