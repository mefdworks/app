// Panel de Maicol — widget para Scriptable (iPhone).
// Primera vez: abre este script dentro de Scriptable, ejecútalo y pega la clave del widget (WIDGET_TOKEN, en las
// propiedades del Apps Script) o el enlace del WIDGET. Se guarda en el llavero del teléfono; no queda en el código.
// Después agrega un widget de Scriptable a la pantalla de inicio y elige este script.

const CLAVE = 'mp_widget';
// Despliegue publicado del Apps Script del agente. Sola no da acceso a nada: sin clave responde "no autorizado".
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxmVtjvsmTBMg81foW9QJmsrEzeywOiR2BKiMZBzlIP4-VgNlPwkqS8FVJo-CcrsWi/exec';
// Paleta de la interfaz de Henry (siempre clara).
const INK = new Color('#1a1a2e');
const FONDO = new Color('#ffffff');
const SUAVE = new Color('#8a8aaa');
const AMARILLO = new Color('#f9b431');
const ROJO = new Color('#c44a2a');

async function configurar() {
  const a = new Alert();
  a.title = 'Clave del widget';
  a.message = 'Pega la clave (WIDGET_TOKEN) o el enlace completo que mandó el bot.';
  a.addTextField('Clave');
  a.addAction('Guardar');
  a.addCancelAction('Cancelar');
  if ((await a.present()) < 0) return null;
  let k = a.textFieldValue(0).trim();
  const m = k.match(/[#&]k=([A-Za-z0-9_-]+)/);
  if (m) k = m[1];
  if (!/^[A-Za-z0-9_-]{16,}$/.test(k)) { const e = new Alert(); e.message = 'No reconozco esa clave.'; e.addAction('OK'); await e.present(); return null; }
  Keychain.set(CLAVE, JSON.stringify({ k: k }));
  return { k: k };
}

async function datos(cfg) {
  const req = new Request(SCRIPT_URL + '?action=widget&t=' + encodeURIComponent(cfg.k));
  req.timeoutInterval = 20;
  const r = await req.loadJSON();
  if (r.error) throw new Error(r.error);
  return r;
}

function fechaCorta(iso) {
  const p = iso.split('-');
  return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+p[1] - 1] + ' ' + (+p[2]);
}

function texto(stack, t, tam, color, peso, lineas) {
  const x = stack.addText(String(t));
  x.font = peso ? Font.boldSystemFont(tam) : Font.systemFont(tam);
  x.textColor = color || INK;
  if (lineas) x.lineLimit = lineas;
  return x;
}

function cifra(stack, n, etiqueta, color) {
  const c = stack.addStack();
  c.layoutVertically();
  const t = texto(c, n, 26, color, true);
  t.minimumScaleFactor = 0.6;
  texto(c, etiqueta, 10, SUAVE, true);
}

function armar(d, familia) {
  const w = new ListWidget();
  w.backgroundColor = FONDO;
  w.setPadding(14, 14, 12, 14);
  w.url = 'https://app.maicolespinosa.com/#hoy';
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  if (familia === 'small' || familia === 'accessoryRectangular') {
    const fila = w.addStack();
    fila.layoutHorizontally();
    cifra(fila, d.vencidas, 'Vencidas', d.vencidas ? ROJO : INK);
    fila.addSpacer();
    cifra(fila, d.deHoy, 'Hoy', INK);
    w.addSpacer(6);
    if (d.evento) { texto(w, d.evento.hora + ' ' + d.evento.titulo, 11, INK, true, 2); }
    else if (d.proximas[0]) { texto(w, d.proximas[0].tarea, 11, INK, true, 2); }
    else texto(w, 'Todo al día', 11, SUAVE, true);
    return w;
  }

  const fila = w.addStack();
  fila.layoutHorizontally();
  fila.centerAlignContent();
  cifra(fila, d.vencidas, 'Vencidas', d.vencidas ? ROJO : INK);
  fila.addSpacer(20);
  cifra(fila, d.deHoy, 'Para hoy', INK);
  fila.addSpacer(20);
  cifra(fila, d.semana, 'Semana', INK);
  fila.addSpacer();
  if (d.evento) {
    const e = fila.addStack();
    e.layoutVertically();
    texto(e, 'Siguiente', 10, SUAVE, true);
    texto(e, d.evento.hora, 16, INK, true);
    texto(e, d.evento.titulo, 10, SUAVE, false, 1);
  }
  w.addSpacer(8);
  const max = familia === 'large' || familia === 'extraLarge' ? 10 : 3;
  d.proximas.slice(0, max).forEach(function (t) {
    const f = w.addStack();
    f.layoutHorizontally();
    f.centerAlignContent();
    const color = t.fecha < d.hoy ? ROJO : (t.prioridad === 'alta' ? ROJO : AMARILLO);
    const punto = f.addText('●');
    punto.font = Font.systemFont(8);
    punto.textColor = color;
    f.addSpacer(6);
    texto(f, t.tarea, 12, INK, true, 1);
    f.addSpacer();
    texto(f, t.cliente ? t.cliente + ' · ' + fechaCorta(t.fecha) : fechaCorta(t.fecha), 10, t.fecha < d.hoy ? ROJO : SUAVE, true, 1);
    w.addSpacer(4);
  });
  if (!d.proximas.length) texto(w, 'Todo al día. Sin tareas con fecha esta semana.', 12, SUAVE, true);
  w.addSpacer();
  return w;
}

async function main() {
  let cfg = null;
  try { cfg = JSON.parse(Keychain.contains(CLAVE) ? Keychain.get(CLAVE) : 'null'); } catch (e) { cfg = null; }
  if (!cfg || !cfg.k) {
    cfg = null;
    if (config.runsInWidget) {
      const w = new ListWidget();
      texto(w, 'Abre Scriptable y ejecuta este script para conectarlo.', 12, INK, true);
      Script.setWidget(w);
      return;
    }
    cfg = await configurar();
    if (!cfg) return;
  }
  let w;
  try {
    const d = await datos(cfg);
    w = armar(d, config.widgetFamily || 'medium');
  } catch (e) {
    w = new ListWidget();
    w.backgroundColor = FONDO;
    texto(w, 'No pude leer el panel', 13, ROJO, true);
    texto(w, String(e.message || e), 10, SUAVE);
  }
  if (config.runsInWidget) Script.setWidget(w);
  else await w.presentMedium();
  Script.complete();
}
await main();
