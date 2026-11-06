# Michael Espinosa · Estratega Digital

Panel personal con cinco áreas: Hoy, Trabajo (clientes), Tareas, Finanzas y Enlaces. PWA estática (GitHub Pages) más un widget de iPhone (Scriptable).

**Este repo es público: solo lleva la app.** Ningún dato real vive aquí. Los datos (tareas, clientes, enlaces, bitácoras) salen del Apps Script del agente de Telegram, con una clave que está en el teléfono, no en el código.

## Estructura

- `index.html`, `assets/app.js`, `assets/portal.css`: el portal.
- `manifest.webmanifest`, `sw.js`: instalación en la pantalla de inicio (el service worker solo guarda la carcasa, nunca los datos).
- `assets/logos/`: `adcom.png` (clientes de Adcom) y `me.png` (freelance y personal) más los logos de plataformas y herramientas; la clave es la de la herramienta (`basis`, `analytics`, `tagmanager`, `openai`, `ucompensar`, `drive`, `sheets`, `github`). Si falta el archivo se muestran las iniciales.
- `assets/icons/`: favicon e íconos con el logo «me» circular. `assets/foto-perfil.jpg`: la foto del avatar.
- `widget/Panel.js`: widget de Scriptable.
- `robots.txt` y `noindex`: no se indexa.

## Cómo se conecta

1. En el proyecto `agente-telegram`: en Propiedades del script crear `PORTAL_USER` (el nombre) y `PORTAL_PASS` (la clave); subir `src/Portal.js` y redesplegar (`clasp push`, `clasp deploy -i …`, ver su CLAUDE.md).
2. En el editor del script correr `portalProtegerClave()` (cifra la clave y borra `PORTAL_PASS`), `portalCrearTokens()` si aún no hay tokens `portalSembrar()` y `portalReemplazarEnlaces()` (carga la lista de enlaces; antes revisar con `portalReemplazarEnlacesVer()`). `portalDiagnostico()` muestra si Trabajo y Finanzas responden.
3. Abrir el portal y entrar con usuario y clave. El script responde el token y queda guardado en el dispositivo; la clave nunca va en la URL ni en el repo.
4. En el iPhone: Safari → Compartir → Agregar a inicio. El widget sigue usando su propio token (`portalEnviarEnlaces()` manda el enlace por Telegram).

Cinco fallos seguidos bloquean el acceso 15 minutos. Para cambiar la clave: escribir de nuevo `PORTAL_PASS` y correr `portalProtegerClave()`. Para rotar el token (p. ej. si se pierde el teléfono): borrar `PORTAL_TOKEN` y correr `portalCrearTokens()`.

## Datos

Las hojas `Clientes` y `Enlaces` del Sheet del agente mandan: se editan ahí. Las bitácoras se leen de Drive (las sincroniza `sync_taller.py` cada 10 minutos).

- **Trabajo** (`?action=trabajo`): la inversión del mes y lo por verificar de cada cliente salen de la sección «Inversión del mes» de su bitácora.
- **Finanzas** (`?action=finanzas`): gastos, ingresos, pagos próximos y movimientos del Sheet del agente.
- **Enlaces**: la hoja `Enlaces` agrupa por `tipo`: `Portal` (portales de clientes), `Plataforma` y `Herramienta`/`Archivo` con cliente `general`, y `Personal`. Lo único por cliente es su portal: los enlaces de la primera versión (anuncios, informes, copys, tableros, forecasts, cuentas) no se muestran; `portalLimpiarEnlaces()` los archiva en la hoja.
- Si el script aún no tiene las acciones `trabajo` y `finanzas`, el panel avisa «Falta subir y redesplegar el script».

## Tareas editables

El panel crea y cambia tareas por `POST ?portal=tarea` (token en el cuerpo): completar, fecha, prioridad, cliente, título, notas, en curso y cancelar. Las escribe el Apps Script con las mismas funciones que usa el bot. La pantalla cambia primero y se revierte si el script responde con error; cada cambio ofrece «Deshacer».


## Móvil (6-nov-2026)

- **Menú lateral:** botón ☰ en la barra superior (solo en pantallas ≤760 px) abre un panel con las 6 secciones. La barra inferior queda con los accesos directos Hoy, Trabajo, Tareas y Finanzas; Notas y Enlaces solo están en el menú.
- **Scroll:** con el cajón de un cliente, el menú o la bitácora abiertos, el fondo queda bloqueado (`body.noscroll`) y cada panel tiene `overscroll-behavior: contain`. Antes el cajón rebotaba y se pegaba al llegar al final.
- **Final de páginas:** se deja espacio inferior para la barra y la zona segura del iPhone; la barra se oculta mientras hay cajón o menú abierto.
- Si el celular no toma los cambios, subir la versión `V` en `sw.js` (hoy `mp-v17`).
