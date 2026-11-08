/**
 * Configuración: datos de la cuenta y cambio de contraseña.
 *
 * Ruta: #/config    ·    API: POST /auth/change-password
 */
pages.config = (el) => {
  el.innerHTML = `
    ${titleBar('Configuración', `${esc(user.nombre)} · ${esc(user.email)}`)}
    <form id="form" class="card stack" style="max-width:440px">
      <h2>Cambiar contraseña</h2>
      <input id="actual" class="input" type="password" required
             placeholder="Contraseña actual" aria-label="Contraseña actual">
      <input id="nueva" class="input" type="password" minlength="6" required
             placeholder="Contraseña nueva (mín. 6)" aria-label="Contraseña nueva">
      <button class="btn">Guardar</button>
    </form>`;

  $('#form', el).onsubmit = async (e) => {
    e.preventDefault();
    try {
      await post('/auth/change-password', {
        actual: $('#actual', el).value,
        nueva: $('#nueva', el).value,
      });
      $('#actual', el).value = '';
      $('#nueva', el).value = '';
      toast('ok', 'Contraseña cambiada');
    } catch (error) {
      toast('err', error.message);
    }
  };
};
