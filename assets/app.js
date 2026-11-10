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
  var NOTAS = null;      // notas libres (hoja Notas)
  var VERIF = null;      // "por verificar" (carga perezosa)
  var BIT = {};          // bitácoras por cliente
  var st = { vista: 'lista', filtro: 'Todos', q: '', tarea: 'Todas', tcliente: '', tvista: 'clientes', ncliente: '', netq: 'Todas' };
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
    note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
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
  // Solo se ven el portal de cada cliente, lo personal y los accesos generales; los enlaces por cliente de la primera versión (tableros, copys, cuentas…) ya no van.
  function enlaceVisible(l) {
    if (l.tipo === 'Archivado') return false;
    if (l.tipo === 'Portal' || l.tipo === 'Personal') return true;
    return l.cliente === 'general' && ['Plataforma', 'Herramienta', 'Archivo', 'Código'].indexOf(l.tipo) >= 0;
  }
  function visibles(d) { if (d && d.enlaces) d.enlaces = d.enlaces.filter(enlaceVisible); return d; }
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
    xads: 'x', portaladcom: 'general', panelpersonal: 'me', vulrt: 'vultr', shopifymara: 'shopify', misitioweb: 'me' };
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
  // Los clientes de Adcom llevan el logo de Adcom; los freelance y personales, el «me» de Michael.
  function logoPerfil(clave) { return clave === 'general' || perfilDe(clave) === 'adcom' ? 'assets/logos/adcom.png' : 'assets/logos/me.png'; }
  function imgLogo(src, mono) { return SIN_LOGO[src] ? esc(mono) : '<img src="' + esc(src) + '" alt="" data-logo="' + esc(src) + '">'; }
  function avatar(c, sem) {
    var mono = inicial(c.nombre);
    return '<div class="av logo ' + perfilDe(c.cliente) + '" data-mono="' + esc(mono) + '">' + imgLogo(logoPerfil(c.cliente), mono) + (sem ? '<span class="sem ' + sem + '"></span>' : '') + '</div>';
  }
  function tileIco(l) {
    var mono = inicial(l.nombre), src;
    // Las herramientas personales de un cliente (p. ej. Shopify Mara) llevan el logo de la marca, no el del perfil.
    if (l.tipo === 'Portal') src = logoPerfil(l.cliente);
    else src = 'assets/logos/' + logoKey(l) + '.png';
    return '<span class="ti" data-mono="' + esc(mono) + '">' + imgLogo(src, mono) + '</span>';
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
  function fechaBtn(t) {
    if (!t.fecha_limite) return '<button type="button" class="chip" data-act="fecha">+ Fecha</button>';
    return chipFecha(t.fecha_limite).replace('<span class="chip', '<button type="button" data-act="fecha" class="chip').replace('</span>', '</button>');
  }
  function filaTarea(t, sinCli) {
    var perfil = t._c ? perfilDe(t._c) : '';
    var cl = t._c ? '<button class="chip ' + perfil + '" type="button" data-open="' + esc(t._c) + '">' + esc(nombreCliente(t._c)) + '</button>'
      : (t.cliente || t.negocio ? '<span class="chip">' + esc(t.cliente || t.negocio) + '</span>' : '');
    return '<div class="row tk" data-id="' + esc(t.id) + '"><button class="chk p-' + esc(t.prioridad || 'media') + '" type="button" data-act="done" aria-label="Marcar como hecha" title="Marcar como hecha"></button><div class="t"><b>' + esc(t.tarea) + '</b>' +
      (t.notas ? '<small>' + esc(t.notas) + '</small>' : '') +
      '<div class="meta">' + fechaBtn(t) + (sinCli ? '' : cl) + (t.estado === 'en curso' ? '<span class="chip acc">En curso</span>' : '') + '</div></div>' +
      '<button class="kebab" type="button" data-act="menu" aria-label="Más acciones" title="Más acciones"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg></button></div>';
  }
  function listaTareas(ts, vacio) {
    return ts.length ? '<div class="card list">' + ts.map(function (t) { return filaTarea(t, false); }).join('') + '</div>' : '<div class="card empty">' + esc(vacio) + '</div>';
  }
  function sec(titulo, accion) { return '<div class="sec"><h2 class="s">' + esc(titulo) + '</h2>' + (accion || '') + '</div>'; }

  // ── Markdown (bitácoras) ──
  function md(src) {
    var inline = function (s) {
      s = esc(s);
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
      s = s.replace(/(^|[\s(])_([^\n]+?)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
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
    var finKpi = FIN ? '<a class="kpi" href="#fin"><small>Gastado en ' + mesN + '</small><b>' + M(FIN.gasto) + '</b><div class="d">cierras en ~' + M(proyeccion(FIN)) + '</div></a>'
      : '<a class="kpi" href="#fin"><small>Gastos del mes</small><b>—</b><div class="d">' + (FIN_ERR ? 'sin datos todavía' : 'cargando…') + '</div></a>';
    return '<div class="view"><div class="head"><div><h1 class="t">' + saludo() + ', <em>Michael</em></h1><p class="sub">' + fechaLarga() + ' · ' + ag.length + ' reunion' + (ag.length === 1 ? '' : 'es') + ' hoy</p></div><button class="btn sm" type="button" data-act="nueva">+ Nueva tarea</button></div>' +
      '<div class="kpis"><a class="kpi late" href="#tareas/venc"><small>Tareas vencidas</small><b>' + venc.length + '</b><div class="d">en ' + clientesVenc + ' cliente' + (clientesVenc === 1 ? '' : 's') + '</div></a>' +
      '<a class="kpi" href="#tareas/hoy"><small>Para hoy</small><b>' + hoy.length + '</b><div class="d">' + ts.length + ' abiertas en total</div></a>' +
      '<a class="kpi" href="#tareas/sem"><small>Próximos 7 días</small><b>' + sem.length + '</b><div class="d">con fecha</div></a>' + finKpi + '</div>' +
      sec('Para hacer hoy', venc.length + hoy.length > 8 ? '<a href="#tareas/venc">Ver todas · ' + (venc.length + hoy.length) + '</a>' : '') + listaTareas(venc.concat(hoy).slice(0, 8), 'Nada vencido ni para hoy.') +
      sec('Necesita tu atención', atn.length ? '<span class="chip">' + atn.length + '</span>' : '') +
      (atn.length ? '<div class="card list">' + atn.map(function (a) {
        var cuerpo = '<span class="ico ' + a.c + '">' + ic(a.i) + '</span><span class="t"><b>' + esc(a.t) + '</b><small>' + esc(a.s) + '</small></span>' + ic('chev', 'chev');
        return a.k ? '<button class="row" type="button" data-open="' + esc(a.k) + '">' + cuerpo + '</button>' : '<a class="row" href="#' + a.go + '">' + cuerpo + '</a>';
      }).join('') + '</div>' : '<div class="card empty">Nada urgente por ahora.</div>') +
      '<div class="grid2"><div>' + sec('Agenda de hoy') +
      (ag.length ? '<div class="card list">' + ag.map(function (e) {
        return '<div class="ev"><time>' + esc(e.hora || '·') + '</time><div><b>' + esc(e.titulo) + '</b>' + (e.cal || e.participantes ? '<small>' + esc((e.cal || '').trim().replace(/[()]/g, '')) + (e.participantes ? (e.cal ? ' · ' : '') + esc(e.participantes) : '') + '</small>' : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="card empty">Sin reuniones hoy.</div>') + '</div>' +
      '<div>' + sec('Mis finanzas', '<a href="#fin">Abrir</a>') + miniFin() + '</div></div>' +
      (favs.length ? sec('Favoritos', '<a href="#enlaces">Todos los enlaces</a>') + '<div class="bals">' + favs.map(tile).join('') + '</div>' : '') +
      '<div class="foot">Actualizado ' + esc((D.actualizado || '').slice(11, 16)) + '</div></div>';
  }
  // Resumen de finanzas para Hoy: gasto del mes, categorías principales, ingresos y balance, próximos pagos y últimos movimientos.
  function miniFin() {
    if (!FIN) return '<div class="card empty">' + (FIN_ERR ? esc(finMensaje()) : 'Cargando finanzas…') + '</div>';
    var f = finCalc(FIN), bal = FIN.ingresos - FIN.gasto, cats = FIN.categorias.slice(0, 3), maxC = cats.length ? cats[0][1] : 1;
    var chip = f.antAlDia > 0 ? '<span class="chip ' + (f.vs <= 0 ? 'good' : 'warn') + '" style="vertical-align:middle">' + (f.vs > 0 ? '+' : '') + f.vs + '%</span>' : '';
    var pagos = FIN.pagos.slice(0, 4).map(function (p) {
      var n = dias(p.fecha);
      return '<div class="pay"><div class="dt"><b>' + parse(p.fecha).getDate() + '</b><small>' + MES[parse(p.fecha).getMonth()] + '</small></div><div class="t" style="flex:1;min-width:0"><b>' + esc(p.nombre) + '</b><div style="color:var(--ink3);font-size:11.5px">' + esc(p.tipo) + '</div></div>' +
        (n <= 7 ? '<span class="chip ' + (n <= 0 ? 'crit' : 'warn') + '">' + (n < 0 ? 'Vencido' : n === 0 ? 'Hoy' : 'En ' + n + ' d') + '</span>' : '') + '<b class="num" style="min-width:80px;text-align:right">' + COP(p.monto) + '</b></div>';
    }).join('');
    var movs = FIN.movimientos.slice(0, 4).map(function (m) {
      return '<div class="mv sm"><small>' + diaMes(m.fecha) + '</small><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(m.desc) + '</span><span class="amt ' + (m.monto > 0 ? 'in' : '') + '">' + (m.monto > 0 ? '+' : '−') + COP(Math.abs(m.monto)) + '</span></div>';
    }).join('');
    return '<div class="card mini"><small style="color:var(--ink2)">Gasto de ' + nombreMes(FIN.mes) + ' contra ' + nombreMes(FIN.mes_anterior) + ' al mismo día</small><div class="big num" style="margin:2px 0 8px">' + M(FIN.gasto) + ' ' + chip + '</div>' +
      '<div class="bar"><i class="acc" style="width:' + Math.min(100, f.pctAnt) + '%"></i></div><small style="color:var(--ink3);display:block;margin:6px 0 14px">' + f.pctAnt + '% de lo que gastaste en todo ' + nombreMes(FIN.mes_anterior) + ' · cierras en ~' + M(proyeccion(FIN)) + '</small>' +
      cats.map(function (c) { return '<div class="cat static"><span>' + esc(c[0]) + '</span><div class="bar"><i style="width:' + Math.round(c[1] / maxC * 100) + '%"></i></div><span class="num">' + COP(c[1]) + '</span></div>'; }).join('') +
      '<div class="two"><div><small>Ingresos</small><b class="num" style="color:var(--good)">' + M(FIN.ingresos) + '</b></div><div><small>Balance del mes</small><b class="num" style="color:' + (bal < 0 ? 'var(--crit)' : 'var(--ink)') + '">' + (bal >= 0 ? '+' : '−') + M(Math.abs(bal)) + '</b></div></div></div>' +
      (pagos ? sec('Próximos pagos', '<a href="#fin">Ver todos</a>') + '<div class="card list">' + pagos + '</div>' : '') +
      (movs ? sec('Últimos movimientos', '<a href="#fin">Ver todos</a>') + '<div class="card list">' + movs + '</div>' : '');
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

  // Tareas agrupadas: una tarjeta por cliente que tenga tareas abiertas (los que no tienen no aparecen).
  function tarjetasTareas(ts) {
    if (!ts.length) return '<div class="card empty">No hay tareas con ese filtro.</div>';
    var h = hoyIso(), grupos = {}, claves = [];
    ts.forEach(function (t) { var k = t._c || ''; if (!grupos[k]) { grupos[k] = []; claves.push(k); } grupos[k].push(t); });
    var urg = function (k) { var f = grupos[k].map(function (t) { return t.fecha_limite || '9999'; }).sort()[0]; return k === '' ? '99999' : f; };
    claves.sort(function (a, b) { return urg(a) < urg(b) ? -1 : urg(a) > urg(b) ? 1 : grupos[b].length - grupos[a].length; });
    return '<div class="cards3 tg">' + claves.map(function (k) {
      var g = grupos[k], c = k ? cliente(k) : null, venc = g.filter(function (t) { return t.fecha_limite && t.fecha_limite < h; }).length;
      var cab = c ? '<button class="cn" type="button" data-open="' + esc(k) + '">' + avatar(c, '') + '<div><b>' + esc(c.nombre) + '</b><small>' + esc(c.perfil) + '</small></div></button>'
        : '<div class="cn"><div><b>Sin cliente</b><small>Tareas sueltas</small></div></div>';
      return '<div class="card tgc"><div class="tgh">' + cab + '<span class="chip' + (venc ? ' crit' : '') + '">' + g.length + (venc ? ' · ' + venc + ' vencida' + (venc > 1 ? 's' : '') : '') + '</span>' +
        '<button class="kebab" type="button" data-act="nueva" data-cliente="' + esc(c ? c.nombre : '') + '" aria-label="Nueva tarea" title="Nueva tarea">' + ic('plus') + '</button></div>' +
        '<div class="list">' + g.map(function (t) { return filaTarea(t, !!k); }).join('') + '</div></div>';
    }).join('') + '</div>';
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
    var porCliente = st.tvista === 'clientes';
    return '<div class="view"><div class="head"><div><h1 class="t">Tareas</h1><p class="sub">' + ts.length + ' ' + (f === 'Todas' ? 'abiertas' : f.toLowerCase()) + '</p></div>' +
      '<div class="seg keep" role="group" aria-label="Vista"><button type="button" data-tvista="clientes" class="' + (porCliente ? 'on' : '') + '">Por cliente</button><button type="button" data-tvista="lista" class="' + (!porCliente ? 'on' : '') + '">Lista</button></div>' +
      '<button class="btn sm" type="button" data-act="nueva">+ Nueva tarea</button></div><div class="tools"><div class="pills">' +
      ['Todas', 'Vencidas', 'Hoy', 'Semana', 'Sin fecha'].map(function (x) { return '<button class="pill' + (f === x ? ' on' : '') + '" type="button" data-tarea="' + x + '">' + x + '</button>'; }).join('') +
      '<select class="pill" id="tcl" aria-label="Cliente"><option value="">Todos los clientes</option>' + clientesTodos().map(function (c) { return '<option value="' + esc(c.cliente) + '"' + (st.tcliente === c.cliente ? ' selected' : '') + '>' + esc(c.nombre) + '</option>'; }).join('') + '</select></div></div>' +
      (porCliente ? tarjetasTareas(ts) : listaTareas(ts, 'No hay tareas con ese filtro.')) + '</div>';
  }

  // Notas
  var ETQ_NOTA = ['reunión', 'idea', 'pendiente', 'general'];
  function clavesBit() { return clientesTodos().map(function (c) { return { k: c.bitacora || c.cliente, n: c.nombre }; }); }
  function nombreBit(k) { var f = clavesBit().filter(function (x) { return x.k === k; })[0]; return f ? f.n : k; }
  function sinApostrofo(x) { return String(x || '').replace(/^'(?=[=+])/, ''); }
  function vNotas() {
    var q = norm(st.q), lista = (NOTAS || []).filter(function (n) {
      if (st.ncliente === '__sin' ? n.cliente : (st.ncliente && n.cliente !== st.ncliente)) return false;
      if (st.netq !== 'Todas' && n.etiqueta !== st.netq) return false;
      return !q || norm(n.titulo + ' ' + n.texto).indexOf(q) >= 0;
    });
    var filas = lista.map(function (n) {
      var snip = sinApostrofo(n.texto).replace(/\s+/g, ' ').trim().slice(0, 160);
      return '<button class="row nt" type="button" data-nid="' + esc(n.id) + '"><span class="grow"><b>' + esc(sinApostrofo(n.titulo)) + '</b>' +
        (snip ? '<span class="nsn">' + esc(snip) + '</span>' : '') + '</span>' +
        (n.etiqueta ? '<span class="chip">' + esc(n.etiqueta) + '</span>' : '') +
        (n.cliente ? '<span class="chip' + (n.bitacora === 'si' ? ' good' : '') + '">' + esc(nombreBit(n.cliente)) + (n.bitacora === 'si' ? ' · en bitácora' : '') + '</span>' : '') +
        '<span class="chip">' + esc(diaMes(n.actualizada || n.creada)) + '</span></button>';
    }).join('');
    var carga = NOTAS === null ? '<div class="card empty">Cargando notas…</div>' : null;
    return '<div class="view"><div class="head"><div><h1 class="t">Notas</h1><p class="sub">' + (NOTAS ? lista.length + ' de ' + NOTAS.length : 'Reuniones, ideas y pendientes') + '</p></div><button class="btn sm" type="button" data-act="nnueva">+ Nueva nota</button></div>' +
      '<div class="tools"><label class="search">' + ic('search') + '<input id="q" type="search" placeholder="Buscar en notas" value="' + esc(st.q) + '" autocomplete="off"></label><div class="pills">' +
      ['Todas'].concat(ETQ_NOTA).map(function (x) { return '<button class="pill' + (st.netq === x ? ' on' : '') + '" type="button" data-etq="' + x + '">' + x + '</button>'; }).join('') +
      '<select class="pill" id="ncl" aria-label="Cliente"><option value="">Todos los clientes</option><option value="__sin"' + (st.ncliente === '__sin' ? ' selected' : '') + '>Sin cliente</option>' +
      clavesBit().map(function (c) { return '<option value="' + esc(c.k) + '"' + (st.ncliente === c.k ? ' selected' : '') + '>' + esc(c.n) + '</option>'; }).join('') + '</select></div></div>' +
      (carga || (filas ? '<div class="card list">' + filas + '</div>' : '<div class="card empty">' + (NOTAS.length ? 'No hay notas con ese filtro.' : 'Aún no hay notas. Crea la primera con «Nueva nota».') + '</div>')) + '</div>';
  }

  // Finanzas
  var FINS = {};         // otros meses ya leídos, por yyyy-MM
  var finSel = '';       // '' = el mes actual
  var FV = null;         // datos del mes que se está viendo
  function nuevoFiltro() { return { rango: 'mes', cat: '', tipo: 'todos', q: '', desde: '', hasta: '', n: 8 }; }
  var stF = nuevoFiltro();
  function finVista() { return finSel ? FINS[finSel] : FIN; }
  function nombreMes(ym) { return MESL[+ym.slice(5, 7) - 1]; }
  function mesCap(ym) { var n = nombreMes(ym); return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + ym.slice(0, 4); }
  function mesMas(ym, n) { var d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
  function isoRestar(iso, n) { var d = parse(iso); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function cum(a) { var s = 0; return a.map(function (x) { return s += x; }); }
  // Proyección del cierre: lo gastado más lo que se gastó en el resto del mes anterior (así un pago grande al inicio, como el arriendo,
  // no se multiplica por los días que faltan). Sin mes anterior con datos, se extiende el ritmo diario.
  function proyeccion(F) {
    if (!F.es_actual || !F.dia) return F.gasto;
    var ca = cum(F.diario.ant), tot = ca.length ? ca[ca.length - 1] : 0, alDia = ca.length ? ca[Math.min(F.dia, ca.length) - 1] : 0;
    return tot > 0 ? F.gasto + (tot - alDia) : F.gasto / F.dia * F.dias_mes;
  }
  function finCalc(F) {
    var ca = cum(F.diario.ant), antAlDia = ca.length ? ca[Math.min(F.dia, ca.length) - 1] : 0, antTot = ca.length ? ca[ca.length - 1] : 0;
    return { ca: ca, cm: cum(F.diario.mes).slice(0, F.dia), antAlDia: antAlDia, antTot: antTot,
      vs: antAlDia > 0 ? Math.round((F.gasto / antAlDia - 1) * 100) : 0, pctAnt: antTot > 0 ? Math.round(F.gasto / antTot * 100) : 0 };
  }
  function tope(max) {
    var raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / mag, step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * mag;
    return { step: step, max: Math.ceil(max / step) * step };
  }
  function ejeY(sc, L, W, R, y) {
    var g = '', v;
    for (v = 0; v <= sc.max + 1; v += sc.step) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line2)"/><text x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" fill="var(--ink3)">' + (v ? M(v).replace('$', '') : '0') + '</text>';
    return g;
  }
  // Tendencia: gasto acumulado del mes contra el mes anterior (con proyección si el mes sigue en curso).
  function chartFin(F, f) {
    var W = Math.max(480, Math.min(1200, ($('#view').clientWidth || 700) - 120)), H = Math.round(Math.max(200, Math.min(300, W * 0.32))), L = 52, R = 14, T = 14, B = 26, N = Math.max(F.dias_mes, f.ca.length), proy = proyeccion(F);
    var sc = tope(Math.max(f.antTot, proy, F.gasto, 1)), max = sc.max;
    var x = function (d) { return L + (d - 1) / (N - 1 || 1) * (W - L - R); }, y = function (v) { return T + (1 - v / max) * (H - T - B); };
    var path = function (a, n) { return a.slice(0, n).map(function (v, i) { return (i ? 'L' : 'M') + x(i + 1).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' '); };
    var grid = ejeY(sc, L, W, R, y);
    [1, 5, 10, 15, 20, 25, 30].forEach(function (d) { if (d <= N) grid += '<text x="' + x(d) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="var(--ink3)">' + d + '</text>'; });
    var n = f.cm.length, hay = n > 0;
    return '<div class="chart" id="chart" data-w="' + W + '" data-h="' + H + '"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gasto acumulado del mes contra el mes anterior"><defs><linearGradient id="g1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--pri)" stop-opacity=".3"/><stop offset="1" stop-color="var(--pri)" stop-opacity="0"/></linearGradient></defs>' + grid +
      '<path d="' + path(f.ca, f.ca.length) + '" fill="none" stroke="var(--ink3)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".75"/>' +
      (hay ? '<path d="' + path(f.cm, n) + ' L' + x(n) + ' ' + y(0) + ' L' + x(1) + ' ' + y(0) + ' Z" fill="url(#g1)"/>' +
        (F.es_actual ? '<path d="M' + x(n) + ' ' + y(F.gasto) + ' L' + x(F.dias_mes) + ' ' + y(proy) + '" fill="none" stroke="var(--acc)" stroke-width="2" stroke-dasharray="4 5" stroke-linecap="round"/>' : '') +
        '<path id="lnN" d="' + path(f.cm, n) + '" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        '<circle cx="' + x(n) + '" cy="' + y(F.gasto) + '" r="5" fill="var(--acc)" stroke="#fff" stroke-width="2"/>' : '') +
      '<line id="cx" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" stroke="var(--ink3)" stroke-dasharray="3 3" opacity="0"/><circle id="co" r="4.5" fill="var(--ink3)" stroke="#fff" stroke-width="2" opacity="0"/>' +
      '<rect id="hit" x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '" fill="transparent"/></svg><div class="tip" id="tip"></div></div>' +
      '<div class="leg"><span><i style="border-color:var(--acc)"></i>' + nombreMes(F.mes) + '</span>' + (F.es_actual ? '<span><i style="border-color:var(--acc);border-top-style:dashed"></i>Proyección: el resto del mes como ' + nombreMes(F.mes_anterior) + '</span>' : '') + '<span><i style="border-color:var(--ink3)"></i>' + nombreMes(F.mes_anterior) + '</span></div>';
  }
  // Ingresos contra gastos de los últimos 6 meses (barras agrupadas; el mes que se ve lleva el valor encima).
  function chartHist(F) {
    var Hs = F.historico;
    if (!Hs || !Hs.length) return '';
    var W = 560, Ht = 240, L = 46, R = 8, T = 22, B = 28, n = Hs.length;
    var sc = tope(Math.max.apply(null, Hs.map(function (h) { return Math.max(h.gastos, h.ingresos); }).concat([1]))), max = sc.max;
    var y = function (v) { return T + (1 - v / max) * (Ht - T - B); };
    var gw = (W - L - R) / n, bw = Math.min(26, gw * 0.3), out = ejeY(sc, L, W, R, y);
    var barra = function (x, v, color, rotulo) {
      if (v <= 0) return '';
      var yy = y(v), r = Math.min(4, (Ht - B - yy) / 2);
      return '<path d="M' + x + ' ' + (Ht - B) + ' V' + (yy + r) + ' Q' + x + ' ' + yy + ' ' + (x + r) + ' ' + yy + ' H' + (x + bw - r) + ' Q' + (x + bw) + ' ' + yy + ' ' + (x + bw) + ' ' + (yy + r) + ' V' + (Ht - B) + ' Z" fill="' + color + '"><title>' + esc(rotulo + ': ' + COP(v)) + '</title></path>';
    };
    Hs.forEach(function (h, i) {
      var cx = L + gw * i + gw / 2, ult = i === n - 1;
      out += barra(cx - bw - 1, h.ingresos, 'var(--yel)', mesCap(h.mes) + ' · Ingresos') + barra(cx + 1, h.gastos, 'var(--acc)', mesCap(h.mes) + ' · Gastos');
      out += '<text x="' + cx + '" y="' + (Ht - 8) + '" text-anchor="middle" font-size="11" fill="' + (ult ? 'var(--ink)' : 'var(--ink3)') + '" font-weight="' + (ult ? 600 : 400) + '">' + MES[+h.mes.slice(5, 7) - 1] + '</text>';
      if (ult) {
        if (h.ingresos > 0) out += '<text x="' + (cx - bw / 2 - 1) + '" y="' + (y(h.ingresos) - 6) + '" text-anchor="middle" font-size="10.5" fill="var(--ink2)">' + M(h.ingresos).replace('$', '') + '</text>';
        if (h.gastos > 0) out += '<text x="' + (cx + bw / 2 + 1) + '" y="' + (y(h.gastos) - 6) + '" text-anchor="middle" font-size="10.5" fill="var(--ink2)">' + M(h.gastos).replace('$', '') + '</text>';
      }
    });
    return '<svg viewBox="0 0 ' + W + ' ' + Ht + '" role="img" aria-label="Ingresos y gastos de los últimos 6 meses" style="width:100%;height:auto;display:block;margin-top:6px">' + out + '</svg>' +
      '<div class="leg"><span><i style="border-color:var(--yel);border-top-width:8px"></i>Ingresos</span><span><i style="border-color:var(--acc);border-top-width:8px"></i>Gastos</span></div>';
  }

  function detalleCategoria(F, cat) {
    var l = F.movimientos.filter(function (m) { return m.monto < 0 && m.cat === cat && m.fecha.slice(0, 7) === F.mes; });
    if (!l.length) return '<div class="empty" style="padding:8px 0">Sin detalle disponible.</div>';
    return l.map(function (m) { return '<div class="cdr"><small>' + diaMes(m.fecha) + '</small><span>' + esc(m.desc) + '</span><b class="num">' + COP(-m.monto) + '</b></div>'; }).join('') +
      '<div class="cdr tot"><small></small><span>' + l.length + ' gasto' + (l.length === 1 ? '' : 's') + '</span><b class="num">' + COP(-l.reduce(function (s, m) { return s + m.monto; }, 0)) + '</b></div>';
  }

  function movsFiltrados(F) {
    var ref = F.es_actual ? hoyIso() : F.mes + '-' + pad2(F.dias_mes), desde = '0000', hasta = '9999';
    if (stF.desde || stF.hasta) { desde = stF.desde || '0000'; hasta = stF.hasta || '9999'; }
    else if (stF.rango === 'mes') { desde = F.mes + '-01'; hasta = F.mes + '-31'; }
    else if (stF.rango === 'ant') { desde = F.mes_anterior + '-01'; hasta = F.mes_anterior + '-31'; }
    else if (stF.rango === '7d') { desde = isoRestar(ref, 6); hasta = ref; }
    else if (stF.rango === '30d') { desde = isoRestar(ref, 29); hasta = ref; }
    var q = norm(stF.q);
    return F.movimientos.filter(function (m) {
      return m.fecha >= desde && m.fecha <= hasta && (stF.tipo === 'todos' || (stF.tipo === 'gastos' ? m.monto < 0 : m.monto > 0)) &&
        (!stF.cat || m.cat === stF.cat) && (!q || norm(m.desc + ' ' + m.cat).indexOf(q) >= 0);
    });
  }
  function pintarMovs() {
    var c = $('#movlist'); if (!c || !FV) return;
    var l = movsFiltrados(FV), g = 0, i = 0;
    l.forEach(function (m) { if (m.monto < 0) g -= m.monto; else i += m.monto; });
    $('#movsum').textContent = l.length + ' movimiento' + (l.length === 1 ? '' : 's') + (g ? ' · gastos ' + COP(g) : '') + (i ? ' · ingresos ' + COP(i) : '');
    c.innerHTML = l.length ? l.slice(0, stF.n).map(function (m) {
      return '<div class="mv"><small>' + diaMes(m.fecha) + '</small><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(m.desc) + '</span><span class="chip" style="justify-self:start">' + esc(m.cat || '—') + '</span><span class="amt ' + (m.monto > 0 ? 'in' : '') + '">' + (m.monto > 0 ? '+' : '−') + COP(Math.abs(m.monto)) + '</span></div>';
    }).join('') + (l.length > stF.n ? '<button class="mas" type="button" data-act="masmov">Ver más · quedan ' + (l.length - stF.n) + '</button>' : '') : '<div class="empty">Ningún movimiento con esos filtros.</div>';
  }
  function bindMovs() {
    var por = function (id, ev, f) { var el = $(id); if (el) el[ev] = f; };
    por('#mf-rango', 'onchange', function () { stF.rango = this.value; stF.desde = stF.hasta = ''; $('#mf-desde').value = ''; $('#mf-hasta').value = ''; $('#mf-fechas').hidden = this.value !== 'custom'; stF.n = 8; pintarMovs(); });
    por('#mf-desde', 'onchange', function () { stF.desde = this.value; $('#mf-rango').value = 'custom'; stF.n = 8; pintarMovs(); });
    por('#mf-hasta', 'onchange', function () { stF.hasta = this.value; $('#mf-rango').value = 'custom'; stF.n = 8; pintarMovs(); });
    por('#mf-cat', 'onchange', function () { stF.cat = this.value; stF.n = 8; pintarMovs(); });
    por('#mf-q', 'oninput', function () { stF.q = this.value; stF.n = 8; pintarMovs(); });
    document.querySelectorAll('[data-mtipo]').forEach(function (b) { b.onclick = function () { stF.tipo = b.dataset.mtipo; stF.n = 8; document.querySelectorAll('[data-mtipo]').forEach(function (x) { x.classList.toggle('on', x === b); }); pintarMovs(); }; });
    pintarMovs();
  }

  function irMesFin(d) {
    var base = finSel || (FIN && FIN.mes); if (!base) return;
    var t = d === 0 ? '' : mesMas(base, d);
    if (t && FIN && t >= FIN.mes) t = '';        // no hay meses futuros: el actual es el límite
    finSel = t; stF = nuevoFiltro();
    render(true);
    if (!t || FINS[t]) return;
    api('finanzas', { mes: t }).then(function (j) { FINS[t] = j; if (finSel === t) render(true); })
      .catch(function (e) { finSel = ''; render(true); avisar('No pude leer ' + t + ': ' + e.message); });
  }

  function vFin() {
    var F = finVista();
    var cab = '<div class="head"><div><h1 class="t">Finanzas</h1>' + (F ? '<p class="sub">' + mesCap(F.mes) + ' · ' + (F.es_actual ? 'día ' + F.dia + ' de ' + F.dias_mes : 'mes cerrado') + '</p>' : '') + '</div>' +
      (FIN ? '<div class="mnavf"><button class="pill" type="button" data-act="mes" data-d="-1" aria-label="Mes anterior">‹</button><span class="mlab">' + mesCap(finSel || FIN.mes) + '</span><button class="pill" type="button" data-act="mes" data-d="1" aria-label="Mes siguiente"' + (finSel ? '' : ' disabled') + '>›</button>' + (finSel ? '<button class="pill" type="button" data-act="mes" data-d="0">Este mes</button>' : '') + '</div>' : '') + '</div>';
    if (!F) { FV = null; return '<div class="view">' + cab + '<div class="card empty" style="margin-top:18px">' + (FIN_ERR && !finSel ? esc(finMensaje()) : '<div class="loading">Cargando finanzas…</div>') + '</div></div>'; }
    FV = F;
    var f = finCalc(F), proy = proyeccion(F), ant = nombreMes(F.mes_anterior), antTot = F.gasto_ant;
    var maxC = F.categorias.length ? F.categorias[0][1] : 1, bal = F.ingresos - F.gasto, maxO = (F.ingresos_origen || []).length ? F.ingresos_origen[0][1] : 1;
    var pagos = (F.pagos || []).map(function (p) {
      var n = dias(p.fecha), d = parse(p.fecha);
      return '<div class="pay"><div class="dt"><b>' + d.getDate() + '</b><small>' + MES[d.getMonth()] + '</small></div><div class="t" style="flex:1;min-width:0"><b>' + esc(p.nombre) + '</b><div style="color:var(--ink3);font-size:11.5px">' + esc(p.tipo) + '</div></div>' +
        (n <= 7 ? '<span class="chip ' + (n <= 0 ? 'crit' : 'warn') + '">' + (n < 0 ? 'Vencido' : n === 0 ? 'Hoy' : 'En ' + n + ' d') + '</span>' : '') + '<b class="num" style="min-width:92px;text-align:right">' + COP(p.monto) + '</b></div>';
    }).join('');
    var cats = []; F.movimientos.forEach(function (m) { if (cats.indexOf(m.cat) < 0 && m.cat) cats.push(m.cat); }); cats.sort();
    var chip = F.es_actual ? (f.antAlDia > 0 ? '<span class="chip ' + (f.vs <= 0 ? 'good' : 'warn') + '" style="vertical-align:middle;font-size:12px">' + (f.vs > 0 ? '+' : '') + f.vs + '% frente a ' + ant + ' al día ' + F.dia + '</span>' : '')
      : (antTot > 0 ? '<span class="chip ' + (F.gasto <= antTot ? 'good' : 'warn') + '" style="vertical-align:middle;font-size:12px">' + (F.gasto > antTot ? '+' : '') + Math.round((F.gasto / antTot - 1) * 100) + '% frente a ' + ant + '</span>' : '');
    var resumen = F.es_actual
      ? 'Si el resto del mes se parece a ' + ant + ', cierras en <b style="color:var(--ink)">' + M(proy) + '</b>' + (f.antTot > 0 ? (proy > f.antTot ? ', <span style="color:var(--crit)">' + M(proy - f.antTot) + ' más que ' + ant + ' (' + M(f.antTot) + ')</span>' : ', menos que ' + ant + ' (' + M(f.antTot) + ')') : '') + '.'
      : 'Cerró en <b style="color:var(--ink)">' + M(F.gasto) + '</b>' + (antTot > 0 ? ' contra ' + M(antTot) + ' en ' + ant : '') + '.';
    return '<div class="view">' + cab +
      '<div class="card fhero"><small style="color:var(--ink2);font-weight:500">Gastado en el mes</small>' +
      '<div class="big"><small>COP</small>' + Math.round(F.gasto).toLocaleString('es-CO') + ' ' + chip + '</div>' +
      '<div style="color:var(--ink2);font-size:12.5px">' + resumen + '</div>' + chartFin(F, f) + '</div>' +
      '<div class="grid2 eq" style="margin-top:14px"><div class="card mini"><h2 class="s">Ingresos y gastos · últimos 6 meses</h2>' + (chartHist(F) || '<div class="empty">Falta actualizar el script para ver el histórico.</div>') + '</div>' +
      '<div class="card mini"><h2 class="s" style="margin-bottom:12px">Ingresos del mes por origen</h2>' +
        ((F.ingresos_origen || []).length ? F.ingresos_origen.map(function (c) { return '<div class="cat static"><span>' + esc(c[0]) + '</span><div class="bar"><i style="background:var(--yel);width:' + Math.round(c[1] / maxO * 100) + '%"></i></div><span class="num">' + COP(c[1]) + '</span></div>'; }).join('') : '<div class="empty">Sin ingresos este mes.</div>') +
        '<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line2);display:flex;justify-content:space-between;font-size:12.5px"><span style="color:var(--ink2)">Gastos del mes</span><b class="num">' + COP(F.gasto) + '</b></div>' +
        '<div style="margin-top:8px;display:flex;justify-content:space-between;align-items:baseline"><span style="color:var(--ink2)">Balance</span><b class="num" style="font-size:20px;color:' + (bal < 0 ? 'var(--crit)' : 'var(--ink)') + '">' + (bal >= 0 ? '+' : '−') + COP(Math.abs(bal)) + '</b></div></div></div>' +
      '<div class="card mini" style="margin-top:14px"><div class="catt"><h2 class="s">Por categoría</h2><small>toca una para ver sus gastos</small></div>' +
      (F.categorias.length ? F.categorias.map(function (c, i) {
        return '<div class="catb"><button class="cat" type="button" data-act="cat" aria-expanded="false"><span>' + esc(c[0]) + '</span><div class="bar"><i class="' + (i === 0 ? 'acc' : '') + '" style="width:' + Math.round(c[1] / maxC * 100) + '%"></i></div><span class="num">' + COP(c[1]) + ' <em>' + Math.round(c[1] / (F.gasto || 1) * 100) + '%</em></span>' + ic('chev', 'chev cv') + '</button><div class="cd" hidden>' + detalleCategoria(F, c[0]) + '</div></div>';
      }).join('') : '<div class="empty">Sin gastos este mes.</div>') + '</div>' +
      (F.es_actual ? sec('Próximos pagos', (F.pagos || []).some(function (p) { return dias(p.fecha) <= 7; }) ? '<span class="chip warn">hay pagos en menos de 7 días</span>' : '') + (pagos ? '<div class="card list">' + pagos + '</div>' : '<div class="card empty">Sin pagos en los próximos 31 días.</div>') : '') +
      '<div class="sec"><h2 class="s">Movimientos</h2><span class="chip" id="movsum"></span></div>' +
      '<div class="tools mf"><select class="pill" id="mf-rango" aria-label="Periodo"><option value="mes">' + esc(mesCap(F.mes)) + '</option><option value="ant">' + esc(mesCap(F.mes_anterior)) + '</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option><option value="todo">Los dos meses</option><option value="custom">Personalizado</option></select>' +
      '<div class="mfd" id="mf-fechas" hidden><label>Desde<input class="pill dt" type="date" id="mf-desde"></label><label>Hasta<input class="pill dt" type="date" id="mf-hasta"></label></div>' +
      '<select class="pill" id="mf-cat" aria-label="Categoría"><option value="">Todas las categorías</option>' + cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<div class="pills"><button class="pill on" type="button" data-mtipo="todos">Todos</button><button class="pill" type="button" data-mtipo="gastos">Gastos</button><button class="pill" type="button" data-mtipo="ingresos">Ingresos</button></div>' +
      '<label class="search">' + ic('search') + '<input id="mf-q" type="search" placeholder="Buscar" autocomplete="off"></label></div>' +
      '<div class="card tbl" id="movlist"></div>' +
      '<div class="foot">Actualizado ' + esc((F.actualizado || '').slice(11, 16)) + '</div></div>';
  }
  function posFin() {
    if (!FV) return;
    bindMovs();
    var hit = $('#hit'); if (!hit) return;
    var F = FV, ln = $('#lnN');
    if (ln && ln.getTotalLength && !window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
      var len = ln.getTotalLength(); ln.style.strokeDasharray = len; ln.style.strokeDashoffset = len; ln.getBoundingClientRect();
      ln.style.transition = 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)'; ln.style.strokeDashoffset = 0;
    }
    var f = finCalc(F), ch = $('#chart'), svgEl = ch.querySelector('svg'), tip = $('#tip'), cx = $('#cx'), co = $('#co');
    var W = +ch.dataset.w, H = +ch.dataset.h, L = 52, R = 14, T = 14, B = 26, N = Math.max(F.dias_mes, f.ca.length);
    var max = tope(Math.max(f.antTot, proyeccion(F), F.gasto, 1)).max;
    var mover = function (e) {
      var r = svgEl.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
      var d = Math.max(1, Math.min(f.ca.length || 1, Math.round((px - L) / (W - L - R) * (N - 1) + 1)));
      var X = L + (d - 1) / (N - 1 || 1) * (W - L - R), vo = f.ca[d - 1] || 0, vn = d <= f.cm.length ? f.cm[d - 1] : null, Y = T + (1 - vo / max) * (H - T - B);
      cx.setAttribute('x1', X); cx.setAttribute('x2', X); cx.setAttribute('opacity', 1);
      co.setAttribute('cx', X); co.setAttribute('cy', Y); co.setAttribute('opacity', 1);
      tip.innerHTML = '<b>Día ' + d + '</b><div><span>' + MES[+F.mes_anterior.slice(5, 7) - 1] + '</span><span>' + COP(vo) + '</span></div><div><span>' + MES[+F.mes.slice(5, 7) - 1] + '</span><span>' + (vn != null ? COP(vn) : 'aún no') + '</span></div>';
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
    $('#drawer').innerHTML = '<div class="dh">' + avatar(c, x.e) + '<div><h3>' + esc(c.nombre) + '</h3><span class="chip ' + ETQ_CL[x.e] + '">' + esc(c.perfil) + ' · ' + ETQ[x.e] + '</span></div><button class="pill" type="button" id="dgo" style="margin-left:auto">Ir a Trabajo</button><button class="x" type="button" id="dx" aria-label="Cerrar" style="margin-left:0">' + ic('x') + '</button></div>' +
      '<div class="db">' +
      '<div class="dk"><div><small>Inversión del mes</small><b class="num">' + esc(inv && inv.gasto ? inv.gasto : '—') + '</b><span class="d">' + (inv && inv.presupuesto ? 'de ' + esc(inv.presupuesto) + (inv.pct != null ? ' · ' + inv.pct + '%' : '') : 'sin presupuesto') + '</span>' +
        (inv && inv.aparte && inv.aparte.length ? '<span class="d">Aparte: ' + inv.aparte.map(function (a) { return esc(a.motivo) + ' ' + esc(a.total); }).join(' · ') + '</span>' : '') + '</div>' +
      '<div><small>' + esc(r ? r.nombre.replace(/ \(.*\)/, '') : 'Resultado') + '</small><b class="num">' + esc(r ? r.valor : '—') + '</b><span class="d">' + (r && r.meta && r.meta !== '-' ? 'meta ' + esc(r.meta) + (r.pct && r.pct !== '-' ? ' · ' + esc(r.pct) : '') : '') + '</span></div>' +
      '<div><small>Costo por resultado</small><b class="num">' + esc(r && r.costo && r.costo !== '-' ? r.costo : '—') + '</b><span class="d">' + (inv && inv.datos_hasta ? 'datos hasta ' + esc(corta(inv.datos_hasta)) : '') + '</span></div></div>' +
      (portal ? '<a class="hero" href="' + esc(seguro(portal.url)) + '" target="_blank" rel="noopener">' + tileIco(portal) + '<span class="tl"><b>Portal de ' + esc(c.nombre) + '</b><small>' + esc(host(portal.url)) + '</small></span>' + ic('arrow', 'chev') + '</a>' : '') +
      (c.resumen ? '<div class="dsec"><h2 class="s">Resumen</h2><div class="card facts">' + esc(c.resumen) + (reglas.length ? '<ul>' + reglas.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '') + '</div></div>' : '') +
      '<div class="dsec"><div class="sec" style="margin:0 0 8px"><h2 class="s">Tareas · ' + x.ts.length + '</h2><button class="lnk" type="button" data-act="nueva" data-cliente="' + esc(c.nombre) + '">+ Nueva</button></div>' + listaTareas(x.ts.sort(orden), 'Sin tareas abiertas.') + '</div>' +
      '<div class="dsec"><h2 class="s">Por verificar</h2><div class="card" id="dv"><div class="loading">Leyendo…</div></div></div>' +
      '<div class="dsec"><h2 class="s">Bitácora</h2><button class="card btnbit" type="button" id="dbit">' + ic('book') + '<span><b>Leer la bitácora de ' + esc(c.nombre) + '</b><small>Se abre en una ventana</small></span>' + ic('arrow', 'chev') + '</button></div>' +
      (resto.length ? '<div class="dsec"><h2 class="s">Asociado · ' + resto.length + '</h2><div class="bals">' + resto.map(tile).join('') + '</div></div>' : '') +
      '</div>';
    $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); document.body.classList.add('noscroll', 'dopen');
    $('#dx').onclick = cerrar;
    $('#dgo').onclick = function () { cerrar(); location.hash = '#trabajo'; };
    // Por verificar y bitácora: se leen del Drive solo al abrir.
    var llenarVerif = function () {
      var el = $('#dv'); if (!el || abierto !== clave) return;
      var v = (VERIF.clientes || []).filter(function (z) { return z.cliente === (c.bitacora || c.cliente); })[0];
      el.innerHTML = v ? '<div class="md" style="padding:14px">' + md(v.texto).replace(/^<div class="md">|<\/div>$/g, '') + '</div>' : '<div class="empty">Esta bitácora no tiene pendientes por verificar.</div>';
    };
    if (VERIF) llenarVerif(); else api('verificar').then(function (j) { VERIF = j; llenarVerif(); }).catch(function (e) { var el = $('#dv'); if (el) el.innerHTML = '<div class="empty">No pude leerlo: ' + esc(e.message) + '</div>'; });
    $('#dbit').onclick = function () { abrirBitacora(clave); };
  }
  function cerrar() {
    abierto = null; $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); document.body.classList.remove('dopen'); if (!modalAbierto) document.body.classList.remove('noscroll');
    if (/^#c\//.test(location.hash)) history.replaceState(null, '', location.pathname + '#trabajo');
  }

  // ── Bitácora en ventana emergente ──
  var modalAbierto = false;
  function abrirBitacora(clave) {
    var c = cliente(clave); if (!c) return;
    var key = c.bitacora || c.cliente;
    modalAbierto = true;
    $('#mt').textContent = 'Bitácora · ' + c.nombre; $('#ms').textContent = c.perfil;
    $('#mb').innerHTML = '<div class="loading">Leyendo la bitácora…</div>';
    $('#modal').classList.add('on'); document.body.classList.add('noscroll');
    var pintar = function (j) {
      if (!modalAbierto) return;
      var cont = $('#mb');
      if (!j.bitacora) { cont.innerHTML = '<div class="empty">Este cliente todavía no tiene bitácora.</div>'; return; }
      var texto = md(j.bitacora) + (j.recortada ? '<div class="empty">Se muestra el inicio; lo más viejo está recortado.</div>' : '');
      cont.innerHTML = '<div class="mlay"><aside class="moutline" id="outline" aria-label="Secciones"></aside><div class="mtext" id="mtext"><select class="osel" id="osel" aria-label="Ir a una sección"></select>' + texto + '</div></div>';
      var hs = cont.querySelectorAll('.md h2'), fijas = [], fechadas = [];
      Array.prototype.forEach.call(hs, function (h, i) { (/^\d{4}-\d{2}-\d{2}/.test(h.textContent) ? fechadas : fijas).push([i, h.textContent]); });
      var grupo = function (t, l) { return l.length ? '<div class="og">' + t + ' · ' + l.length + '</div>' + l.map(function (p) { return '<button type="button" data-h="' + p[0] + '" title="' + esc(p[1]) + '">' + esc(p[1]) + '</button>'; }).join('') : ''; };
      $('#outline').innerHTML = grupo('Secciones', fijas) + grupo('Entradas por fecha', fechadas);
      $('#osel').innerHTML = '<option value="">Ir a una sección…</option>' + Array.prototype.map.call(hs, function (h, i) { return '<option value="' + i + '">' + esc(h.textContent) + '</option>'; }).join('');
      var ir = function (i) { hs[i].scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      document.querySelectorAll('#outline button').forEach(function (b) { b.onclick = function () { ir(+b.dataset.h); }; });
      $('#osel').onchange = function () { if (this.value !== '') ir(+this.value); this.value = ''; };
      var mt = $('#mtext'), botones = document.querySelectorAll('#outline button');
      mt.onscroll = function () {
        var act = -1; Array.prototype.forEach.call(hs, function (h, i) { if (h.offsetTop - mt.offsetTop <= mt.scrollTop + 60) act = i; });
        botones.forEach(function (b) { b.classList.toggle('on', +b.dataset.h === act); });
      };
      mt.onscroll();
    };
    if (BIT[key]) return pintar(BIT[key]);
    api('bitacora', { cliente: key }).then(function (j) { BIT[key] = j; pintar(j); })
      .catch(function (e) { if (modalAbierto) $('#mb').innerHTML = '<div class="empty">No pude leerla: ' + esc(e.message) + '</div>'; });
  }
  function cerrarBitacora() { modalAbierto = false; $('#modal').classList.remove('on'); if (!abierto) document.body.classList.remove('noscroll'); }

  // ── Buscador ⌘K ──
  var palSel = 0, palItems = [];
  function palRender() {
    $('#plist').innerHTML = palItems.length ? palItems.map(function (a, i) {
      var ico = a.l ? tileIco(a.l).replace('class="ti', 'class="ti sm') : a.k === 'open' ? '<span class="ti sm" data-mono="' + esc(inicial(a.n)) + '">' + imgLogo(logoPerfil(a.v), inicial(a.n)) + '</span>' : '<span class="ico neu">' + ic('arrow') + '</span>';
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

  // ── Cambios en tareas (se guardan en el Sheet por el Apps Script; la pantalla cambia primero y se revierte si falla) ──
  var toastT = null;
  function avisar(msg, acc) {
    var el = $('#toast');
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (acc ? '<button type="button" id="tundo">' + esc(acc.t) + '</button>' : '');
    el.classList.add('on');
    if (acc) $('#tundo').onclick = function () { el.classList.remove('on'); acc.f(); };
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 7000);
  }
  function escribir(accion, datos) {
    var cuerpo = Object.assign({ token: CFG.k, accion: accion }, datos);
    return fetch(CFG.u + '?portal=tarea', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.error) throw new Error(j.error); return j; });
  }
  function tareaPorId(id) { return D.tareas.filter(function (t) { return t.id === id; })[0]; }
  function guardarCache() { lsSet('mp_cache', JSON.stringify(D)); }
  function refrescaTareas() { render(true); if (abierto) abrir(abierto); }
  function cambiar(id, campos, aviso, sinDeshacer) {
    var t = tareaPorId(id); if (!t) return;
    var antes = {}; Object.keys(campos).forEach(function (k) { antes[k] = t[k]; });
    var cierra = campos.estado === 'hecha' || campos.estado === 'cancelada';
    var pos = D.tareas.indexOf(t);
    Object.assign(t, campos);
    if (cierra) D.tareas.splice(pos, 1);
    guardarCache(); refrescaTareas();
    escribir('actualizar', { id: id, campos: campos }).then(function (j) {
      if (j.tarea && !cierra) { t.negocio = j.tarea.negocio; t.cliente = j.tarea.cliente; guardarCache(); }
    }).catch(function (e) {
      Object.assign(t, antes); if (cierra) D.tareas.splice(Math.min(pos, D.tareas.length), 0, t);
      guardarCache(); refrescaTareas(); avisar('No pude guardar el cambio: ' + e.message);
    });
    if (aviso) avisar(aviso, sinDeshacer ? null : { t: 'Deshacer', f: function () {
      Object.assign(t, antes); if (cierra) D.tareas.splice(Math.min(pos, D.tareas.length), 0, t);
      guardarCache(); refrescaTareas();
      escribir('actualizar', { id: id, campos: antes }).catch(function (e) { avisar('No pude deshacer: ' + e.message); });
    } });
  }
  function nuevaTarea(d) {
    var tmp = { id: 'tmp' + Date.now(), tarea: d.tarea, notas: d.notas, fecha_limite: d.fecha_limite, prioridad: d.prioridad, estado: 'pendiente', cliente: d.cliente, negocio: '' };
    D.tareas.push(tmp); guardarCache(); refrescaTareas();
    escribir('crear', d).then(function (j) { Object.assign(tmp, j.tarea); guardarCache(); refrescaTareas(); avisar('Tarea creada'); })
      .catch(function (e) { D.tareas.splice(D.tareas.indexOf(tmp), 1); guardarCache(); refrescaTareas(); avisar('No pude crear la tarea: ' + e.message); });
  }

  // Formulario de nota (nueva o editar). Se guarda en el Sheet por el Apps Script; si la nota tiene cliente y se marca, cae en su bitácora.
  var nEdit = null;
  function escribirNota(accion, datos) {
    var cuerpo = Object.assign({ token: CFG.k, accion: accion }, datos);
    return fetch(CFG.u + '?portal=nota', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j.error) throw new Error(j.error); return j; });
  }
  function guardarNotas() { lsSet('mp_n', JSON.stringify(NOTAS)); }
  function pintaEnviar() {
    var cli = $('#n-cli').value, enviada = nEdit && nEdit.bitacora === 'si', fila = $('#n-envf');
    fila.hidden = !cli;
    $('#n-env').disabled = !!enviada;
    if (enviada) { $('#n-env').checked = true; $('#n-envt').textContent = 'Ya está en la bitácora. Si la editas aquí, la bitácora conserva la versión original.'; }
    else $('#n-envt').textContent = 'Mandar también a la bitácora de ' + nombreBit(cli);
  }
  function abrirNota(n, cli) {
    nEdit = n || null;
    $('#nt').textContent = n ? 'Editar nota' : 'Nueva nota';
    $('#n-titulo').value = n ? sinApostrofo(n.titulo) : ''; $('#n-texto').value = n ? sinApostrofo(n.texto) : '';
    $('#n-etq').innerHTML = '<option value="">Sin etiqueta</option>' + ETQ_NOTA.map(function (e) { return '<option value="' + e + '">' + e.charAt(0).toUpperCase() + e.slice(1) + '</option>'; }).join('');
    $('#n-etq').value = n ? (n.etiqueta || '') : '';
    $('#n-cli').innerHTML = '<option value="">Sin cliente (solo en el portal)</option>' + clavesBit().map(function (c) { return '<option value="' + esc(c.k) + '">' + esc(c.n) + '</option>'; }).join('');
    $('#n-cli').value = n ? (n.cliente || '') : (cli || '');
    $('#n-env').checked = !n;  // una nota nueva con cliente va a su bitácora salvo que se desmarque
    $('#n-arch').hidden = !n;
    pintaEnviar();
    $('#nmodal').classList.add('on'); setTimeout(function () { $('#n-titulo').focus(); }, 30);
  }
  function cerrarNota() { $('#nmodal').classList.remove('on'); nEdit = null; }
  function enviarNota(e) {
    e.preventDefault();
    var d = { titulo: $('#n-titulo').value.trim(), texto: $('#n-texto').value, etiqueta: $('#n-etq').value, cliente: $('#n-cli').value };
    if (!d.titulo) return;
    var enviar = !!d.cliente && $('#n-env').checked && !(nEdit && nEdit.bitacora === 'si');
    var btn = $('#n-ok'); btn.disabled = true; btn.textContent = 'Guardando…';
    var p;
    if (!nEdit) p = escribirNota('crear', Object.assign({ enviar: enviar }, d));
    else {
      var campos = {}; Object.keys(d).forEach(function (k) { if (d[k] !== sinApostrofo(nEdit[k] || '')) campos[k] = d[k]; });
      if (!Object.keys(campos).length && !enviar) { btn.disabled = false; btn.textContent = 'Guardar'; cerrarNota(); return; }
      p = escribirNota('actualizar', { id: nEdit.id, campos: campos, enviar: enviar });
    }
    p.then(function (j) {
      var i = (NOTAS || []).map(function (x) { return x.id; }).indexOf(j.nota.id);
      NOTAS = NOTAS || [];
      if (i >= 0) NOTAS[i] = j.nota; else NOTAS.unshift(j.nota);
      NOTAS.sort(function (a, b) { return a.actualizada < b.actualizada ? 1 : a.actualizada > b.actualizada ? -1 : 0; });
      guardarNotas(); cerrarNota(); render(true);
      avisar(j.nota.bitacora === 'si' && enviar ? 'Nota guardada y enviada a la bitácora (llega en unos 10 min)' : 'Nota guardada');
    }).catch(function (er) { avisar('No pude guardar la nota: ' + er.message); })
      .then(function () { btn.disabled = false; btn.textContent = 'Guardar'; });
  }
  function archivarNota() {
    if (!nEdit) return;
    var id = nEdit.id;
    escribirNota('archivar', { id: id }).then(function () {
      NOTAS = NOTAS.filter(function (x) { return x.id !== id; }); guardarNotas(); cerrarNota(); render(true); avisar('Nota archivada');
    }).catch(function (er) { avisar('No pude archivar: ' + er.message); });
  }

  // Menús flotantes
  function cerrarPop() { var p = $('#pop'); if (p) p.remove(); }
  function popMenu(ancla, items) {
    cerrarPop();
    var p = document.createElement('div'); p.className = 'pop'; p.id = 'pop';
    p.innerHTML = items.map(function (it, i) {
      if (it.sep) return '<div class="psep"></div>';
      if (it.label) return '<div class="plabel">' + esc(it.label) + '</div>';
      if (it.html) return it.html;
      return '<button type="button" class="pi' + (it.on ? ' on' : '') + (it.danger ? ' dg' : '') + '" data-i="' + i + '">' + esc(it.t) + '</button>';
    }).join('');
    document.body.appendChild(p);
    var r = ancla.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
    var x = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)), y = r.bottom + 6;
    if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 6);
    p.style.left = x + 'px'; p.style.top = y + 'px';
    p.querySelectorAll('.pi').forEach(function (b) { b.onclick = function () { var it = items[+b.dataset.i]; cerrarPop(); it.f(); }; });
    return p;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function isoMas(n) { var d = parse(hoyIso()); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function menuFecha(ancla, id) {
    var t = tareaPorId(id), lun = (8 - parse(hoyIso()).getDay()) % 7 || 7;
    var poner = function (f, txt) { return function () { cambiar(id, { fecha_limite: f }, txt); }; };
    popMenu(ancla, [
      { label: 'Fecha límite' },
      { t: 'Hoy', on: t.fecha_limite === isoMas(0), f: poner(isoMas(0), 'Para hoy') },
      { t: 'Mañana', on: t.fecha_limite === isoMas(1), f: poner(isoMas(1), 'Para mañana') },
      { t: 'Próximo lunes · ' + diaMes(isoMas(lun)), f: poner(isoMas(lun), 'Movida al lunes') },
      { t: 'En una semana', f: poner(isoMas(7), 'Movida una semana') },
      { t: 'Sin fecha', f: poner('', 'Sin fecha') },
      { sep: 1 },
      { html: '<label class="pdate">Otra fecha<input type="date" id="pfecha" value="' + esc(t.fecha_limite || '') + '"></label>' }
    ]);
    $('#pfecha').onchange = function () { var v = this.value; cerrarPop(); if (v) cambiar(id, { fecha_limite: v }, 'Fecha cambiada a ' + diaMes(v)); };
  }
  function menuCliente(ancla, id) {
    var t = tareaPorId(id), actual = t._c ? nombreCliente(t._c) : '';
    var items = [{ label: 'Cliente' }, { t: 'Sin cliente', on: !actual, f: function () { cambiar(id, { cliente: '' }, 'Sin cliente'); } }];
    clientesTodos().forEach(function (c) { items.push({ t: c.nombre + ' · ' + c.perfil, on: c.nombre === actual, f: function () { cambiar(id, { cliente: c.nombre }, 'Asignada a ' + c.nombre); } }); });
    popMenu(ancla, items);
  }
  function menuTarea(ancla, id) {
    var t = tareaPorId(id);
    var prio = function (p, n) { return { t: n, on: t.prioridad === p, f: function () { cambiar(id, { prioridad: p }, 'Prioridad ' + p); } }; };
    popMenu(ancla, [
      { t: 'Editar…', f: function () { abrirForm(t); } },
      { label: 'Prioridad' }, prio('alta', 'Alta'), prio('media', 'Media'), prio('baja', 'Baja'),
      { sep: 1 },
      t.estado === 'en curso' ? { t: 'Volver a pendiente', f: function () { cambiar(id, { estado: 'pendiente' }, 'Vuelve a pendiente'); } } : { t: 'Marcar en curso', f: function () { cambiar(id, { estado: 'en curso' }, 'En curso'); } },
      { t: 'Cambiar cliente…', f: function () { menuCliente(ancla, id); } },
      { sep: 1 },
      { t: 'Cancelar tarea', danger: true, f: function () { cambiar(id, { estado: 'cancelada' }, 'Tarea cancelada'); } }
    ]);
  }

  // Formulario de tarea (nueva o editar)
  var tEdit = null;
  function abrirForm(t, cli) {
    tEdit = t || null;
    $('#tt').textContent = t ? 'Editar tarea' : 'Nueva tarea';
    $('#t-tarea').value = t ? t.tarea : ''; $('#t-notas').value = t ? (t.notas || '') : '';
    $('#t-fecha').value = t ? (t.fecha_limite || '') : ''; $('#t-prio').value = t ? (t.prioridad || 'media') : 'media';
    var sel = $('#t-cli');
    sel.innerHTML = '<option value="">Sin cliente</option>' + clientesTodos().map(function (c) { return '<option value="' + esc(c.nombre) + '">' + esc(c.nombre) + '</option>'; }).join('');
    sel.value = t ? (t._c ? nombreCliente(t._c) : '') : (cli || '');
    $('#tmodal').classList.add('on'); setTimeout(function () { $('#t-tarea').focus(); }, 30);
  }
  function cerrarForm() { $('#tmodal').classList.remove('on'); tEdit = null; }
  function enviarForm(e) {
    e.preventDefault();
    var d = { tarea: $('#t-tarea').value.trim(), notas: $('#t-notas').value.trim(), fecha_limite: $('#t-fecha').value, prioridad: $('#t-prio').value, cliente: $('#t-cli').value };
    if (!d.tarea) return;
    var t = tEdit; cerrarForm();
    if (!t) return nuevaTarea(d);
    var actual = { tarea: t.tarea, notas: t.notas || '', fecha_limite: t.fecha_limite || '', prioridad: t.prioridad || 'media', cliente: t._c ? nombreCliente(t._c) : '' };
    var campos = {}; Object.keys(d).forEach(function (k) { if (d[k] !== actual[k]) campos[k] = d[k]; });
    if (Object.keys(campos).length) cambiar(t.id, campos, 'Tarea actualizada');
  }

  // ── Menú lateral (móvil) ──
  function menuLateral(abrir) {
    document.body.classList.toggle('menu-open', abrir);
    document.body.classList.toggle('noscroll', abrir || !!abierto || modalAbierto);
    var b = $('#mbtn'); if (b) b.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  }
  $('#mbtn').innerHTML = ic('menu');
  $('#mbtn').onclick = function () { menuLateral(!document.body.classList.contains('menu-open')); };
  $('#mscrim').onclick = function () { menuLateral(false); };
  $('#navs').addEventListener('click', function (e) { if (e.target.closest('a')) menuLateral(false); });

  // ── Router ──
  var TABS = [['hoy', 'Hoy', 'home'], ['trabajo', 'Trabajo', 'brief'], ['tareas', 'Tareas', 'check'], ['notas', 'Notas', 'note'], ['fin', 'Finanzas', 'wallet'], ['enlaces', 'Enlaces', 'link']];
  function ruta() {
    var p = (location.hash || '#hoy').slice(1).split('/');
    return { v: p[0] || 'hoy', a: p[1] || '' };
  }
  function pintarNav(activa) {
    var venc = D ? tareasAbiertas().filter(function (t) { return t.fecha_limite && t.fecha_limite < hoyIso(); }).length : 0;
    $('#navs').innerHTML = TABS.map(function (t) {
      return '<a class="nav' + (activa === t[0] ? ' on' : '') + '" href="#' + t[0] + '">' + ic(t[2]) + t[1] + (t[0] === 'hoy' && venc ? '<span class="bd">' + venc + '</span>' : '') + '</a>';
    }).join('');
    $('#tabs').innerHTML = TABS.filter(function (t) { return t[0] !== 'notas' && t[0] !== 'enlaces'; }).map(function (t) {
      return '<a href="#' + t[0] + '" class="' + (activa === t[0] ? 'on' : '') + '">' + ic(t[2]) + t[1] + (t[0] === 'hoy' && venc ? '<span class="badge">' + venc + '</span>' : '') + '</a>';
    }).join('');
  }
  function bind() {
    var qi = $('#q');
    if (qi) qi.oninput = function () { st.q = qi.value; var p = qi.selectionStart; render(true); var n = $('#q'); if (n) { n.focus(); n.setSelectionRange(p, p); } };
    document.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { st.filtro = b.dataset.f; render(true); }; });
    document.querySelectorAll('[data-vista]').forEach(function (b) { b.onclick = function () { st.vista = b.dataset.vista; lsSet('mp_vista', st.vista); render(true); }; });
    document.querySelectorAll('[data-tarea]').forEach(function (b) { b.onclick = function () { st.tarea = b.dataset.tarea; render(true); }; });
    document.querySelectorAll('[data-etq]').forEach(function (b) { b.onclick = function () { st.netq = b.dataset.etq; render(true); }; });
    var ncl = $('#ncl'); if (ncl) ncl.onchange = function (e) { st.ncliente = e.target.value; render(true); };
    document.querySelectorAll('[data-nid]').forEach(function (b) { b.onclick = function () { var n = (NOTAS || []).filter(function (x) { return x.id === b.dataset.nid; })[0]; if (n) abrirNota(n); }; });
    document.querySelectorAll('[data-tvista]').forEach(function (b) { b.onclick = function () { st.tvista = b.dataset.tvista; lsSet('mp_tvista', st.tvista); render(true); }; });
    var tcl = $('#tcl'); if (tcl) tcl.onchange = function (e) { st.tcliente = e.target.value; render(true); };
  }
  function render(mismo) {
    if (!D) return;
    var r = ruta(), v = r.v === 'c' ? 'trabajo' : r.v, html;
    if (!mismo && v !== 'trabajo' && v !== 'enlaces' && v !== 'notas') st.q = '';
    if (!mismo && r.v === 'tareas') { st.tarea = { venc: 'Vencidas', hoy: 'Hoy', sem: 'Semana' }[r.a] || 'Todas'; st.tcliente = ''; }
    if (v === 'trabajo') html = vTrabajo(); else if (v === 'tareas') html = vTareas(); else if (v === 'notas') html = vNotas(); else if (v === 'fin') html = vFin(); else if (v === 'enlaces') html = vEnlaces(); else { v = 'hoy'; html = vHoy(); }
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
    if (D && (v === 'hoy' || v === 'trabajo' || v === 'fin' || v === 'c' || (v === 'notas' && !$('#nmodal').classList.contains('on')))) render(true);
    if (D && abierto) abrir(abierto);
  }
  function cargarExtras() {
    api('trabajo').then(function (j) { TRAB = j; TRAB_ERR = ''; lsSet('mp_t', JSON.stringify(j)); refresca(); })
      .catch(function (e) { if (!e.auth) { TRAB_ERR = e.message; refresca(); } });
    api('notas').then(function (j) { NOTAS = j.notas; guardarNotas(); refresca(); })
      .catch(function (e) { if (!e.auth && NOTAS === null) NOTAS = []; });
    api('finanzas').then(function (j) { FIN = j; FIN_ERR = ''; lsSet('mp_f', JSON.stringify(j)); refresca(); })
      .catch(function (e) { if (!e.auth) { FIN_ERR = e.message; refresca(); } });
  }
  var ultima = Date.now();
  function cargar(silencioso) {
    girar(true);
    return api('datos').then(function (j) {
      ultima = Date.now();
      D = visibles(j); lsSet('mp_cache', JSON.stringify(j));
      mostrar('app'); render(!!silencioso); cargarExtras();
    }).catch(function (e) {
      if (e.auth) { lsDel('mp_cfg'); lsDel('mp_cache'); lsDel('mp_t'); lsDel('mp_f'); lsDel('mp_n'); CFG = null; D = null; mostrar('login'); var m = $('#login-err'); m.textContent = 'La clave ya no es válida. Abre de nuevo el enlace de instalación.'; m.classList.remove('hide'); return; }
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
  function salir() { ['mp_cfg', 'mp_cache', 'mp_t', 'mp_f', 'mp_n'].forEach(lsDel); location.hash = ''; location.reload(); }

  // El panel se actualiza solo: cada 5 minutos con la pestaña a la vista, y al volver a ella si pasaron más de 2.
  // No actualiza mientras se escribe en un campo ni con la bitácora abierta.
  function autoActualizar(minimo) {
    if (!D || document.hidden || modalAbierto || Date.now() - ultima < minimo) return;
    var el = document.activeElement;
    if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return;
    cargar(true);
  }
  setInterval(function () { autoActualizar(270000); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) autoActualizar(120000); });

  function iniciar() {
    $('#refresh').innerHTML = ic('refresh'); $('#sbtn-i').innerHTML = ic('search'); $('#pal-i').innerHTML = ic('search');
    $('#refresh').onclick = function () { BIT = {}; VERIF = null; FINS = {}; finSel = ''; cargar(true); };
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
    $('#mx').onclick = cerrarBitacora;
    $('#nx').onclick = cerrarNota; $('#nc').onclick = cerrarNota; $('#nform').onsubmit = enviarNota; $('#n-arch').onclick = archivarNota; $('#n-cli').onchange = pintaEnviar;
    $('#nmodal').onclick = function (e) { if (e.target === this) cerrarNota(); };
    $('#tx').onclick = cerrarForm; $('#tc').onclick = cerrarForm; $('#tform').onsubmit = enviarForm;
    $('#tmodal').onclick = function (e) { if (e.target === this) cerrarForm(); };
    // Un solo manejador para fichas de cliente y acciones de tareas (sirve también para lo que se dibuja después, como el panel lateral).
    document.addEventListener('click', function (e) {
      var dentro = e.target.closest && e.target.closest('#pop');
      if (!dentro) cerrarPop();
      var a = e.target.closest ? e.target.closest('[data-act],[data-open]') : null;
      if (!a || dentro || !D) return;
      if (a.dataset.open) { abrir(a.dataset.open); return; }
      var act = a.dataset.act, fila = a.closest('.tk'), id = fila ? fila.dataset.id : '';
      if (act === 'nueva') return abrirForm(null, a.dataset.cliente || '');
      if (act === 'nnueva') return abrirNota(null, st.ncliente && st.ncliente !== '__sin' ? st.ncliente : '');
      if (act === 'cat') { var cd = a.parentNode.querySelector('.cd'); cd.hidden = !cd.hidden; a.setAttribute('aria-expanded', String(!cd.hidden)); return; }
      if (act === 'mes') return irMesFin(+a.dataset.d);
      if (act === 'masmov') { stF.n += 20; return pintarMovs(); }
      if (!id || id.indexOf('tmp') === 0) return;
      if (act === 'done') cambiar(id, { estado: 'hecha' }, 'Tarea hecha');
      else if (act === 'fecha') menuFecha(a, id);
      else if (act === 'menu') menuTarea(a, id);
    });
    $('#modal').onclick = function (e) { if (e.target === this) cerrarBitacora(); };
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && D) { e.preventDefault(); palAbrir(!$('#pal').classList.contains('on')); return; }
      if (e.key === 'Escape') { if (document.body.classList.contains('menu-open')) { menuLateral(false); return; } if ($('#pal').classList.contains('on')) palAbrir(false); else if ($('#pop')) cerrarPop(); else if ($('#nmodal').classList.contains('on')) cerrarNota(); else if ($('#tmodal').classList.contains('on')) cerrarForm(); else if (modalAbierto) cerrarBitacora(); else if (abierto) cerrar(); return; }
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
    D = visibles(lsJson('mp_cache')); TRAB = lsJson('mp_t'); FIN = lsJson('mp_f'); st.tvista = lsGet('mp_tvista') === 'lista' ? 'lista' : 'clientes'; NOTAS = lsJson('mp_n');
    if (D) { mostrar('app'); render(false); }
    cargar(!!D);
  }
  iniciar();
})();
