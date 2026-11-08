/**
 * Ventas del día: resumen por método de pago y detalle de cada venta.
 *
 * Ruta: #/ventas    ·    API: GET /sales?fecha=, POST /sales/{id}/approve, POST /sales/{id}/cancel
 *
 * Cualquier usuario puede aprobar una venta pendiente; solo el admin puede cancelar.
 */
pages.ventas = async (el) => {
  // Selector de fecha en el encabezado (por defecto hoy; no permite fechas futuras)
  const selectorFecha = `
    <input id="fecha" aria-label="Fecha" type="date" class="input" style="width:auto"
           value="${today()}" max="${today()}">`;

  el.innerHTML = `
    ${titleBar('Ventas del día', 'Todo lo vendido en la fecha elegida', selectorFecha)}
    <div id="contenido"></div>`;

  /** Botones de acción de una venta según su estado y el rol del usuario. */
  const botonesDeVenta = (venta) => {
    const aprobar = venta.estado === 'pendiente'
      ? `<button class="btn alt" data-accion="approve" data-id="${venta.id}">Aprobar</button> `
      : '';
    const cancelar = isAdmin() && venta.estado !== 'cancelada'
      ? `<button class="btn alt" data-accion="cancel" data-id="${venta.id}">Cancelar</button>`
      : '';
    return aprobar + cancelar;
  };

  /** Una fila de la tabla por venta. */
  const filaDeVenta = (venta) => `
    <tr>
      <td>${venta.hora.slice(11, 16)}</td>
      <td>
        ${venta.items.map((i) => `<div>${esc(i.producto)} · ${esc(i.color)}</div>`).join('')}
        ${venta.observaciones ? `<small>${esc(venta.observaciones)}</small>` : ''}
      </td>
      <td>${venta.items.map((i) => `<div>${qty(i.cantidad, i.unidad)}</div>`).join('')}</td>
      <td style="text-transform:capitalize">
        ${esc(venta.metodo_pago)}
        ${venta.nro_operacion ? `<br><small>#${esc(venta.nro_operacion)}</small>` : ''}
      </td>
      <td>${pill(venta.estado)}</td>
      <td class="b">${money(venta.total)}</td>
      <td style="white-space:nowrap">${botonesDeVenta(venta)}</td>
    </tr>`;

  /** Pide las ventas de la fecha elegida y dibuja resumen + tabla. */
  const cargar = async () => {
    const datos = await get('/sales', { fecha: $('#fecha', el).value });

    $('#contenido', el).innerHTML = `
      <div class="row">
        ${stat('Cantidad de ventas', datos.cantidad)}
        ${stat('Facturación total', money(datos.total))}
        ${stat('Efectivo', money(datos.por_metodo.efectivo))}
        ${stat('Tarjeta', money(datos.por_metodo.tarjeta))}
        ${stat('Transferencia', money(datos.por_metodo.transferencia))}
      </div>
      <div class="card scroll">
        <table class="tbl">
          <tr>
            <th>Hora</th><th>Producto</th><th>Cantidad</th><th>Método</th>
            <th>Estado</th><th>Total</th><th></th>
          </tr>
          ${datos.ventas.map(filaDeVenta).join('')
            || '<tr><td colspan="7" class="muted">No hay ventas en esta fecha.</td></tr>'}
        </table>
      </div>`;
  };

  // Cambiar de fecha recarga la lista
  $('#fecha', el).onchange = () => cargar().catch((e) => toast('err', e.message));

  // Aprobar / cancelar una venta (un solo listener para todos los botones)
  $('#contenido', el).addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;

    const accion = boton.dataset.accion;
    if (accion === 'cancel' && !confirm('¿Cancelar esta venta? El stock vuelve a su lugar.')) return;

    try {
      await post(`/sales/${boton.dataset.id}/${accion}`);
      await cargar();
    } catch (error) {
      toast('err', error.message);
    }
  });

  await cargar();
};
