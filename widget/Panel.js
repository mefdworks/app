// Panel de Maicol — widget para Scriptable (iPhone).
// Primera vez: abre este script dentro de Scriptable, ejecútalo y pega la clave del widget (WIDGET_TOKEN, en las
// propiedades del Apps Script) o el enlace del WIDGET. Se guarda en el llavero del teléfono; no queda en el código.
// Después agrega un widget de Scriptable a la pantalla de inicio y elige este script.
//
// Versiones (parámetro del widget: mantén pulsado → Editar widget → Parameter):
//   tareas (por defecto) · agenda · finanzas
// Tamaños: pequeño, mediano, grande y pantalla de bloqueo (circular, rectangular y en línea).
// Si lo ejecutas dentro de Scriptable te deja elegir versión y tamaño para probarlo.

const CLAVE = 'mp_widget';
// Despliegue publicado del Apps Script del agente. Sola no da acceso a nada: sin clave responde "no autorizado".
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxmVtjvsmTBMg81foW9QJmsrEzeywOiR2BKiMZBzlIP4-VgNlPwkqS8FVJo-CcrsWi/exec';
const PORTAL = 'https://app.maicolespinosa.com/';
const VERSIONES = ['tareas', 'agenda', 'finanzas'];
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

function versionDe(param) {
  const v = String(param || '').trim().toLowerCase();
  return VERSIONES.indexOf(v) >= 0 ? v : 'tareas';
}

async function datos(cfg, version) {
  const req = new Request(SCRIPT_URL + '?action=widget&t=' + encodeURIComponent(cfg.k) + (version === 'tareas' ? '' : '&v=' + version));
  req.timeoutInterval = 20;
  const r = await req.loadJSON();
  if (r.error) throw new Error(r.error);
  return r;
}

function fechaCorta(iso) {
  const p = iso.split('-');
  return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+p[1] - 1] + ' ' + (+p[2]);
}

function pesos(n) {
  const a = Math.abs(n || 0);
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1).replace('.', ',') + ' M';
  if (a >= 1e3) return '$' + Math.round(n / 1e3) + ' mil';
  return '$' + Math.round(n || 0);
}

function horaAhora() {
  const d = new Date();
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

// Eventos que faltan hoy: los de todo el día y los que no han pasado.
function agendaRestante(d) {
  const ahora = horaAhora();
  return (d.agenda || []).filter(function (e) { return !/^\d/.test(e.hora) || e.hora >= ahora; });
}

function texto(stack, t, tam, color, peso, lineas) {
  const x = stack.addText(String(t));
  x.font = peso ? Font.boldSystemFont(tam) : Font.systemFont(tam);
  x.textColor = color || INK;
  if (lineas) x.lineLimit = lineas;
  return x;
}

// Pantalla de bloqueo: sin colores propios, el sistema los tiñe.
function textoBloqueo(w, t, tam, peso, lineas) {
  const x = w.addText(String(t));
  x.font = peso ? Font.boldSystemFont(tam) : Font.systemFont(tam);
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

function pagosProximos(d) {
  return (d.finanzas && d.finanzas.pagos) || [];
}

// ── Pantalla de bloqueo ──
function bloqueo(d, version, familia) {
  const w = new ListWidget();
  w.url = PORTAL;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  let numero, etiqueta, inline, l1, l2;
  if (version === 'agenda') {
    const ev = agendaRestante(d);
    numero = ev.length; etiqueta = 'eventos';
    inline = ev[0] ? ev[0].hora + ' ' + ev[0].titulo : 'Sin agenda';
    l1 = ev[0] ? ev[0].hora + ' ' + ev[0].titulo : 'Sin más eventos hoy';
    l2 = ev[1] ? ev[1].hora + ' ' + ev[1].titulo : '';
  } else if (version === 'finanzas') {
    const f = d.finanzas;
    const pg = pagosProximos(d);
    numero = pg.length; etiqueta = 'pagos';
    inline = f ? 'Gasto ' + pesos(f.gasto) : 'Sin datos';
    l1 = f ? 'Gasto del mes ' + pesos(f.gasto) : 'Sin datos';
    l2 = pg[0] ? fechaCorta(pg[0].fecha) + ' ' + pg[0].nombre : 'Sin pagos próximos';
  } else {
    numero = d.vencidas + d.deHoy; etiqueta = 'hoy';
    inline = d.vencidas + ' vencidas · ' + d.deHoy + ' hoy';
    l1 = 'Vencidas ' + d.vencidas + ' · Hoy ' + d.deHoy;
    l2 = d.evento ? d.evento.hora + ' ' + d.evento.titulo : (d.proximas[0] ? d.proximas[0].tarea : 'Todo al día');
  }
  if (familia === 'accessoryInline') { textoBloqueo(w, inline, 12, true, 1); return w; }
  if (familia === 'accessoryCircular') {
    const n = textoBloqueo(w, numero, 24, true, 1); n.centerAlignText();
    const e = textoBloqueo(w, etiqueta, 9, false, 1); e.centerAlignText();
    return w;
  }
  textoBloqueo(w, l1, 13, true, 1);
  if (l2) textoBloqueo(w, l2, 12, false, 2);
  return w;
}

// ── Pantalla de inicio ──
function armarTareas(w, d, familia) {
  if (familia === 'small') {
    const fila = w.addStack();
    fila.layoutHorizontally();
    cifra(fila, d.vencidas, 'Vencidas', d.vencidas ? ROJO : INK);
    fila.addSpacer();
    cifra(fila, d.deHoy, 'Hoy', INK);
    w.addSpacer(6);
    if (d.evento) { texto(w, d.evento.hora + ' ' + d.evento.titulo, 11, INK, true, 2); }
    else if (d.proximas[0]) { texto(w, d.proximas[0].tarea, 11, INK, true, 2); }
    else texto(w, 'Todo al día', 11, SUAVE, true);
    return;
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
}

function armarAgenda(w, d, familia) {
  const ev = agendaRestante(d);
  texto(w, 'Agenda de hoy', 10, SUAVE, true);
  w.addSpacer(4);
  const max = familia === 'small' ? 2 : (familia === 'large' || familia === 'extraLarge' ? 9 : 4);
  ev.slice(0, max).forEach(function (e) {
    const f = w.addStack();
    f.layoutHorizontally();
    f.centerAlignContent();
    texto(f, e.hora, familia === 'small' ? 11 : 13, AMARILLO, true, 1);
    f.addSpacer(8);
    texto(f, e.titulo, familia === 'small' ? 11 : 13, INK, true, familia === 'small' ? 2 : 1);
    f.addSpacer();
    w.addSpacer(5);
  });
  if (!ev.length) texto(w, 'Sin más eventos hoy.', 12, SUAVE, true);
  else if (ev.length > max) texto(w, '+' + (ev.length - max) + ' más', 10, SUAVE, true);
  w.addSpacer();
}

function armarFinanzas(w, d, familia) {
  const f = d.finanzas;
  if (!f) { texto(w, 'Sin datos de finanzas', 12, SUAVE, true); return; }
  const pg = pagosProximos(d);
  if (familia === 'small') {
    texto(w, 'Gasto del mes', 10, SUAVE, true);
    const t = texto(w, pesos(f.gasto), 26, INK, true);
    t.minimumScaleFactor = 0.6;
    texto(w, 'Mes anterior ' + pesos(f.gasto_ant), 10, SUAVE, true, 1);
    w.addSpacer(6);
    if (pg[0]) texto(w, fechaCorta(pg[0].fecha) + ' · ' + pg[0].nombre, 11, INK, true, 2);
    else texto(w, 'Sin pagos próximos', 11, SUAVE, true);
    return;
  }
  const fila = w.addStack();
  fila.layoutHorizontally();
  fila.centerAlignContent();
  cifra(fila, pesos(f.gasto), 'Gasto del mes', INK);
  fila.addSpacer(20);
  cifra(fila, pesos(f.ingresos), 'Ingresos', INK);
  fila.addSpacer(20);
  cifra(fila, pesos(f.gasto_ant), 'Mes anterior', SUAVE);
  fila.addSpacer();
  w.addSpacer(8);
  texto(w, 'Pagos próximos', 10, SUAVE, true);
  w.addSpacer(4);
  const max = familia === 'large' || familia === 'extraLarge' ? 6 : 3;
  pg.slice(0, max).forEach(function (x) {
    const r = w.addStack();
    r.layoutHorizontally();
    r.centerAlignContent();
    texto(r, fechaCorta(x.fecha), 10, SUAVE, true, 1);
    r.addSpacer(8);
    texto(r, x.nombre, 12, INK, true, 1);
    r.addSpacer();
    texto(r, pesos(x.monto), 12, INK, true, 1);
    w.addSpacer(4);
  });
  if (!pg.length) texto(w, 'Sin pagos en los próximos 31 días.', 12, SUAVE, true);
  w.addSpacer();
}

function armar(d, familia, version) {
  if (/^accessory/.test(familia)) return bloqueo(d, version, familia);
  const w = new ListWidget();
  w.backgroundColor = FONDO;
  w.setPadding(14, 14, 12, 14);
  w.url = PORTAL + '#' + (version === 'finanzas' ? 'finanzas' : 'hoy');
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  if (version === 'agenda') armarAgenda(w, d, familia);
  else if (version === 'finanzas') armarFinanzas(w, d, familia);
  else armarTareas(w, d, familia);
  return w;
}

// Dentro de Scriptable (no en la pantalla de inicio): elegir versión y tamaño para probar.
async function elegir() {
  const a = new Alert();
  a.title = 'Versión';
  ['Tareas', 'Agenda', 'Finanzas'].forEach(function (x) { a.addAction(x); });
  a.addCancelAction('Cancelar');
  const i = await a.present();
  if (i < 0) return null;
  const b = new Alert();
  b.title = 'Tamaño';
  ['Pequeño', 'Mediano', 'Grande', 'Bloqueo rectangular', 'Bloqueo circular', 'Bloqueo en línea'].forEach(function (x) { b.addAction(x); });
  b.addCancelAction('Cancelar');
  const j = await b.present();
  if (j < 0) return null;
  return { version: VERSIONES[i], familia: ['small', 'medium', 'large', 'accessoryRectangular', 'accessoryCircular', 'accessoryInline'][j] };
}

async function mostrar(w, familia) {
  if (familia === 'small') return w.presentSmall();
  if (familia === 'large') return w.presentLarge();
  if (familia === 'accessoryRectangular') return w.presentAccessoryRectangular();
  if (familia === 'accessoryCircular') return w.presentAccessoryCircular();
  if (familia === 'accessoryInline') return w.presentAccessoryInline();
  return w.presentMedium();
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
  let version = versionDe(args.widgetParameter);
  let familia = config.widgetFamily || 'medium';
  if (!config.runsInWidget) {
    const sel = await elegir();
    if (!sel) return;
    version = sel.version;
    familia = sel.familia;
  }
  let w;
  try {
    const d = await datos(cfg, version);
    w = armar(d, familia, version);
  } catch (e) {
    w = new ListWidget();
    w.backgroundColor = FONDO;
    texto(w, 'No pude leer el panel', 13, ROJO, true);
    texto(w, String(e.message || e), 10, SUAVE);
  }
  if (config.runsInWidget) Script.setWidget(w);
  else await mostrar(w, familia);
  Script.complete();
}
await main();
