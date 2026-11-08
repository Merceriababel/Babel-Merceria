/**
 * Proveedores (solo admin): datos de contacto, cantidad de compras y gasto acumulado.
 *
 * Ruta: #/proveedores    ·    API: GET/POST /suppliers, PUT /suppliers/{id}
 */
pages.proveedores = async (el) => {
  let lista = [];

  el.innerHTML = `
    ${titleBar('Proveedores', 'Datos de contacto, compras y gastos acumulados',
      '<button class="btn" id="nuevo">Nuevo proveedor</button>')}
    <div class="card scroll"><div id="tabla"></div></div>`;

  /** Tabla de proveedores con el gasto acumulado de cada uno. */
  const dibujarTabla = () => {
    $('#tabla', el).innerHTML = `
      <table class="tbl">
        <tr>
          <th>Nombre</th><th>Teléfono</th><th>Email</th><th>Dirección</th>
          <th>Compras</th><th>Gastos</th><th></th>
        </tr>
        ${lista.map((s) => `
          <tr>
            <td class="b">${esc(s.nombre)}</td>
            <td>${esc(s.telefono)}</td>
            <td>${esc(s.email)}</td>
            <td>${esc(s.direccion)}</td>
            <td>${s.compras}</td>
            <td>${money(s.gastos)}</td>
            <td><button class="btn alt" data-editar="${s.id}">Editar</button></td>
          </tr>`).join('') || '<tr><td colspan="7" class="muted">Todavía no cargaste proveedores.</td></tr>'}
      </table>`;
  };

  const cargar = async () => {
    lista = await get('/suppliers');
    dibujarTabla();
  };

  /** Formulario de alta/edición en ventana modal. Sin argumento: proveedor nuevo. */
  const abrirFormulario = (proveedor) => {
    const s = proveedor || { nombre: '', telefono: '', email: '', direccion: '' };

    const modal = openModal(s.id ? 'Editar proveedor' : 'Nuevo proveedor', `
      <form id="form" class="stack">
        <div><label class="label">Nombre</label>
          <input class="input" id="nombre" value="${esc(s.nombre)}" required></div>
        <div><label class="label">Teléfono</label>
          <input class="input" id="telefono" value="${esc(s.telefono)}"></div>
        <div><label class="label">Email</label>
          <input class="input" id="email" type="email" value="${esc(s.email)}"></div>
        <div><label class="label">Dirección</label>
          <input class="input" id="direccion" value="${esc(s.direccion)}"></div>
        <button class="btn block">Guardar</button>
      </form>`);

    $('#form', modal.el).onsubmit = async (e) => {
      e.preventDefault();
      // Los campos vacíos se envían como null
      const valor = (id) => $('#' + id, modal.el).value || null;
      const cuerpo = {
        nombre: valor('nombre'),
        telefono: valor('telefono'),
        email: valor('email'),
        direccion: valor('direccion'),
      };
      try {
        if (s.id) await put(`/suppliers/${s.id}`, cuerpo);
        else await post('/suppliers', cuerpo);
        modal.close();
        toast('ok', 'Proveedor guardado');
        cargar();
      } catch (error) {
        toast('err', error.message);
      }
    };
  };

  // --- Eventos ---
  $('#nuevo', el).onclick = () => abrirFormulario();
  $('#tabla', el).addEventListener('click', (e) => {
    const boton = e.target.closest('[data-editar]');
    if (boton) abrirFormulario(lista.find((s) => s.id === Number(boton.dataset.editar)));
  });

  await cargar();
};
