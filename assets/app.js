/* Michael Espinosa · Estratega Digital — panel personal. Lee el endpoint del Apps Script del agente (datos, trabajo, finanzas, bitácoras). */
(function () {
  'use strict';

  // ── Utilidades ──
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var CFG = null;        // { u: url del Apps Script, k: clave }
  var D = null;          // tareas, agenda, clientes y enlaces
  var TRAB = null;       // inversión y por verificar por cliente (de las bitácoras)
  var FIN = null;        // finanzas del mes
  var TRAB_ERR = '', FIN_ERR = '';
  var VERIF = null;      // "por verificar" (carga perezosa)
  var BIT = {};          // bitácoras por cliente
  var st = { vista: 'lista', filtro: 'Todos', q: '', tarea: 'Todas', tcliente: '' };
  var abierto = null;    // cliente abierto en el panel lateral

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
  function lsJson(k) { try { return JSON.parse(lsGet(k) || 'null'); } catch (e) { return null; } }
  function seguro(url) { return /^https?:\/\//i.test(url || '') ? url : '#'; }
  function host(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, ''); }
  function COP(n) { return '$' + Math.round(n).toLocaleString('es-CO'); }
  function M(n) { return '$' + (n / 1e6).toFixed(1).replace('.', ',') + ' M'; }

  var ICONOS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
    wallet: '<path d="M3 7a2 2 0 012-2h13v4"/><path d="M3 7v11a2 2 0 002 2h15a1 1 0 001-1v-9a1 1 0 00-1-1H5a2 2 0 01-2-2z"/><circle cx="16.5" cy="14" r="1.2"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    refresh: '<path d="M20 11A8 8 0 006 6.3L4 8.5"/><path d="M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0014 4.7l2-2.2"/><path d="M20 20v-4.5h-4.5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M9 7h6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    chev: '<path d="M9 5l7 7-7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', arrow: '<path d="M7 17L17 7M9 7h8v8"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
  };
  function ic(n, c) { return '<svg class="i ' + (c || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONOS[n] + '</svg>'; }

  // ── Fechas ──
  function hoyIso() { return (D && D.hoy) || new Date().toISOString().slice(0, 10); }
  function parse(iso) { var p = String(iso).slice(0, 10).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dias(iso) { return Math.round((parse(iso) - parse(hoyIso())) / 86400000); }
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  function corta(iso) { var d = parse(iso); return DIA[d.getDay()] + ' ' + d.getDate() + ' ' + MES[d.getMonth()]; }
  function diaMes(iso) { var d = parse(iso); return d.getDate() + ' ' + MES[d.getMonth()]; }
  function chipFecha(iso) {
    if (!iso) return '';
    var n = dias(iso);
    if (n < 0) return '<span class="chip crit">Vencida · ' + (n === -1 ? 'ayer' : 'hace ' + (-n) + ' d') + '</span>';
    if (n === 0) return '<span class="chip acc">Hoy</span>';
    if (n === 1) return '<span class="chip">Mañana</span>';
    return '<span class="chip">' + corta(iso) + '</span>';
  }
  function fechaLarga() {
    var d = parse(hoyIso());
    var t = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getDay()] + ' ' + d.getDate() + ' de ' + MESL[d.getMonth()];
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function saludo() { var h = new Date().getHours(); return h < 12 ? 'Buen día' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }

  // ── Datos ──
  function api(action, params) {
    var u = new URL(CFG.u);
    u.searchParams.set('action', action);
    u.searchParams.set('t', CFG.k);
    Object.keys(params || {}).forEach(function (k) { u.searchParams.set(k, params[k]); });
    return fetch(u.toString()).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.error) { var e = new Error(j.error); e.auth = j.error === 'no autorizado'; throw e; }
      return j;
    });
  }
  // Enlaces con tipo «Archivado» (los que reemplazó la semilla nueva) no se muestran.
  function visibles(d) { if (d && d.enlaces) d.enlaces = d.enlaces.filter(function (l) { return l.tipo !== 'Archivado'; }); return d; }
  function clientesTodos() { return D.clientes.filter(function (c) { return c.cliente !== 'general'; }); }
  function clienteDe(t) {
    var c = norm(t.cliente), n = norm(t.negocio);
    var lista = D.clientes, i, j, alias;
    for (i = 0; i < lista.length; i++) {
      alias = String(lista[i].alias || '').split(',').map(norm).filter(Boolean);
      alias.push(norm(lista[i].nombre), norm(lista[i].cliente));
      if (c && alias.indexOf(c) >= 0) return lista[i].cliente;
    }
    if (!c) for (j = 0; j < lista.length; j++) { if (norm(lista[j].cliente) === n) return lista[j].cliente; }
    return '';
  }
  function cliente(clave) { return D.clientes.filter(function (x) { return x.cliente === clave; })[0]; }
  function nombreCliente(clave) { var c = cliente(clave); return c ? c.nombre : ''; }
  function perfilDe(clave) { var c = cliente(clave); return c ? norm(c.perfil) : ''; }
  function tareasAbiertas() { return D.tareas.map(function (t) { t._c = clienteDe(t); return t; }); }
  function orden(a, b) {
    var pa = { alta: 0, media: 1, baja: 2 };
    var fa = a.fecha_limite || '9999', fb = b.fecha_limite || '9999';
    return fa < fb ? -1 : fa > fb ? 1 : (pa[a.prioridad] == null ? 1 : pa[a.prioridad]) - (pa[b.prioridad] == null ? 1 : pa[b.prioridad]);
  }
  function inicial(n) {
    var p = String(n).trim().split(/\s+/);
    if (p.length === 1) return p[0].charAt(0).toUpperCase() + p[0].charAt(1).toLowerCase();
    return (p[0].charAt(0) + p[1].charAt(0)).toUpperCase();
  }

  // ── Logos: assets/logos/<clave>.png; si el archivo no existe se muestran las iniciales ──
  var ALIAS_LOGO = { basisdsp: 'basis', googleanalytics: 'analytics', googletagmanager: 'tagmanager', anunciosopenai: 'openai', campanasucompensar: 'ucompensar',
    driveadcom: 'drive', drivepersonal: 'drive', googledrive: 'drive', googlesheets: 'sheets', github: 'github', githubadcom: 'github', githubpersonal: 'github',
    xads: 'x', portaladcom: 'general', panelpersonal: 'general', shopifymara: 'mara' };
  var MARCAS = [[/facebook\.com|fb\.com|instagram\.com/, 'meta'], [/^ads\.google\.com$/, 'google'], [/tiktok\.com/, 'tiktok'],
    [/linkedin\.com/, 'linkedin'], [/(^|\.)x\.com$|twitter\.com$/, 'x'], [/youtube\.com/, 'youtube']];
  function marca(url) {
    var h = host(url);
    for (var i = 0; i < MARCAS.length; i++) if (MARCAS[i][0].test(h)) return MARCAS[i][1];
    return '';
  }
  function logoKey(l) {
    var m = marca(l.url);
    if (m) return m;
    if (l.tipo === 'Portal' && l.cliente && l.cliente !== 'general') return l.cliente;
    var s = slug(l.nombre);
    return ALIAS_LOGO[s] || s;
  }
  var SIN_LOGO = {};
  // Cuando un archivo no existe, el contenedor vuelve a mostrar el texto de respaldo (data-mono).
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.dataset.logo) return;
    SIN_LOGO[img.dataset.logo] = 1;
    var box = img.parentNode;
    if (box) { box.classList.remove('logo'); box.insertAdjacentText('afterbegin', box.dataset.mono || ''); }
    img.remove();
  }, true);
  function conLogo(key, mono) { return SIN_LOGO[key] ? esc(mono) : '<img src="assets/logos/' + esc(key) + '.png" alt="" data-logo="' + esc(key) + '">'; }
  function avatar(c, sem) {
    var mono = inicial(c.nombre);
    return '<div class="av ' + perfilDe(c.cliente) + (SIN_LOGO[c.cliente] ? '' : ' logo') + '" data-mono="' + esc(mono) + '">' + conLogo(c.cliente, mono) + (sem ? '<span class="sem ' + sem + '"></span>' : '') + '</div>';
  }
  function tileIco(l) {
    var key = logoKey(l), mono = inicial(l.nombre);
    var pf = l.tipo === 'Portal' ? perfilDe(l.cliente) : '';
    return '<span class="ti' + (pf ? ' av ' + pf : '') + '" data-mono="' + esc(mono) + '">' + conLogo(key, mono) + '</span>';
  }
  function tile(l) {
    var c = l.cliente !== 'general' ? cliente(l.cliente) : null;
    var apoyo = l.detalle || (c ? c.nombre + ' · ' + l.tipo : host(l.url));
    return '<a class="tile2" href="' + esc(seguro(l.url)) + '" target="_blank" rel="noopener">' + tileIco(l) +
      '<span class="tl"><b>' + esc(l.nombre) + '</b><small>' + esc(apoyo) + '</small></span></a>';
  }
  function grupos() {
    var E = D.enlaces, g = function (l) { return l.cliente === 'general'; };
    var port = E.filter(function (l) { return l.tipo === 'Portal'; });
    return [
      ['Portales de clientes', port.filter(function (l) { return g(l) || perfilDe(l.cliente) === 'adcom'; })],
      ['Plataformas de anuncios', E.filter(function (l) { return l.tipo === 'Plataforma' && g(l); })],
      ['Drive, hojas y código', E.filter(function (l) { return (l.tipo === 'Herramienta' || l.tipo === 'Archivo' || l.tipo === 'Código') && g(l); })],
      ['Personal y freelance', port.filter(function (l) { return !g(l) && perfilDe(l.cliente) !== 'adcom'; }).concat(E.filter(function (l) { return l.tipo === 'Personal'; }))]
    ];
  }

  // ── Piezas ──
  function filaTarea(t) {
    var perfil = t._c ? perfilDe(t._c) : '';
    var cl = t._c ? '<a class="chip ' + perfil + '" href="#c/' + esc(t._c) + '">' + esc(nombreCliente(t._c)) + '</a>'
      : (t.cliente || t.negocio ? '<span class="chip">' + esc(t.cliente || t.negocio) + '</span>' : '');
    return '<div class="row"><span class="dot ' + esc(t.prioridad) + '" title="Prioridad ' + esc(t.prioridad) + '"></span><div class="t"><b>' + esc(t.tarea) + '</b>' +
      (t.notas ? '<small>' + esc(t.notas) + '</small>' : '') +
      '<div class="meta">' + chipFecha(t.fecha_limite) + cl + (t.estado === 'en curso' ? '<span class="chip">En curso</span>' : '') + '</div></div></div>';
  }
  function listaTareas(ts, vacio) {
    return ts.length ? '<div class="card list">' + ts.map(filaTarea).join('') + '</div>' : '<div class="card empty">' + esc(vacio) + '</div>';
  }
  function sec(titulo, accion) { return '<div class="sec"><h2 class="s">' + esc(titulo) + '</h2>' + (accion || '') + '</div>'; }

  // ── Markdown (bitácoras) ──
  function md(src) {
    var inline = function (s) {
      s = esc(s);
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
      s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
      return s;
    };
    var cells = function (l) { return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); }); };
    var L = String(src || '').replace(/\r/g, '').split('\n'), out = [], i = 0, m;
    while (i < L.length) {
      var l = L[i];
      if (!l.trim()) { i++; continue; }
      if (/^<!--/.test(l.trim())) { i++; continue; }
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { var n = Math.min(m[1].length, 3); out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>'); i++; continue; }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^\s*\|/.test(l) && i + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[i + 1])) {
        var head = cells(l), rows = []; i += 2;
        while (i < L.length && /^\s*\|/.test(L[i])) { rows.push(cells(L[i])); i++; }
        out.push('<div class="tw"><table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
        continue;
      }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        var orde = /^\s*\d+\./.test(l), items = [];
        while (i < L.length && /^\s*([-*]|\d+\.)\s+/.test(L[i])) { items.push(inline(L[i].replace(/^\s*([-*]|\d+\.)\s+/, ''))); i++; }
        out.push((orde ? '<ol>' : '<ul>') + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + (orde ? '</ol>' : '</ul>'));
        continue;
      }
      if (/^>\s?/.test(l)) { var q = []; while (i < L.length && /^>\s?/.test(L[i])) { q.push(inline(L[i].replace(/^>\s?/, ''))); i++; } out.push('<blockquote>' + q.join('<br>') + '</blockquote>'); continue; }
      var par = [];
      while (i < L.length && L[i].trim() && !/^(#{1,4}\s|\s*\||\s*([-*]|\d+\.)\s|>)/.test(L[i])) { par.push(inline(L[i])); i++; }
      if (!par.length) { par.push(inline(L[i])); i++; }
      out.push('<p>' + par.join('<br>') + '</p>');
    }
    return '<div class="md">' + out.join('') + '</div>';
  }

  // ── Trabajo: estado de cada cliente ──
  // Ritmo = % del presupuesto gastado entre % del mes transcurrido. Pasa de 1,3 cuando gasta mucho más rápido de lo previsto.
  function info(c) {
    var h = hoyIso();
    var ts = tareasAbiertas().filter(function (t) { return t._c === c.cliente; });
    var venc = ts.filter(function (t) { return t.fecha_limite && t.fecha_limite < h; }).length;
    var T = (TRAB && TRAB.clientes && TRAB.clientes[c.bitacora || c.cliente]) || {};
    var inv = T.inv || null;
    var ritmo = inv && inv.pct != null && inv.esperado ? inv.pct / inv.esperado : null;
    var alto = !!(ritmo && ritmo > 1.3 && inv.pct - inv.esperado >= 7);
    var atras = inv && inv.datos_hasta && dias(inv.datos_hasta) < -3 ? 1 : 0;
    var verV = T.ver_venc || 0;
    var e = (venc >= 2 || alto) ? 'crit' : (venc || verV || atras) ? 'warn' : (!inv || inv.presupuesto_n == null) ? 'info' : 'ok';
    var u = venc * 4 + Math.min(verV, 6) * 0.5 + (alto ? 4 : 0) + atras;
    return { c: c, ts: ts, venc: venc, T: T, inv: inv, ritmo: ritmo, alto: alto, atras: atras, ver: T.ver || 0, verV: verV, e: e, u: u };
  }
  function infos() { return clientesTodos().map(info).sort(function (a, b) { return b.u - a.u || a.c.nombre.localeCompare(b.c.nombre); }); }
  var ETQ = { crit: 'Atender', warn: 'Revisar', ok: 'Al día', info: 'Sin presupuesto' };
  var ETQ_CL = { crit: 'crit', warn: 'warn', ok: 'good', info: '' };

  // ── Vistas ──
  function vHoy() {
    var ts = tareasAbiertas(), h = hoyIso(), I = infos();
    var venc = ts.filter(function (t) { return t.fecha_limite && t.fecha_limite < h; }).sort(orden);
    var hoy = ts.filter(function (t) { return t.fecha_limite === h; }).sort(orden);
    var sem = ts.filter(function (t) { var n = dias(t.fecha_limite || '9999-01-01'); return t.fecha_limite && n > 0 && n <= 7; }).sort(orden);
    var ag = D.agenda || [];
    var atn = [];
    I.forEach(function (x) {
      if (x.venc) atn.push({ t: x.venc + ' tarea' + (x.venc > 1 ? 's' : '') + ' vencida' + (x.venc > 1 ? 's' : '') + ' en ' + x.c.nombre, s: 'Trabajo · ' + x.c.perfil, i: 'alert', c: 'crit', k: x.c.cliente, w: x.venc * 4 });
      if (x.alto) atn.push({ t: x.c.nombre + ' gasta más rápido de lo previsto', s: x.inv.gasto + ' de ' + x.inv.presupuesto + ' · va ' + x.inv.pct + '% y el mes ' + x.inv.esperado + '%', i: 'chart', c: 'warn', k: x.c.cliente, w: 3 });
      if (x.atras) atn.push({ t: 'Datos atrasados en ' + x.c.nombre, s: 'Hojas con datos hasta el ' + corta(x.inv.datos_hasta), i: 'refresh', c: 'warn', k: x.c.cliente, w: 1.5 });
    });
    var sinCliente = venc.filter(function (t) { return !t._c; }).length;
    if (sinCliente) atn.push({ t: sinCliente + ' tarea' + (sinCliente > 1 ? 's' : '') + ' vencida' + (sinCliente > 1 ? 's' : '') + ' sin cliente', s: 'Personal o por asignar', i: 'alert', c: 'crit', go: 'tareas/venc', w: sinCliente * 2 });
    if (FIN) FIN.pagos.forEach(function (p) {
      var n = dias(p.fecha);
      if (n <= 7) atn.push({ t: p.nombre + (n < 0 ? ' venció' : n === 0 ? ' se paga hoy' : ' se paga en ' + n + ' día' + (n === 1 ? '' : 's')), s: COP(p.monto) + ' · ' + diaMes(p.fecha), i: 'wallet', c: n <= 0 ? 'crit' : 'warn', go: 'fin', w: 3.5 });
    });
    var nv = I.reduce(function (s, x) { return s + x.verV; }, 0), nb = I.filter(function (x) { return x.verV; }).length;
    if (nv) atn.push({ t: nv + ' punto' + (nv > 1 ? 's' : '') + ' por verificar con fecha vencida', s: 'En ' + nb + ' bitácora' + (nb > 1 ? 's' : '') + ' · Trabajo', i: 'book', c: 'acc', go: 'trabajo', w: 2 });
    atn.sort(function (a, b) { return b.w - a.w; });
    atn = atn.slice(0, 8);
    var favs = D.enlaces.filter(function (l) { return norm(l.favorito) === 'si'; }).slice(0, 8);
    var clientesVenc = I.filter(function (x) { return x.venc; }).length;
    var mesN = FIN ? MESL[+FIN.mes.slice(5, 7) - 1] : '';
    var finKpi = FIN ? '<a class="kpi" href="#fin"><small>Gastado en ' + mesN + '</small><b>' + M(FIN.gasto) + '</b><div class="d">cierras en ~' + M(proyeccion()) + '</div></a>'
      : '<a class="kpi" href="#fin"><small>Gastos del mes</small><b>—</b><div class="d">' + (FIN_ERR ? 'sin datos todavía' : 'cargando…') + '</div></a>';
    return '<div class="view"><div class="head"><div><h1 class="t">' + saludo() + ', <em>Michael</em></h1><p class="sub">' + fechaLarga() + ' · ' + ag.length + ' reunion' + (ag.length === 1 ? '' : 'es') + ' hoy</p></div></div>' +
      '<div class="kpis"><a class="kpi late" href="#tareas/venc"><small>Tareas vencidas</small><b>' + venc.length + '</b><div class="d">en ' + clientesVenc + ' cliente' + (clientesVenc === 1 ? '' : 's') + '</div></a>' +
      '<a class="kpi" href="#tareas/hoy"><small>Para hoy</small><b>' + hoy.length + '</b><div class="d">' + ts.length + ' abiertas en total</div></a>' +
      '<a class="kpi" href="#tareas/sem"><small>Próximos 7 días</small><b>' + sem.length + '</b><div class="d">con fecha</div></a>' + finKpi + '</div>' +
      sec('Necesita tu atención', atn.length ? '<span class="chip">' + atn.length + '</span>' : '') +
      (atn.length ? '<div class="card list">' + atn.map(function (a) {
        return '<a class="row" href="#' + (a.k ? 'c/' + esc(a.k) : a.go) + '"><span class="ico ' + a.c + '">' + ic(a.i) + '</span><span class="t"><b>' + esc(a.t) + '</b><small>' + esc(a.s) + '</small></span>' + ic('chev', 'chev') + '</a>';
      }).join('') + '</div>' : '<div class="card empty">Nada urgente por ahora.</div>') +
      '<div class="grid2"><div>' + sec('Agenda de hoy') +
      (ag.length ? '<div class="card list">' + ag.map(function (e) {
        return '<div class="ev"><time>' + esc(e.hora || '·') + '</time><div><b>' + esc(e.titulo) + '</b>' + (e.cal || e.participantes ? '<small>' + esc((e.cal || '').trim().replace(/[()]/g, '')) + (e.participantes ? (e.cal ? ' · ' : '') + esc(e.participantes) : '') + '</small>' : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="card empty">Sin reuniones hoy.</div>') + '</div>' +
      '<div>' + sec('Mis finanzas', '<a href="#fin">Abrir</a>') + miniFin() + '</div></div>' +
      (favs.length ? sec('Favoritos', '<a href="#enlaces">Todos los enlaces</a>') + '<div class="bals">' + favs.map(tile).join('') + '</div>' : '') +
      '<div class="foot">Actualizado ' + esc((D.actualizado || '').slice(11, 16)) + '</div></div>';
  }
  function miniFin() {
    if (!FIN) return '<div class="card empty">' + (FIN_ERR ? esc(finMensaje()) : 'Cargando finanzas…') + '</div>';
    var f = finCalc(), chip = f.antAlDia > 0 ? '<span class="chip ' + (f.vs <= 0 ? 'good' : 'warn') + '" style="vertical-align:middle">' + (f.vs > 0 ? '+' : '') + f.vs + '%</span>' : '';
    return '<div class="card mini"><small style="color:var(--ink2)">Gasto de ' + MESL[+FIN.mes.slice(5, 7) - 1] + ' contra el mes anterior al mismo día</small><div class="big num" style="margin:2px 0 10px">' + M(FIN.gasto) + ' ' + chip + '</div>' +
      '<div class="bar"><i class="acc" style="width:' + Math.min(100, f.pctAnt) + '%"></i></div><small style="color:var(--ink3);display:block;margin-top:6px">' + f.pctAnt + '% de lo que gastaste en todo ' + MESL[+FIN.mes_anterior.slice(5, 7) - 1] + '</small></div>';
  }
  function finMensaje() { return /desconocida/.test(FIN_ERR) ? 'Falta subir y redesplegar el script del agente (acción «finanzas»).' : 'No pude leer las finanzas: ' + FIN_ERR; }

  // Trabajo
  function filasTrabajo(I) {
    return I.map(function (x) {
      var c = x.c, inv = x.inv, pace;
      if (inv && inv.pct != null && inv.presupuesto_n != null) {
        pace = '<div class="pace"><small><span>' + esc(inv.gasto) + '</span><span>de ' + esc(inv.presupuesto) + '</span></small><div class="bar"><i class="' + (x.alto ? 'acc' : '') + '" style="width:' + Math.min(100, inv.pct * 2.5) + '%"></i><span class="mk" style="left:' + Math.min(100, (inv.esperado || 0) * 2.5) + '%"></span></div></div>';
      } else pace = '<div class="pace"><small><span>' + esc(inv ? (inv.gasto || '—') : (TRAB ? 'Sin dato' : '…')) + '</span><span>' + (inv ? 'sin presupuesto' : '') + '</span></small></div>';
      var r = inv && inv.res ? inv.res : null;
      var res = r ? '<div class="res"><b>' + esc(r.valor) + ' ' + esc(r.nombre.replace(/ \(.*\)/, '').toLowerCase()) + '</b><small>' + (r.costo && r.costo !== '-' ? esc(r.costo) : '') + '</small></div>' : '<div class="res"><small>—</small></div>';
      return '<button class="cl" type="button" data-open="' + esc(c.cliente) + '"><div class="cn">' + avatar(c, x.e) + '<div style="min-width:0"><b>' + esc(c.nombre) + '</b><small>' + esc(c.perfil) + '</small></div></div>' + pace +
        '<div>' + (x.venc ? '<span class="chip crit">' + x.venc + ' venc.</span>' : '<span class="chip">0 venc.</span>') + '</div>' +
        '<div>' + (x.verV ? '<span class="chip warn">' + x.verV + ' verif.</span>' : '<span class="chip">—</span>') + '</div>' + res + ic('chev', 'chev') + '</button>';
    }).join('');
  }
  function tarjetasTrabajo(I) {
    return I.map(function (x) {
      var c = x.c, inv = x.inv;
      return '<button class="cc" type="button" data-open="' + esc(c.cliente) + '"><div class="cn">' + avatar(c, x.e) + '<div><b>' + esc(c.nombre) + '</b><small>' + esc(c.perfil) + '</small></div><span class="chip ' + ETQ_CL[x.e] + '" style="margin-left:auto">' + ETQ[x.e] + '</span></div>' +
        (inv && inv.pct != null ? '<div class="bar"><i style="width:' + Math.min(100, inv.pct * 2.5) + '%"></i><span class="mk" style="left:' + Math.min(100, (inv.esperado || 0) * 2.5) + '%"></span></div>' : '') +
        '<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--ink2)"><span>' + esc(inv ? inv.gasto + (inv.presupuesto ? ' de ' + inv.presupuesto : '') : '—') + '</span><span>' + (inv && inv.res ? esc(inv.res.valor + ' ' + inv.res.nombre.replace(/ \(.*\)/, '').toLowerCase()) : '') + '</span></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' + (x.venc ? '<span class="chip crit">' + x.venc + ' vencida' + (x.venc > 1 ? 's' : '') + '</span>' : '') + (x.verV ? '<span class="chip warn">' + x.verV + ' por verificar</span>' : '') + (!x.venc && !x.verV ? '<span class="chip good">Sin pendientes</span>' : '') + '</div></button>';
    }).join('');
  }
  function listaFiltrada() {
    var q = norm(st.q);
    return infos().filter(function (x) {
      if (st.filtro === 'Con alertas' && (x.e === 'ok' || x.e === 'info')) return false;
      if ((st.filtro === 'Adcom' || st.filtro === 'Freelance' || st.filtro === 'Personal') && x.c.perfil !== st.filtro) return false;
      return !q || norm(x.c.nombre + ' ' + x.c.resumen).indexOf(q) >= 0;
    });
  }
  function vTrabajo() {
    var I = listaFiltrada(), todos = infos(), chico = window.matchMedia('(max-width:760px)').matches;
    var nAt = todos.filter(function (x) { return x.e === 'crit' || x.e === 'warn'; }).length;
    var cuerpo = !I.length ? '<div class="card empty">Ningún cliente coincide.</div>' : (st.vista === 'lista' && !chico)
      ? '<div class="card tbl"><div class="cl h"><span>Cliente</span><span>Inversión del mes</span><span>Tareas</span><span>Bitácora</span><span>Resultado</span><span></span></div><div id="filas">' + filasTrabajo(I) + '</div></div>'
      : '<div class="cards3" id="filas">' + tarjetasTrabajo(I) + '</div>';
    var aviso = TRAB_ERR ? '<div class="banner">' + esc(/desconocida/.test(TRAB_ERR) ? 'Falta subir y redesplegar el script del agente (acción «trabajo»): sin eso no veo la inversión ni lo por verificar.' : 'No pude leer la inversión: ' + TRAB_ERR) + '</div>' : '';
    var pie = TRAB && TRAB.actualizado ? '<div class="foot">Inversión leída de las bitácoras · ' + esc(TRAB.actualizado.slice(11, 16)) + '</div>' : '';
    return '<div class="view">' + aviso + '<div class="head"><div><h1 class="t">Trabajo</h1><p class="sub">' + todos.length + ' clientes ordenados por urgencia · ' + nAt + ' piden atención · la marca de cada barra es dónde debería ir el mes</p></div>' +
      '<div class="seg" role="group" aria-label="Vista"><button type="button" data-vista="lista" class="' + (st.vista === 'lista' ? 'on' : '') + '">Lista</button><button type="button" data-vista="tarjetas" class="' + (st.vista === 'tarjetas' ? 'on' : '') + '">Tarjetas</button></div></div>' +
      '<div class="tools"><label class="search">' + ic('search') + '<input id="q" type="search" placeholder="Buscar cliente" value="' + esc(st.q) + '" autocomplete="off"></label><div class="pills">' +
      ['Todos', 'Con alertas', 'Adcom', 'Freelance', 'Personal'].map(function (f) { return '<button class="pill' + (st.filtro === f ? ' on' : '') + '" type="button" data-f="' + f + '">' + f + '</button>'; }).join('') + '</div></div>' + cuerpo + pie + '</div>';
  }

  // Tareas
  function vTareas() {
    var h = hoyIso(), ts = tareasAbiertas(), f = st.tarea;
    ts = ts.filter(function (t) {
      if (st.tcliente && t._c !== st.tcliente) return false;
      if (f === 'Vencidas') return t.fecha_limite && t.fecha_limite < h;
      if (f === 'Hoy') return t.fecha_limite === h;
      if (f === 'Semana') { var n = t.fecha_limite ? dias(t.fecha_limite) : -1; return n >= 0 && n <= 7; }
      if (f === 'Sin fecha') return !t.fecha_limite;
      return true;
    }).sort(orden);
    return '<div class="view"><div class="head"><div><h1 class="t">Tareas</h1><p class="sub">' + ts.length + ' ' + (f === 'Todas' ? 'abiertas' : f.toLowerCase()) + '</p></div></div><div class="tools"><div class="pills">' +
      ['Todas', 'Vencidas', 'Hoy', 'Semana', 'Sin fecha'].map(function (x) { return '<button class="pill' + (f === x ? ' on' : '') + '" type="button" data-tarea="' + x + '">' + x + '</button>'; }).join('') +
      '<select class="pill" id="tcl" aria-label="Cliente"><option value="">Todos los clientes</option>' + clientesTodos().map(function (c) { return '<option value="' + esc(c.cliente) + '"' + (st.tcliente === c.cliente ? ' selected' : '') + '>' + esc(c.nombre) + '</option>'; }).join('') + '</select></div></div>' +
      listaTareas(ts, 'No hay tareas con ese filtro.') + '</div>';
  }

  // Finanzas
  function cum(a) { var s = 0; return a.map(function (x) { return s += x; }); }
  function proyeccion() { return FIN.dia ? FIN.gasto / FIN.dia * FIN.dias_mes : FIN.gasto; }
  function finCalc() {
    var ca = cum(FIN.diario.ant), antAlDia = ca.length ? ca[Math.min(FIN.dia, ca.length) - 1] : 0, antTot = ca.length ? ca[ca.length - 1] : 0;
    return { ca: ca, cm: cum(FIN.diario.mes).slice(0, FIN.dia), antAlDia: antAlDia, antTot: antTot,
      vs: antAlDia > 0 ? Math.round((FIN.gasto / antAlDia - 1) * 100) : 0, pctAnt: antTot > 0 ? Math.round(FIN.gasto / antTot * 100) : 0 };
  }
  function tope(max) {
    var raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / mag, step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * mag;
    return { step: step, max: Math.ceil(max / step) * step };
  }
  function chartFin(f) {
    var W = 660, H = 230, L = 52, R = 14, T = 14, B = 26, N = Math.max(FIN.dias_mes, f.ca.length), proy = proyeccion();
    var sc = tope(Math.max(f.antTot, proy, FIN.gasto, 1)), max = sc.max;
    var x = function (d) { return L + (d - 1) / (N - 1 || 1) * (W - L - R); }, y = function (v) { return T + (1 - v / max) * (H - T - B); };
    var path = function (a, n) { return a.slice(0, n).map(function (v, i) { return (i ? 'L' : 'M') + x(i + 1).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' '); };
    var grid = '', v;
    for (v = 0; v <= max + 1; v += sc.step) grid += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line2)"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="10" fill="var(--ink3)">' + (v ? M(v).replace('$', '').replace(' M', ' M') : '0') + '</text>';
    [1, 5, 10, 15, 20, 25, 30].forEach(function (d) { if (d <= N) grid += '<text x="' + x(d) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="var(--ink3)">' + d + '</text>'; });
    var n = f.cm.length, hay = n > 0;
    return '<div class="chart" id="chart" data-w="' + W + '" data-h="' + H + '"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gasto acumulado del mes contra el mes anterior"><defs><linearGradient id="g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--pri)" stop-opacity=".3"/><stop offset="1" stop-color="var(--pri)" stop-opacity="0"/></linearGradient></defs>' + grid +
      '<path d="' + path(f.ca, f.ca.length) + '" fill="none" stroke="var(--ink3)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".75"/>' +
      (hay ? '<path d="' + path(f.cm, n) + ' L' + x(n) + ' ' + y(0) + ' L' + x(1) + ' ' + y(0) + ' Z" fill="url(#g1)"/>' +
        '<path d="M' + x(n) + ' ' + y(FIN.gasto) + ' L' + x(FIN.dias_mes) + ' ' + y(proy) + '" fill="none" stroke="var(--acc)" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round"/>' +
        '<path id="lnN" d="' + path(f.cm, n) + '" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        '<circle cx="' + x(n) + '" cy="' + y(FIN.gasto) + '" r="5" fill="var(--acc)" stroke="#fff" stroke-width="2"/>' : '') +
      '<line id="cx" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--ink3)" stroke-dasharray="3 3" opacity="0"/><circle id="co" r="4.5" fill="var(--ink3)" stroke="#fff" stroke-width="2" opacity="0"/>' +
      '<rect id="hit" x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '" fill="transparent"/></svg><div class="tip" id="tip"></div></div>' +
      '<div class="leg"><span><i style="border-color:var(--acc)"></i>' + MESL[+FIN.mes.slice(5, 7) - 1] + '</span><span><i style="border-color:var(--acc);border-top-style:dashed"></i>Proyección al ritmo actual</span><span><i style="border-color:var(--ink3)"></i>' + MESL[+FIN.mes_anterior.slice(5, 7) - 1] + '</span></div>';
  }
  function vFin() {
    if (!FIN) return '<div class="view"><div class="head"><div><h1 class="t">Finanzas</h1></div></div><div class="card empty" style="margin-top:18px">' + (FIN_ERR ? esc(finMensaje()) : '<div class="loading">Cargando finanzas…</div>') + '</div></div>';
    var f = finCalc(), proy = proyeccion(), mes = MESL[+FIN.mes.slice(5, 7) - 1], ant = MESL[+FIN.mes_anterior.slice(5, 7) - 1];
    var maxC = FIN.categorias.length ? FIN.categorias[0][1] : 1, bal = FIN.ingresos - FIN.gasto;
    var pagos = FIN.pagos.map(function (p) {
      var n = dias(p.fecha), d = parse(p.fecha);
      return '<div class="pay"><div class="dt"><b>' + d.getDate() + '</b><small>' + MES[d.getMonth()] + '</small></div><div class="t" style="flex:1;min-width:0"><b>' + esc(p.nombre) + '</b><div style="color:var(--ink3);font-size:11.5px">' + esc(p.tipo) + '</div></div>' +
        (n <= 7 ? '<span class="chip ' + (n <= 0 ? 'crit' : 'warn') + '">' + (n < 0 ? 'Vencido' : n === 0 ? 'Hoy' : 'En ' + n + ' d') + '</span>' : '') + '<b class="num" style="min-width:92px;text-align:right">' + COP(p.monto) + '</b></div>';
    }).join('');
    return '<div class="view"><div class="head"><div><h1 class="t">Finanzas</h1><p class="sub">' + mes.charAt(0).toUpperCase() + mes.slice(1) + ' ' + FIN.mes.slice(0, 4) + ' · día ' + FIN.dia + ' de ' + FIN.dias_mes + '</p></div></div>' +
      '<div class="card fhero"><small style="color:var(--ink2);font-weight:500">Gastado en el mes</small>' +
      '<div class="big"><small>COP</small>' + Math.round(FIN.gasto).toLocaleString('es-CO') + ' ' + (f.antAlDia > 0 ? '<span class="chip ' + (f.vs <= 0 ? 'good' : 'warn') + '" style="vertical-align:middle;font-size:12px">' + (f.vs > 0 ? '+' : '') + f.vs + '% frente a ' + ant + ' al día ' + FIN.dia + '</span>' : '') + '</div>' +
      '<div style="color:var(--ink2);font-size:12.5px">Al ritmo actual cierras en <b style="color:var(--ink)">' + M(proy) + '</b>' + (f.antTot > 0 ? (proy > f.antTot ? ', <span style="color:var(--crit)">' + M(proy - f.antTot) + ' más que ' + ant + ' (' + M(f.antTot) + ')</span>' : ', menos que ' + ant + ' (' + M(f.antTot) + ')') : '') + '. Los pagos fijos que aún no llegan a su día no están contados.</div>' +
      chartFin(f) + '</div>' +
      '<div class="grid2" style="margin-top:14px"><div class="card mini"><h2 class="s" style="margin-bottom:8px">Por categoría</h2>' +
      (FIN.categorias.length ? FIN.categorias.map(function (c, i) { return '<div class="cat"><span>' + esc(c[0]) + '</span><div class="bar"><i class="' + (i === 0 ? 'acc' : '') + '" style="width:' + Math.round(c[1] / maxC * 100) + '%"></i></div><span class="num">' + COP(c[1]) + '</span></div>'; }).join('') : '<div class="empty">Sin gastos este mes.</div>') + '</div>' +
      '<div class="card mini"><h2 class="s" style="margin-bottom:12px">Ingresos y balance</h2>' +
      '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px"><span>Ingresos</span><b class="num" style="color:var(--good)">' + COP(FIN.ingresos) + '</b></div><div class="bar"><i style="background:var(--good);width:100%"></i></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12.5px;margin:12px 0 6px"><span>Gastos</span><b class="num">' + COP(FIN.gasto) + '</b></div><div class="bar"><i class="acc" style="width:' + (FIN.ingresos > 0 ? Math.min(100, Math.round(FIN.gasto / FIN.ingresos * 100)) : 0) + '%"></i></div>' +
      '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--line2);display:flex;justify-content:space-between;align-items:baseline"><span style="color:var(--ink2)">Balance del mes</span><b class="num" style="font-size:20px;color:' + (bal < 0 ? 'var(--crit)' : 'var(--ink)') + '">' + (bal >= 0 ? '+' : '−') + COP(Math.abs(bal)) + '</b></div></div></div>' +
      sec('Próximos pagos', FIN.pagos.some(function (p) { return dias(p.fecha) <= 7; }) ? '<span class="chip warn">hay pagos en menos de 7 días</span>' : '') + (pagos ? '<div class="card list">' + pagos + '</div>' : '<div class="card empty">Sin pagos en los próximos 31 días.</div>') +
      sec('Movimientos recientes') + (FIN.movimientos.length ? '<div class="card tbl">' + FIN.movimientos.map(function (m) {
        return '<div class="mv"><small>' + diaMes(m.fecha) + '</small><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(m.desc) + '</span><span class="chip" style="justify-self:start">' + esc(m.cat || '—') + '</span><span class="amt ' + (m.monto > 0 ? 'in' : '') + '">' + (m.monto > 0 ? '+' : '−') + COP(Math.abs(m.monto)) + '</span></div>';
      }).join('') + '</div>' : '<div class="card empty">Aún no hay movimientos.</div>') +
      '<div class="foot">Actualizado ' + esc((FIN.actualizado || '').slice(11, 16)) + '</div></div>';
  }
  function posFin() {
    var hit = $('#hit');
    if (!hit || !FIN) return;
    var ln = $('#lnN');
    if (ln && ln.getTotalLength && !window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
      var len = ln.getTotalLength(); ln.style.strokeDasharray = len; ln.style.strokeDashoffset = len; ln.getBoundingClientRect();
      ln.style.transition = 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)'; ln.style.strokeDashoffset = 0;
    }
    var f = finCalc(), ch = $('#chart'), svgEl = ch.querySelector('svg'), tip = $('#tip'), cx = $('#cx'), co = $('#co');
    var W = +ch.dataset.w, H = +ch.dataset.h, L = 52, R = 14, T = 14, B = 26, N = Math.max(FIN.dias_mes, f.ca.length);
    var max = tope(Math.max(f.antTot, proyeccion(), FIN.gasto, 1)).max;
    var mover = function (e) {
      var r = svgEl.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
      var d = Math.max(1, Math.min(f.ca.length || 1, Math.round((px - L) / (W - L - R) * (N - 1) + 1)));
      var X = L + (d - 1) / (N - 1 || 1) * (W - L - R), vo = f.ca[d - 1] || 0, vn = d <= f.cm.length ? f.cm[d - 1] : null, Y = T + (1 - vo / max) * (H - T - B);
      cx.setAttribute('x1', X); cx.setAttribute('x2', X); cx.setAttribute('opacity', 1);
      co.setAttribute('cx', X); co.setAttribute('cy', Y); co.setAttribute('opacity', 1);
      tip.innerHTML = '<b>Día ' + d + '</b><div><span>' + MES[+FIN.mes_anterior.slice(5, 7) - 1] + '</span><span>' + COP(vo) + '</span></div><div><span>' + MES[+FIN.mes.slice(5, 7) - 1] + '</span><span>' + (vn != null ? COP(vn) : 'aún no') + '</span></div>';
      tip.style.left = Math.max(80, Math.min(r.width - 80, X / W * r.width)) + 'px'; tip.style.top = (Y / H * r.height - 10) + 'px'; tip.style.opacity = 1;
    };
    hit.addEventListener('pointermove', mover); hit.addEventListener('pointerdown', mover);
    hit.addEventListener('pointerleave', function () { tip.style.opacity = 0; cx.setAttribute('opacity', 0); co.setAttribute('opacity', 0); });
  }

  // Enlaces
  function vEnlaces() {
    var q = norm(st.q), vacio = true;
    var bloques = grupos().map(function (g) {
      var ls = g[1].filter(function (l) { return !q || norm(l.nombre + ' ' + l.detalle + ' ' + nombreCliente(l.cliente) + ' ' + l.url).indexOf(q) >= 0; });
      if (!ls.length) return '';
      vacio = false;
      return sec(g[0]) + '<div class="bals">' + ls.map(tile).join('') + '</div>';
    }).join('');
    return '<div class="view"><div class="head"><div><h1 class="t">Enlaces</h1><p class="sub">Los portales de tus clientes, tus plataformas y tus archivos, sin buscar.</p></div></div>' +
      '<div class="tools"><label class="search" style="max-width:420px">' + ic('search') + '<input id="q" type="search" placeholder="Filtrar enlaces" value="' + esc(st.q) + '" autocomplete="off"></label></div>' +
      (vacio ? '<div class="card empty">' + (D.enlaces.length ? 'Ningún enlace coincide.' : 'Todavía no hay enlaces. Agrégalos en la hoja Enlaces del agente.') + '</div>' : bloques) +
      '<p class="note">Las cuentas, hojas y tableros de cada cliente están en su ficha, dentro de <a href="#trabajo">Trabajo</a>.</p></div>';
  }

  // ── Panel lateral del cliente ──
  function abrir(clave) {
    var c = cliente(clave);
    if (!c) return;
    abierto = clave;
    var x = info(c), inv = x.inv;
    var todos = D.enlaces.filter(function (l) { return l.cliente === clave; });
    var portal = todos.filter(function (l) { return l.tipo === 'Portal'; })[0];
    var resto = todos.filter(function (l) { return l !== portal; });
    var reglas = String(c.reglas || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
    var r = inv && inv.res ? inv.res : null;
    $('#drawer').innerHTML = '<div class="dh">' + avatar(c, x.e) + '<div><h3>' + esc(c.nombre) + '</h3><span class="chip ' + ETQ_CL[x.e] + '">' + esc(c.perfil) + ' · ' + ETQ[x.e] + '</span></div><button class="x" type="button" id="dx" aria-label="Cerrar">' + ic('x') + '</button></div>' +
      '<div class="db">' +
      '<div class="dk"><div><small>Inversión del mes</small><b class="num">' + esc(inv && inv.gasto ? inv.gasto : '—') + '</b><span class="d">' + (inv && inv.presupuesto ? 'de ' + esc(inv.presupuesto) + (inv.pct != null ? ' · ' + inv.pct + '%' : '') : 'sin presupuesto') + '</span></div>' +
      '<div><small>' + esc(r ? r.nombre.replace(/ \(.*\)/, '') : 'Resultado') + '</small><b class="num">' + esc(r ? r.valor : '—') + '</b><span class="d">' + (r && r.meta && r.meta !== '-' ? 'meta ' + esc(r.meta) + (r.pct && r.pct !== '-' ? ' · ' + esc(r.pct) : '') : '') + '</span></div>' +
      '<div><small>Costo por resultado</small><b class="num">' + esc(r && r.costo && r.costo !== '-' ? r.costo : '—') + '</b><span class="d">' + (inv && inv.datos_hasta ? 'datos hasta ' + esc(corta(inv.datos_hasta)) : '') + '</span></div></div>' +
      (portal ? '<a class="hero" href="' + esc(seguro(portal.url)) + '" target="_blank" rel="noopener">' + tileIco(portal) + '<span class="tl"><b>Portal de ' + esc(c.nombre) + '</b><small>' + esc(host(portal.url)) + '</small></span>' + ic('arrow', 'chev') + '</a>' : '') +
      (c.resumen ? '<div class="dsec"><h2 class="s">Resumen</h2><div class="card facts">' + esc(c.resumen) + (reglas.length ? '<ul>' + reglas.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') + '</div></div>' : '') +
      '<div class="dsec"><h2 class="s">Tareas · ' + x.ts.length + '</h2>' + listaTareas(x.ts.sort(orden), 'Sin tareas abiertas.') + '</div>' +
      '<div class="dsec"><h2 class="s">Por verificar</h2><div class="card" id="dv"><div class="loading">Leyendo…</div></div></div>' +
      '<div class="dsec"><h2 class="s">Bitácora</h2><div class="card"><details class="vf" id="dbit"><summary>Abrir la bitácora completa</summary><div id="dbc"><div class="loading">Leyendo…</div></div></details></div></div>' +
      (resto.length ? '<div class="dsec"><h2 class="s">Accesos · ' + resto.length + '</h2><div class="bals">' + resto.map(tile).join('') + '</div></div>' : '') +
      '</div>';
    $('#drawer').classList.add('on'); $('#scrim').classList.add('on');
    $('#dx').onclick = cerrar;
    // Por verificar y bitácora: se leen del Drive solo al abrir.
    var llenarVerif = function () {
      var el = $('#dv'); if (!el || abierto !== clave) return;
      var v = (VERIF.clientes || []).filter(function (z) { return z.cliente === (c.bitacora || c.cliente); })[0];
      el.innerHTML = v ? '<div class="md" style="padding:14px">' + md(v.texto).replace(/^<div class="md">|<\/div>$/g, '') + '</div>' : '<div class="empty">Esta bitácora no tiene pendientes por verificar.</div>';
    };
    if (VERIF) llenarVerif(); else api('verificar').then(function (j) { VERIF = j; llenarVerif(); }).catch(function (e) { var el = $('#dv'); if (el) el.innerHTML = '<div class="empty">No pude leerlo: ' + esc(e.message) + '</div>'; });
    var key = c.bitacora || c.cliente;
    var pintarBit = function (j) {
      var el = $('#dbc'); if (!el || abierto !== clave) return;
      el.innerHTML = j.bitacora ? md(j.bitacora) + (j.recortada ? '<div class="empty">Se muestra el inicio; lo más viejo está recortado.</div>' : '') : '<div class="empty">Este cliente todavía no tiene bitácora.</div>';
    };
    $('#dbit').addEventListener('toggle', function () {
      if (!this.open) return;
      if (BIT[key]) return pintarBit(BIT[key]);
      api('bitacora', { cliente: key }).then(function (j) { BIT[key] = j; pintarBit(j); }).catch(function (e) { var el = $('#dbc'); if (el) el.innerHTML = '<div class="empty">No pude leerla: ' + esc(e.message) + '</div>'; });
    });
  }
  function cerrar() {
    abierto = null; $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on');
    if (/^#c\//.test(location.hash)) history.replaceState(null, '', location.pathname + '#trabajo');
  }

  // ── Buscador ⌘K ──
  var palSel = 0, palItems = [];
  function palRender() {
    $('#plist').innerHTML = palItems.length ? palItems.map(function (a, i) {
      var ico = a.l ? tileIco(a.l).replace('class="ti', 'class="ti sm') : '<span class="ico neu">' + (a.k === 'open' ? esc(inicial(a.n)) : ic('arrow')) + '</span>';
      return '<button class="pit' + (i === palSel ? ' on' : '') + '" type="button" data-i="' + i + '">' + ico + '<span><b>' + esc(a.n) + '</b><small>' + esc(a.d) + '</small></span><span class="k">' + ({ go: 'Sección', open: 'Cliente', link: 'Enlace' }[a.k]) + '</span></button>';
    }).join('') : '<div class="empty">Nada coincide.</div>';
    document.querySelectorAll('.pit').forEach(function (b) { b.onclick = function () { palGo(+b.dataset.i); }; });
  }
  function palFiltrar(t) {
    t = norm(t); var all = [];
    TABS.forEach(function (n) { all.push({ n: n[1], d: 'Ir a la sección', k: 'go', v: n[0] }); });
    clientesTodos().forEach(function (c) { all.push({ n: c.nombre, d: c.perfil + ' · abrir ficha', k: 'open', v: c.cliente }); });
    D.enlaces.forEach(function (l) { all.push({ n: l.nombre, d: (l.cliente !== 'general' ? nombreCliente(l.cliente) + ' · ' : '') + (l.detalle || l.tipo), k: 'link', l: l }); });
    palItems = all.filter(function (a) { return !t || norm(a.n + ' ' + a.d).indexOf(t) >= 0; }).slice(0, 8); palSel = 0; palRender();
  }
  function palGo(i) {
    var a = palItems[i]; if (!a) return; palAbrir(false);
    if (a.k === 'go') location.hash = '#' + a.v; else if (a.k === 'open') location.hash = '#c/' + a.v; else window.open(seguro(a.l.url), '_blank', 'noopener');
  }
  function palAbrir(on) { $('#pal').classList.toggle('on', on); if (on) { $('#pq').value = ''; palFiltrar(''); $('#pq').focus(); } }

  // ── Router ──
  var TABS = [['hoy', 'Hoy', 'home'], ['trabajo', 'Trabajo', 'brief'], ['tareas', 'Tareas', 'check'], ['fin', 'Finanzas', 'wallet'], ['enlaces', 'Enlaces', 'link']];
  function ruta() {
    var p = (location.hash || '#hoy').slice(1).split('/');
    return { v: p[0] || 'hoy', a: p[1] || '' };
  }
  function pintarNav(activa) {
    var venc = D ? tareasAbiertas().filter(function (t) { return t.fecha_limite && t.fecha_limite < hoyIso(); }).length : 0;
    $('#navs').innerHTML = TABS.map(function (t) {
      return '<a class="nav' + (activa === t[0] ? ' on' : '') + '" href="#' + t[0] + '">' + ic(t[2]) + t[1] + (t[0] === 'hoy' && venc ? '<span class="bd">' + venc + '</span>' : '') + '</a>';
    }).join('');
    $('#tabs').innerHTML = TABS.map(function (t) {
      return '<a href="#' + t[0] + '" class="' + (activa === t[0] ? 'on' : '') + '">' + ic(t[2]) + t[1] + (t[0] === 'hoy' && venc ? '<span class="badge">' + venc + '</span>' : '') + '</a>';
    }).join('');
  }
  function bind() {
    var qi = $('#q');
    if (qi) qi.oninput = function () { st.q = qi.value; var p = qi.selectionStart; render(true); var n = $('#q'); if (n) { n.focus(); n.setSelectionRange(p, p); } };
    document.querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { abrir(b.dataset.open); }; });
    document.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { st.filtro = b.dataset.f; render(true); }; });
    document.querySelectorAll('[data-vista]').forEach(function (b) { b.onclick = function () { st.vista = b.dataset.vista; lsSet('mp_vista', st.vista); render(true); }; });
    document.querySelectorAll('[data-tarea]').forEach(function (b) { b.onclick = function () { st.tarea = b.dataset.tarea; render(true); }; });
    var tcl = $('#tcl'); if (tcl) tcl.onchange = function (e) { st.tcliente = e.target.value; render(true); };
  }
  function render(mismo) {
    if (!D) return;
    var r = ruta(), v = r.v === 'c' ? 'trabajo' : r.v, html;
    if (!mismo && v !== 'trabajo' && v !== 'enlaces') st.q = '';
    if (!mismo && r.v === 'tareas') { st.tarea = { venc: 'Vencidas', hoy: 'Hoy', sem: 'Semana' }[r.a] || 'Todas'; st.tcliente = ''; }
    if (v === 'trabajo') html = vTrabajo(); else if (v === 'tareas') html = vTareas(); else if (v === 'fin') html = vFin(); else if (v === 'enlaces') html = vEnlaces(); else { v = 'hoy'; html = vHoy(); }
    var main = $('#view'), y = main.scrollTop;
    main.innerHTML = html;
    if (mismo) { var vw = main.querySelector('.view'); if (vw) vw.style.animation = 'none'; main.scrollTop = y; } else { main.scrollTop = 0; window.scrollTo(0, 0); }
    pintarNav(v); bind();
    if (v === 'fin') posFin();
    if (!mismo && r.v === 'c' && r.a) abrir(r.a); else if (!mismo && abierto && r.v !== 'c') cerrar();
  }
  window.addEventListener('hashchange', function () { render(false); });

  // ── Arranque ──
  function mostrar(que) { $('#login').classList.toggle('hide', que !== 'login'); $('#app').classList.toggle('hide', que !== 'app'); }
  function girar(on) { $('#refresh').classList.toggle('spin', on); }
  function refresca() {
    var v = ruta().v;
    if (D && (v === 'hoy' || v === 'trabajo' || v === 'fin' || v === 'c')) render(true);
    if (D && abierto) abrir(abierto);
  }
  function cargarExtras() {
    api('trabajo').then(function (j) { TRAB = j; TRAB_ERR = ''; lsSet('mp_t', JSON.stringify(j)); refresca(); })
      .catch(function (e) { if (!e.auth) { TRAB_ERR = e.message; refresca(); } });
    api('finanzas').then(function (j) { FIN = j; FIN_ERR = ''; lsSet('mp_f', JSON.stringify(j)); refresca(); })
      .catch(function (e) { if (!e.auth) { FIN_ERR = e.message; refresca(); } });
  }
  function cargar(silencioso) {
    girar(true);
    return api('datos').then(function (j) {
      D = visibles(j); lsSet('mp_cache', JSON.stringify(j));
      mostrar('app'); render(!!silencioso); cargarExtras();
    }).catch(function (e) {
      if (e.auth) { lsDel('mp_cfg'); lsDel('mp_cache'); lsDel('mp_t'); lsDel('mp_f'); CFG = null; D = null; mostrar('login'); var m = $('#login-err'); m.textContent = 'La clave ya no es válida. Abre de nuevo el enlace de instalación.'; m.classList.remove('hide'); return; }
      if (D) { var v = $('#view'); if (!v.querySelector('.banner')) v.insertAdjacentHTML('afterbegin', '<div class="banner">Sin conexión con los datos. Muestro lo último que guardé.</div>'); }
      else { mostrar('login'); var m2 = $('#login-err'); m2.textContent = 'No pude conectar: ' + e.message; m2.classList.remove('hide'); }
    }).then(function () { girar(false); });
  }

  // Dirección del Apps Script del agente. Sola no da acceso a nada: sin la clave responde "no autorizado".
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxmVtjvsmTBMg81foW9QJmsrEzeywOiR2BKiMZBzlIP4-VgNlPwkqS8FVJo-CcrsWi/exec';
  // Entra con usuario y clave: el Apps Script los verifica y responde el token, que queda guardado en este dispositivo.
  // La clave viaja en el cuerpo del POST (text/plain evita la consulta previa de CORS), nunca en la URL.
  function entrar(usuario, clave) {
    return fetch(SCRIPT_URL + '?portal=login', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ usuario: usuario, clave: clave }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.token) { lsSet('mp_cfg', JSON.stringify({ u: SCRIPT_URL, k: j.token })); return null; }
        var e = j && j.error;
        if (e === 'incorrecto') return 'Usuario o clave incorrectos.';
        if (e === 'espera') return 'Demasiados intentos. Espera 15 minutos.';
        if (e === 'sin configurar') return 'Falta crear el usuario y la clave en el script del agente.';
        return 'No pude entrar: ' + (e || 'respuesta inesperada') + '.';
      })
      .catch(function () { return 'No pude entrar. Si ya cambiaste el script, falta redesplegarlo (acción de login).'; });
  }
  // Guarda #u=...&k=... si trae las dos partes; devuelve si lo guardó.
  function guardarEnlace(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (!/(^|&)k=/.test(h) || !/(^|&)u=/.test(h)) return false;
    var p = new URLSearchParams(h);
    if (!/^https:\/\/script\.google\.com\//.test(p.get('u') || '') || !p.get('k')) return false;
    lsSet('mp_cfg', JSON.stringify({ u: p.get('u'), k: p.get('k') }));
    return true;
  }
  function salir() { ['mp_cfg', 'mp_cache', 'mp_t', 'mp_f'].forEach(lsDel); location.hash = ''; location.reload(); }

  function iniciar() {
    $('#refresh').innerHTML = ic('refresh'); $('#sbtn-i').innerHTML = ic('search'); $('#pal-i').innerHTML = ic('search');
    $('#refresh').onclick = function () { BIT = {}; VERIF = null; cargar(true); };
    var foto = lsGet('mp_foto'); if (foto) $('#avimg').src = foto;
    $('#avimg').onerror = function () { this.onerror = null; this.src = 'assets/logo-me.png'; };
    st.vista = lsGet('mp_vista') === 'tarjetas' ? 'tarjetas' : 'lista';
    // Menú de la cuenta
    $('#avb').onclick = function (e) { e.stopPropagation(); $('#menu').classList.toggle('on'); };
    document.addEventListener('click', function () { $('#menu').classList.remove('on'); });
    $('#mfoto').onclick = function () { $('#file').click(); };
    $('#msalir').onclick = salir;
    $('#file').onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var im = new Image();
        im.onload = function () {
          var c = document.createElement('canvas'), S = 192, m = Math.min(im.width, im.height); c.width = c.height = S;
          c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, S, S);
          var u = c.toDataURL('image/jpeg', 0.85); lsSet('mp_foto', u); $('#avimg').src = u;
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(f);
    };
    // Buscador
    $('#sbtn').onclick = function () { if (D) palAbrir(true); };
    $('#pal').onclick = function (e) { if (e.target === this) palAbrir(false); };
    $('#pq').oninput = function () { palFiltrar(this.value); };
    $('#scrim').onclick = cerrar;
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && D) { e.preventDefault(); palAbrir(!$('#pal').classList.contains('on')); return; }
      if (e.key === 'Escape') { if ($('#pal').classList.contains('on')) palAbrir(false); else if (abierto) cerrar(); return; }
      if (!$('#pal').classList.contains('on')) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); palRender(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); palRender(); }
      else if (e.key === 'Enter') { e.preventDefault(); palGo(palSel); }
    });
    // Enlace de instalación: #u=<url del script>&k=<clave>
    guardarEnlace(location.hash);
    if (/(^|&)k=/.test(location.hash)) history.replaceState(null, '', location.pathname + '#hoy');
    $('#login-form').onsubmit = function (e) {
      e.preventDefault();
      var m = $('#login-err'), b = $('#entrar'), u = $('#usuario').value.trim(), c = $('#clave').value;
      if (!u || !c) { m.textContent = 'Escribe tu usuario y tu clave.'; m.classList.remove('hide'); return; }
      m.classList.add('hide'); b.disabled = true; b.textContent = 'Entrando…';
      entrar(u, c).then(function (err) {
        b.disabled = false; b.textContent = 'Entrar';
        if (err) { m.textContent = err; m.classList.remove('hide'); $('#clave').value = ''; return; }
        $('#clave').value = ''; CFG = lsJson('mp_cfg'); cargar(false);
      });
    };
    CFG = lsJson('mp_cfg');
    if (!CFG || !CFG.u || !CFG.k) { mostrar('login'); return; }
    D = visibles(lsJson('mp_cache')); TRAB = lsJson('mp_t'); FIN = lsJson('mp_f');
    if (D) { mostrar('app'); render(false); }
    cargar(!!D);
  }
  iniciar();
})();
