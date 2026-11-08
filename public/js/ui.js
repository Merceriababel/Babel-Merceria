/**
 * Utilidades de interfaz compartidas por todas las páginas.
 *
 * Contiene:
 *   1. Registro de páginas y atajos del DOM
 *   2. Formateo (texto seguro, dinero, cantidades, fechas)
 *   3. Piezas de HTML reutilizables (etiquetas, encabezados, tarjetas)
 *   4. Avisos (toast) y ventana modal
 *   5. Opciones "producto · color" para formularios
 */

/* ---------------------------------------------------------------------------
 * 1. Registro de páginas y atajos del DOM
 * ------------------------------------------------------------------------- */

/**
 * Registro de páginas. Cada archivo de js/pages/ agrega una función acá:
 *   pages.nombre = async (contenedor, parametros) => { ... }
 * y app.js la ejecuta según la ruta (#/nombre).
 */
const pages = {};

/** Busca el primer elemento que coincide con el selector (dentro de `raiz`). */
const $ = (selector, raiz = document) => raiz.querySelector(selector);

/** Busca todos los elementos que coinciden y los devuelve como un array. */
const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

/* ---------------------------------------------------------------------------
 * 2. Formateo
 * ------------------------------------------------------------------------- */

/**
 * Escapa texto para insertarlo de forma segura en HTML.
 * USAR SIEMPRE con datos que vienen del usuario o de la base (evita inyección de código).
 */
const esc = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

/** Formatea un número como pesos argentinos. Ej: 12000 → "$ 12.000". */
const money = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n || 0);

/** Formatea un número con separador de miles y hasta 2 decimales. */
const num = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n || 0);

/** Cantidad con su unidad. Ej: qty(2.5, 'm') → "2,5 m". */
const qty = (n, unidad) => `${num(n)} ${unidad || ''}`.trim();

/** Fecha de hoy en formato AAAA-MM-DD (el que usan los campos <input type="date">). */
const today = () => new Date().toLocaleDateString('en-CA');

/** Retrasa una función hasta que pasen `ms` sin nuevos llamados (para buscar mientras se escribe). */
const debounce = (fn, ms = 250) => {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), ms);
  };
};

/* ---------------------------------------------------------------------------
 * 3. Piezas de HTML reutilizables
 * ------------------------------------------------------------------------- */

/** Texto y color de cada estado (stock y ventas). Clave = valor que envía la API. */
const ESTADOS = {
  normal:    ['Normal',    'p-ok'],
  bajo:      ['Bajo',      'p-low'],
  critico:   ['Crítico',   'p-crit'],
  aprobada:  ['Aprobada',  'p-ok'],
  pendiente: ['Pendiente', 'p-low'],
  cancelada: ['Cancelada', 'p-crit'],
};

/** Etiqueta de color con el estado. Ej: pill('bajo') → <span class="pill p-low">Bajo</span>. */
const pill = (estado) => {
  const [texto, clase] = ESTADOS[estado] || [estado, ''];
  return `<span class="pill ${clase}">${esc(texto)}</span>`;
};

/** Círculo con el color de una variante (usa gris claro si no tiene color definido). */
const swatch = (color) => `<span class="sw" style="background:${esc(color || '#E5D5CD')}"></span>`;

/**
 * Encabezado de página: título, subtítulo y botones a la derecha.
 * OJO: `title`, `sub` y `acts` se insertan como HTML; escapar con esc() lo que venga de datos.
 */
const titleBar = (title, sub = '', acts = '') => `
  <div class="titlebar">
    <div>
      <h1>${title}</h1>
      ${sub ? `<div class="muted">${sub}</div>` : ''}
    </div>
    <div class="acts">${acts}</div>
  </div>`;

/** Tarjeta de indicador: etiqueta, valor grande y nota opcional. */
const stat = (etiqueta, valor, nota = '') => `
  <div class="card stat grow1">
    <div class="l">${etiqueta}</div>
    <div class="v">${valor}</div>
    ${nota ? `<div class="s">${nota}</div>` : ''}
  </div>`;

/* ---------------------------------------------------------------------------
 * 4. Avisos y ventana modal
 * ------------------------------------------------------------------------- */

/**
 * Muestra un aviso flotante que desaparece solo a los 4,5 segundos.
 * @param {'ok'|'err'} tipo  verde (éxito) o rojo (error)
 */
function toast(tipo, texto) {
  const aviso = document.createElement('div');
  aviso.className = `toast ${tipo}`;
  aviso.textContent = texto;
  $('#toasts').appendChild(aviso);
  setTimeout(() => aviso.remove(), 4500);
}

/**
 * Abre una ventana modal con un título y contenido HTML.
 * Se cierra con el botón "Cerrar" o tocando fuera de la ventana.
 * @returns {{el: HTMLElement, close: Function}} `el` para buscar campos adentro, `close` para cerrarla
 */
function openModal(titulo, html) {
  const fondo = document.createElement('div');
  fondo.className = 'overlay';
  fondo.innerHTML = `
    <div class="modal">
      <div class="head">
        <h2>${esc(titulo)}</h2>
        <button class="btn alt" data-close>Cerrar</button>
      </div>
      ${html}
    </div>`;

  const close = () => fondo.remove();
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo || e.target.closest('[data-close]')) close();
  });

  document.body.appendChild(fondo);
  return { el: fondo, close };
}

/* ---------------------------------------------------------------------------
 * 5. Opciones "producto · color" para formularios
 * ------------------------------------------------------------------------- */

/**
 * Trae todos los productos activos y devuelve una lista plana con una entrada por variante:
 * { id, label: "Cinta de raso · Roja", u: "m", costo }. Se usa en Compras y en Ajustes de stock.
 */
async function variantOptions() {
  const productos = await get('/products', { activos: true, limit: 1000 });
  return productos.flatMap((p) =>
    p.variants.map((v) => ({
      id: v.id,
      label: `${p.nombre} · ${v.color}`,
      u: p.unidad,
      costo: p.precio_compra,
    }))
  );
}

/** Arma las <option> de un <select> con la lista de variantes y un texto inicial. */
const optionsHTML = (opciones, placeholder) =>
  `<option value="">${placeholder}</option>` +
  opciones.map((o) => `<option value="${o.id}">${esc(o.label)} (${o.u})</option>`).join('');
