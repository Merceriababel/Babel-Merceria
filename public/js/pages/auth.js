/**
 * Pantallas públicas: iniciar sesión, recuperar contraseña y elegir contraseña nueva.
 *
 * Rutas:  #/login · #/recuperar · #/restablecer?token=...
 * API:    POST /auth/login · POST /auth/forgot · POST /auth/reset
 */

/* ---------------------------------------------------------------------------
 * Iniciar sesión
 * ------------------------------------------------------------------------- */
pages.login = (el) => {
  el.innerHTML = `
    <div class="auth">
      <div class="brandside">
        <img src="assets/logo.png" alt="Babel Mercería">
      </div>
      <div class="formside">
        <form id="form" class="stack">
          <h1>Ingresar</h1>
          <p class="muted">Sistema de gestión de Babel Mercería</p>
          <div>
            <label class="label" for="email">Correo</label>
            <input id="email" class="input" type="email" required autocomplete="username">
          </div>
          <div>
            <label class="label" for="password">Contraseña</label>
            <input id="password" class="input" type="password" required autocomplete="current-password">
          </div>
          <button class="btn block" id="entrar">Iniciar sesión</button>
          <a href="#/recuperar"><b>Olvidé mi contraseña</b></a>
        </form>
      </div>
    </div>`;

  $('#form', el).onsubmit = async (e) => {
    e.preventDefault();
    const boton = $('#entrar', el);
    boton.disabled = true;
    boton.textContent = 'Ingresando…';

    try {
      const datos = await post('/auth/login', {
        email: $('#email', el).value,
        password: $('#password', el).value,
      });
      // Guardar la sesión en el navegador y entrar al sistema
      localStorage.setItem('token', datos.token);
      localStorage.setItem('user', JSON.stringify(datos.user));
      user = datos.user;
      location.hash = '#/';
    } catch (error) {
      toast('err', error.message);
      boton.disabled = false;
      boton.textContent = 'Iniciar sesión';
    }
  };
};

/* ---------------------------------------------------------------------------
 * Recuperar contraseña (pide el correo y envía el enlace)
 * ------------------------------------------------------------------------- */

/** Tarjeta centrada con el logo, usada por las pantallas de recuperación. */
const authBox = (titulo, contenido) => `
  <div class="auth single">
    <div class="card stack">
      <img src="assets/logo.png" alt="Babel Mercería">
      <h2>${titulo}</h2>
      ${contenido}
      <a href="#/login"><b>Volver a ingresar</b></a>
    </div>
  </div>`;

pages.recuperar = (el) => {
  el.innerHTML = authBox('Recuperar contraseña', `
    <form id="form" class="stack">
      <input id="email" class="input" type="email" placeholder="Tu correo" required>
      <button class="btn block">Enviar enlace</button>
    </form>`);

  $('#form', el).onsubmit = async (e) => {
    e.preventDefault();
    try {
      await post('/auth/forgot', { email: $('#email', el).value });
      // Mensaje neutro: no se revela si el correo existe o no
      toast('ok', 'Si el correo existe, te enviamos un enlace para elegir una contraseña nueva.');
    } catch (error) {
      toast('err', error.message);
    }
  };
};

/* ---------------------------------------------------------------------------
 * Elegir contraseña nueva (se llega desde el enlace del correo)
 * ------------------------------------------------------------------------- */
pages.restablecer = (el, params) => {
  el.innerHTML = authBox('Elegí una contraseña nueva', `
    <form id="form" class="stack">
      <input id="password" class="input" type="password" minlength="6"
             placeholder="Nueva contraseña (mín. 6)" required>
      <button class="btn block">Guardar</button>
    </form>`);

  $('#form', el).onsubmit = async (e) => {
    e.preventDefault();
    try {
      // El token viene en el enlace: #/restablecer?token=...
      await post('/auth/reset', { token: params.get('token'), password: $('#password', el).value });
      toast('ok', 'Contraseña actualizada. Ya podés ingresar.');
      setTimeout(() => (location.hash = '#/login'), 1200);
    } catch (error) {
      toast('err', error.message);
    }
  };
};
