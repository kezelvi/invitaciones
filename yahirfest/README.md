# Yahir-fest — invitación y lista de invitados

La invitación y el administrador están bajo esta estructura:

- Invitación: https://kezinvites.site/yahirfest/
- Administrador: https://kezinvites.site/yahirfest/administrador/
- Código fuente: https://github.com/kezelvi/invitaciones/tree/main/yahirfest

## Incluye
- Diseño adaptable para móvil y escritorio, palmeras de neón y estética nocturna premium con referencias visuales a una alberca.
- Cuenta regresiva para el 21 de noviembre de 2026 a las 7:00 PM (hora de Monterrey).
- Google Maps con la dirección indicada.
- Música electrónica ambiental generada con Web Audio; comienza con la primera interacción ajena al botón de música y se pausa al ocultar la pestaña o salir.
- Confirmación Sí voy a ir / No podré ir, nombre y casilla de recordatorio.
- Panel administrativo con autenticación, lista, totales, búsqueda y avisos en vivo mientras el panel está abierto.
- SQL con RLS: visitantes pueden insertar respuestas, solo usuarios autenticados leen la lista.

## Conectar la lista compartida (necesario para usarla entre dispositivos)
GitHub Pages sirve archivos estáticos. No puede guardar respuestas en un archivo del repositorio desde el navegador de un invitado de forma segura; la lista compartida utiliza Supabase.

1. Crea un proyecto gratuito en https://supabase.com/.
2. Abre SQL Editor y ejecuta todo el contenido de schema.sql.
3. En Authentication, desactiva los registros públicos (Sign-ups). Crea el usuario administrador manualmente desde Authentication / Users / Add user con un correo y contraseña que controles.
4. En Project Settings / API, copia Project URL y la clave pública anon/publishable.
5. Edita supabase-config.js en GitHub y pega los valores en supabaseUrl y supabaseAnonKey. La clave anon es pública por diseño; nunca pegues una service_role key, contraseña ni token privado.
6. Espera a que GitHub Pages publique el cambio. Abre el administrador e inicia sesión con el usuario administrador creado.
7. Asegúrate de que Realtime esté activo para public.yahirfest_rsvps. El SQL intenta agregar la tabla a la publicación supabase_realtime; si la consola muestra un error o los avisos no llegan, activa su replicación desde Database / Publications.

Las políticas RLS impiden que visitantes anónimos lean la lista. No habilites acceso público de lectura para intentar arreglar el panel.

## Antes de conectar Supabase
El formulario guarda una respuesta de demostración en el almacenamiento local de ese navegador y el panel puede mostrarla en ese mismo navegador. No es una lista compartida; otras personas y dispositivos no verán esas pruebas.

## Límites de las notificaciones
- Avisos al administrador: la actualización en vivo y las notificaciones del navegador funcionan si el panel está abierto y ya se concedió permiso. No pueden despertar un navegador totalmente cerrado.
- Recordatorio de invitados: el checkbox guarda la preferencia en la lista compartida. La notificación local de prueba requiere que el invitado use el mismo navegador, conceda permiso y mantenga la página abierta alrededor de la hora programada. Los navegadores no garantizan temporizadores ni avisos si la página está cerrada.
- Para enviar recordatorios push fiables aunque la página esté cerrada hace falta un servicio push, un service worker suscrito por cada invitado y una función de servidor programada (por ejemplo, Supabase Edge Functions con un cron). Eso no se activa solo con HTML estático y no se presenta aquí como si ya estuviera funcionando.
- Si una persona registra un recordatorio en otro dispositivo, el navegador del anfitrión no puede notificar su teléfono sin autorización de notificaciones en ese dispositivo.

## Fecha y música
La fecha está fijada a 2026-11-21T19:00:00-06:00. Si cambia, actualiza EVENT_DATE en app.js y el texto de fecha en las páginas.

La música es un loop generativo original de Web Audio (bombo, hi-hat, bajo y sintetizadores), sin MP3 externo. Los navegadores bloquean la reproducción automática sin interacción, así que comienza en la primera interacción y puede pausarse desde el botón fijo.