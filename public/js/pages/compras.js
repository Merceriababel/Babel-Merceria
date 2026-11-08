/**
 * Compras a distribuidores (solo admin).
 *
 * Ruta: #/compras    ·    API: GET /suppliers, GET /products, GET/POST /purchases
 *
 * Registrar una compra: aumenta el stock, registra el gasto y actualiza el costo vigente
 * de cada producto comprado.
 */
pages.compras = async (el) => {
  // Proveedores y lista de productos/colores (se piden en paralelo)
  const [proveedores, opciones] = await Promise.all([get('/suppliers'), variantOptions()]);

  el.innerHTML = `
    ${titleBar('Compras a distribuidores', 'Registrar una compra suma stock y registra el gasto')}
    <form id="form" class="card stack" style="margin-bottom:16px">
      <select id="proveedor" class="input" aria-label="Proveedor" required>
        <option value="">Elegí el proveedor…</option>
        ${proveedores.map((s) => `<option value="${s.id}">${esc(s.nombre)}</option>`).join('')}
      </select>

      <div id="renglones" class="stack"></div>
      <button type="button" class="btn alt" id="agregar">+ Agregar producto</button>

      <input id="notas" class="input" placeholder="Notas (opcional)">
      <div class="total" style="margin:0">Total <span id="total"></span></div>
      <button class="btn">Registrar compra</button>
    </form>

    <div class="card scroll">
      <h2>Historial de compras</h2>
      <div id="historial"></div>
    </div>`;

  /* -------------------------------------------------------------------------
   * Renglones de la compra (producto, cantidad, costo)
   * ----------------------------------------------------------------------- */

  /** HTML de un renglón vacío. */
  const renglon = () => `
    <div class="renglon" style="display:grid;grid-template-columns:1fr 90px 110px 40px;gap:8px">
      <select class="input r-variante" aria-label="Producto" required>
        ${optionsHTML(opciones, 'Producto y color…')}
      </select>
      <input class="input r-cantidad" type="number" min="0.01" step="0.01"
             placeholder="Cant." aria-label="Cantidad" required>
      <input class="input r-costo" type="number" min="0" step="0.01"
             placeholder="Costo u." aria-label="Costo unitario" required>
      <button type="button" class="btn alt" style="padding:0" aria-label="Quitar" data-quitar>✕</button>
    </div>`;

  /** Recalcula el total sumando cantidad × costo de cada renglón. */
  const calcularTotal = () => {
    const total = $$('.renglon', el).reduce((suma, fila) =>
      suma + (Number($('.r-cantidad', fila).value) || 0) * (Number($('.r-costo', fila).value) || 0), 0);
    $('#total', el).textContent = money(total);
  };

  const agregarRenglon = () => {
    $('#renglones', el).insertAdjacentHTML('beforeend', renglon());
    calcularTotal();
  };

  $('#agregar', el).onclick = agregarRenglon;

  // Al elegir un producto se sugiere su último costo (si el campo está vacío); luego se recalcula el total
  $('#renglones', el).addEventListener('input', (e) => {
    if (e.target.classList.contains('r-variante')) {
      const fila = e.target.closest('.renglon');
      const campoCosto = $('.r-costo', fila);
      const opcion = opciones.find((o) => o.id === Number(e.target.value));
      if (!campoCosto.value && opcion) campoCosto.value = opcion.costo;
    }
    calcularTotal();
  });

  // Quitar un renglón (siempre queda al menos uno)
  $('#renglones', el).addEventListener('click', (e) => {
    if (e.target.closest('[data-quitar]') && $$('.renglon', el).length > 1) {
      e.target.closest('.renglon').remove();
      calcularTotal();
    }
  });

  /* -------------------------------------------------------------------------
   * Historial
   * ----------------------------------------------------------------------- */
  const cargarHistorial = async () => {
    const compras = await get('/purchases');
    $('#historial', el).innerHTML = `
      <table class="tbl">
        <tr><th>Fecha</th><th>Proveedor</th><th>Productos</th><th>Total</th></tr>
        ${compras.map((c) => `
          <tr>
            <td style="white-space:nowrap">${c.fecha.slice(0, 10)}</td>
            <td>${esc(c.proveedor)}</td>
            <td>${c.items.map((i) => `<div>${num(i.cantidad)} × ${esc(i.producto)} · ${esc(i.color)}</div>`).join('')}</td>
            <td class="b">${money(c.total)}</td>
          </tr>`).join('') || '<tr><td colspan="4" class="muted">Todavía no hay compras.</td></tr>'}
      </table>`;
  };

  /* -------------------------------------------------------------------------
   * Guardar la compra
   * ----------------------------------------------------------------------- */
  $('#form', el).onsubmit = async (e) => {
    e.preventDefault();
    try {
      await post('/purchases', {
        supplier_id: Number($('#proveedor', el).value),
        notas: $('#notas', el).value || null,
        items: $$('.renglon', el).map((fila) => ({
          variant_id: Number($('.r-variante', fila).value),
          cantidad: Number($('.r-cantidad', fila).value),
          costo_unit: Number($('.r-costo', fila).value),
        })),
      });
      // Dejar el formulario listo para otra compra
      $('#renglones', el).innerHTML = '';
      agregarRenglon();
      $('#notas', el).value = '';
      toast('ok', 'Compra registrada: el stock aumentó y se registró el gasto');
      await cargarHistorial();
    } catch (error) {
      toast('err', error.message);
    }
  };

  // --- Carga inicial ---
  agregarRenglon();
  await cargarHistorial();
};
