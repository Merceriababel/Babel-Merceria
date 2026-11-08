/**
 * Arranque de la aplicación: sesión, menú lateral y rutas.
 *
 * Las rutas usan el "hash" de la URL (ej. https://sitio/#/productos), por eso no hace falta
 * configurar nada en el servidor. Para agregar una pantalla nueva:
 *   1. Crear js/pages/<nombre>.js con  pages.<nombre> = async (el) => { ... }
 *   2. Cargarlo en index.html (antes de app.js)
 *   3. Agregarlo a la lista NAV de abajo
 */

/* ---------------------------------------------------------------------------
 * Sesión
 * ------------------------------------------------------------------------- */

/** Usuario logueado ({id, nombre, email, rol}) o null. Se recupera del navegador al recargar. */
let user = JSON.parse(localStorage.getItem('user') || 'null');

/** ¿El usuario actual es administrador? */
const isAdmin = () => !!user && user.rol === 'admin';

/** Cierra la sesión y vuelve al login. */
function logout() {
  localStorage.clear();
  user = null;
  location.hash = '#/login';
}

/* ---------------------------------------------------------------------------
 * Menú y rutas
 * ------------------------------------------------------------------------- */

/** Opciones del menú: [ruta, texto, soloAdmin]. El orden de la lista es el orden del menú. */
const NAV = [
  ['',            'Dashboard'],
  ['venta',       'Nueva venta'],
  ['ventas',      'Ventas del día'],
  ['productos',   'Productos'],
  ['stock',       'Stock'],
  ['compras',     'Compras',     true],
  ['proveedores', 'Proveedores', true],
  ['reportes',    'Reportes',    true],
  ['config',      'Configuración'],
];

/** Pantallas que se ven sin iniciar sesión. */
const PUBLIC = ['login', 'recuperar', 'restablecer'];

/** Dibuja la pantalla que corresponde a la URL actual. Se ejecuta al cargar y en cada cambio de hash. */
async function route() {
  // Separar "ruta?parametros" del hash (#/productos?nuevo=1)
  const [ruta, consulta] = location.hash.replace(/^#\/?/, '').split('?');
  const nombre = ruta || '';
  const params = new URLSearchParams(consulta || '');
  const app = $('#app');

  // --- Pantallas públicas (login, recuperar contraseña) ---
  if (PUBLIC.includes(nombre)) {
    if (user && nombre === 'login') {
      location.hash = '#/';  // ya hay sesión: ir al inicio
      return;
    }
    pages[nombre](app, params);
    return;
  }

  // --- Pantallas privadas: exigen sesión ---
  if (!user) {
    location.hash = '#/login';
    return;
  }

  // Ruta inexistente, o pantalla de admin siendo empleado → volver al inicio
  const opcion = NAV.find((n) => n[0] === nombre);
  if (!opcion || (opcion[2] && !isAdmin())) {
    location.hash = '#/';
    return;
  }

  // Menú lateral: se muestran solo las opciones permitidas para el rol
  const enlaces = NAV
    .filter(([, , soloAdmin]) => !soloAdmin || isAdmin())
    .map(([r, texto]) => `<a href="#/${r}" class="${r === nombre ? 'on' : ''}">${texto}</a>`)
    .join('');

  app.innerHTML = `
    <div class="layout">
      <aside class="side">
        <img src="assets/logo.png" alt="Babel Mercería">
        <nav class="nav">${enlaces}</nav>
        <div class="userbox">
          <b>${esc(user.nombre)}</b>
          <div class="rol">${esc(user.rol)}</div>
          <button class="btn alt block" id="logout">Cerrar sesión</button>
        </div>
        <button class="btn alt logout-m" id="logout2">Salir</button>
      </aside>
      <main id="main"><p>Cargando…</p></main>
    </div>`;
  $('#logout').onclick = logout;
  $('#logout2').onclick = logout;

  // Dibujar la página; si algo falla, mostrar el mensaje en lugar de dejar la pantalla en blanco
  const main = $('#main');
  try {
    await pages[nombre || 'dashboard'](main, params);
  } catch (error) {
    main.innerHTML = `<div class="card">${esc(error.message)}</div>`;
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
