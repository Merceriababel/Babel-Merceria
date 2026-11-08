/**
 * Productos: catálogo, variantes por color y stock.
 *
 * Ruta: #/productos (y #/productos?nuevo=1 abre el formulario de alta)
 * API:  GET /products, GET /categories, POST /products, PUT /products/{id}
 *
 * Todos pueden ver y buscar. Solo el administrador puede crear y editar (y ve el precio de compra).
 * Tocar una fila despliega sus colores con el stock de cada uno.
 */
pages.productos = async (el, params) => {
  const categorias = await get('/categories');
  const admin = isAdmin();
  let lista = [];  // productos mostrados actualmente

  // --- Estructura base ---
  const botonNuevo = admin ? '<button class="btn" id="nuevo">Nuevo producto</button>' : '';
  el.innerHTML = `
    ${titleBar('Productos', 'Catálogo, variantes por color y stock', botonNuevo)}
    <div class="card">
      <input id="q" class="input" aria-label="Buscar" style="margin-bottom:12px"
             placeholder="Buscar por nombre, código, categoría o color">
      <div class="scroll">
        <table class="tbl">
          <thead>
            <tr>
              <th>Código</th><th>Producto</th><th>Categoría</th><th>Variantes</th>
              <th>Stock</th><th>Precio</th><th>Estado</th>${admin ? '<th></th>' : ''}
            </tr>
          </thead>
          <tbody id="filas"></tbody>
        </table>
      </div>
    </div>`;

  /* -------------------------------------------------------------------------
   * Listado
   * ----------------------------------------------------------------------- */

  /** Fila de un producto + una fila oculta por cada color (se muestran al tocar el producto). */
  const filaDeProducto = (p) => `
    <tr class="click" data-producto="${p.id}">
      <td>${esc(p.codigo)}</td>
      <td class="b">${esc(p.nombre)}${p.activo ? '' : ' <small>(inactivo)</small>'}</td>
      <td>${esc(p.categoria || '—')}</td>
      <td>${p.variants.length}</td>
      <td>${qty(p.stock_total, p.unidad)}</td>
      <td>${money(p.precio_venta)}</td>
      <td>${pill(p.estado)}</td>
      ${admin ? `<td><button class="btn alt" data-editar="${p.id}">Editar</button></td>` : ''}
    </tr>
    ${p.variants.map((v) => `
      <tr class="sub hide" data-colores="${p.id}">
        <td></td>
        <td colspan="3">${swatch(v.codigo_color)}${esc(v.color)}</td>
        <td>${qty(v.stock_actual, p.unidad)}</td>
        <td></td>
        <td>${pill(v.estado)}</td>
        ${admin ? '<td></td>' : ''}
      </tr>`).join('')}`;

  const dibujarFilas = () => {
    $('#filas', el).innerHTML = lista.map(filaDeProducto).join('')
      || '<tr><td colspan="8" class="muted">Sin productos.</td></tr>';
  };

  const cargar = async () => {
    lista = await get('/products', { q: $('#q', el).value });
    dibujarFilas();
  };

  /* -------------------------------------------------------------------------
   * Formulario de alta / edición (ventana modal, solo admin)
   * ----------------------------------------------------------------------- */

  /** Bloque de campos de un color. Las variantes ya guardadas llevan su id y no permiten cambiar el stock acá. */
  const bloqueDeVariante = (v) => `
    <div class="vrow2" data-id="${v.id || ''}">
      <div>
        <label class="label">Color</label>
        <input class="input v-color" value="${esc(v.color)}">
      </div>
      <div>
        <label class="label">Tono</label>
        <input type="color" class="input v-tono" aria-label="Tono" value="${esc(v.codigo_color || '#cccccc')}">
      </div>
      <div>
        <label class="label">${v.id ? 'Stock: ' + num(v.stock_actual) : 'Stock inicial'}</label>
        ${v.id
          ? '<input class="input" disabled value="—">'
          : '<input class="input v-stock" type="number" min="0" step="0.01" value="0">'}
      </div>
      <div>
        <label class="label">Imagen (URL)</label>
        <input class="input v-imagen" value="${esc(v.imagen_url || '')}">
      </div>
    </div>`;

  const UNIDADES = [['m', 'Metro (m)'], ['kg', 'Kilogramo (kg)'], ['u', 'Unidad (u)']];

  /** Abre el formulario. Sin argumento: producto nuevo. Con producto: edición. */
  const abrirFormulario = (producto) => {
    const p = producto || {
      codigo: '', nombre: '', descripcion: '', category_id: '', unidad: 'u',
      precio_compra: 0, precio_venta: 0, stock_minimo: 0, imagen_url: '', activo: true,
      variants: [{ color: 'Único' }],
    };

    const modal = openModal(p.id ? 'Editar producto' : 'Nuevo producto', `
      <form id="form" class="stack">
        <div class="grid2">
          <div><label class="label">Nombre</label>
            <input class="input" id="nombre" value="${esc(p.nombre)}" required></div>
          <div><label class="label">Código interno</label>
            <input class="input" id="codigo" value="${esc(p.codigo)}" required></div>
          <div><label class="label">Categoría</label>
            <select class="input" id="categoria">
              <option value="">Sin categoría</option>
              ${categorias.map((c) =>
                `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}
            </select></div>
          <div><label class="label">Tipo de medición</label>
            <select class="input" id="unidad">
              ${UNIDADES.map(([clave, texto]) =>
                `<option value="${clave}" ${clave === p.unidad ? 'selected' : ''}>${texto}</option>`).join('')}
            </select></div>
          <div><label class="label">Precio de compra</label>
            <input class="input" id="precio-compra" type="number" min="0" step="0.01" value="${p.precio_compra}"></div>
          <div><label class="label">Precio de venta</label>
            <input class="input" id="precio-venta" type="number" min="0" step="0.01" value="${p.precio_venta}"></div>
          <div><label class="label">Stock mínimo</label>
            <input class="input" id="stock-minimo" type="number" min="0" step="0.01" value="${p.stock_minimo}"></div>
          <div><label class="label">Imagen (URL)</label>
            <input class="input" id="imagen" value="${esc(p.imagen_url || '')}" placeholder="https://…"></div>
        </div>

        <div><label class="label">Descripción</label>
          <input class="input" id="descripcion" value="${esc(p.descripcion || '')}"></div>

        <label><input type="checkbox" id="activo" ${p.activo ? 'checked' : ''}> <b>Producto activo</b></label>

        <div>
          <h3>Variantes (colores)</h3>
          <div id="variantes">${p.variants.map(bloqueDeVariante).join('')}</div>
          <button type="button" class="btn alt" id="agregar-color">+ Agregar color</button>
          ${p.id ? '<p class="muted">El stock de colores existentes se modifica desde Stock (ajustes) o Compras.</p>' : ''}
        </div>

        <button class="btn block">Guardar producto</button>
      </form>`);

    // Agregar un color nuevo (bloque vacío al final)
    $('#agregar-color', modal.el).onclick = () =>
      $('#variantes', modal.el).insertAdjacentHTML('beforeend', bloqueDeVariante({ color: '' }));

    // Guardar: leer los campos, armar el cuerpo y crear (POST) o actualizar (PUT)
    $('#form', modal.el).onsubmit = async (e) => {
      e.preventDefault();
      const campo = (id) => $('#' + id, modal.el);

      const cuerpo = {
        codigo: campo('codigo').value,
        nombre: campo('nombre').value,
        descripcion: campo('descripcion').value || null,
        category_id: campo('categoria').value ? Number(campo('categoria').value) : null,
        unidad: campo('unidad').value,
        precio_compra: Number(campo('precio-compra').value) || 0,
        precio_venta: Number(campo('precio-venta').value) || 0,
        stock_minimo: Number(campo('stock-minimo').value) || 0,
        imagen_url: campo('imagen').value || null,
        activo: campo('activo').checked,
        variants: $$('.vrow2', modal.el).map((fila) => ({
          id: fila.dataset.id ? Number(fila.dataset.id) : null,   // sin id = color nuevo
          color: $('.v-color', fila).value || 'Único',
          codigo_color: $('.v-tono', fila).value,
          imagen_url: $('.v-imagen', fila).value || null,
          stock_inicial: Number(($('.v-stock', fila) || {}).value) || 0,
        })),
      };

      try {
        if (p.id) await put(`/products/${p.id}`, cuerpo);
        else await post('/products', cuerpo);
        modal.close();
        toast('ok', 'Producto guardado');
        cargar();
      } catch (error) {
        toast('err', error.message);
      }
    };
  };

  /* -------------------------------------------------------------------------
   * Eventos
   * ----------------------------------------------------------------------- */

  // Buscar mientras se escribe
  $('#q', el).addEventListener('input', debounce(() => cargar().catch((e) => toast('err', e.message))));

  // Clic en una fila: "Editar" abre el formulario; el resto despliega/oculta los colores
  $('#filas', el).addEventListener('click', (e) => {
    const botonEditar = e.target.closest('[data-editar]');
    if (botonEditar) {
      e.stopPropagation();
      abrirFormulario(lista.find((p) => p.id === Number(botonEditar.dataset.editar)));
      return;
    }
    const fila = e.target.closest('[data-producto]');
    if (fila) {
      $$(`[data-colores="${fila.dataset.producto}"]`, el).forEach((f) => f.classList.toggle('hide'));
    }
  });

  if (admin) $('#nuevo', el).onclick = () => abrirFormulario();

  // --- Carga inicial ---
  await cargar();

  // Acceso rápido desde el dashboard: #/productos?nuevo=1 abre el alta directamente
  if (admin && params.get('nuevo')) {
    history.replaceState(null, '', '#/productos');
    abrirFormulario();
  }
};
