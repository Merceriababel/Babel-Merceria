/**
 * Stock: panel de alertas (todos) y registro de ajustes + historial (solo admin).
 *
 * Ruta: #/stock
 * API:  GET /stock/low, GET /stock/movements, POST /stock/adjust
 *
 * Estados: Normal · Bajo (≤ mínimo) · Crítico (sin stock o ≤ 25 % del mínimo).
 */
pages.stock = async (el) => {
  const admin = isAdmin();
  const bajos = await get('/stock/low');

  // --- Panel de alertas (lo ven todos) ---
  const panelAlertas = `
    <div class="card scroll" style="margin-bottom:16px">
      <h2>Panel de alertas</h2>
      ${bajos.length
        ? `<table class="tbl">
             <tr><th>Producto</th><th>Queda</th><th>Mínimo</th><th>Estado</th></tr>
             ${bajos.map((v) => `
               <tr>
                 <td>${esc(v.producto)} · ${esc(v.color)}</td>
                 <td>${qty(v.stock_actual, v.unidad)}</td>
                 <td>${qty(v.stock_minimo, v.unidad)}</td>
                 <td>${pill(v.estado)}</td>
               </tr>`).join('')}
           </table>`
        : '<p class="muted">No hay productos con stock bajo.</p>'}
    </div>`;

  // --- Formulario de ajustes + historial (solo admin) ---
  const seccionAdmin = admin ? `
    <form id="ajuste" class="card stack" style="margin-bottom:16px">
      <h2>Registrar ajuste, pérdida o rotura</h2>
      <div class="grid2">
        <select id="variante" class="input" aria-label="Producto" required></select>
        <select id="tipo" class="input" aria-label="Tipo">
          <option value="ajuste_entrada">Ajuste: entrada</option>
          <option value="ajuste_salida">Ajuste: salida</option>
          <option value="perdida">Pérdida</option>
          <option value="rotura">Rotura</option>
        </select>
        <input id="cantidad" class="input" type="number" min="0.01" step="0.01"
               placeholder="Cantidad" aria-label="Cantidad" required>
        <input id="motivo" class="input" placeholder="Motivo">
      </div>
      <button class="btn">Registrar</button>
    </form>
    <div class="card scroll">
      <h2>Historial de movimientos</h2>
      <div id="movimientos"></div>
    </div>` : '';

  el.innerHTML = `
    ${titleBar('Stock', 'Alertas de stock bajo y movimientos')}
    ${panelAlertas}
    ${seccionAdmin}`;

  if (!admin) return;  // el empleado solo ve las alertas

  /** Dibuja el historial: fecha, usuario, producto, tipo, cantidad (verde entra / rojo sale) y motivo. */
  const cargarMovimientos = async () => {
    const movimientos = await get('/stock/movements');
    $('#movimientos', el).innerHTML = `
      <table class="tbl">
        <tr><th>Fecha</th><th>Usuario</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th></tr>
        ${movimientos.map((m) => `
          <tr>
            <td style="white-space:nowrap">${m.fecha.slice(0, 10)} ${m.fecha.slice(11, 16)}</td>
            <td>${esc(m.usuario)}</td>
            <td>${esc(m.producto)} · ${esc(m.color)}</td>
            <td>${esc(m.tipo.replace('_', ' '))}</td>
            <td class="${m.cantidad < 0 ? 'neg' : 'pos'}">${m.cantidad > 0 ? '+' : ''}${qty(m.cantidad, m.unidad)}</td>
            <td>${esc(m.motivo)}</td>
          </tr>`).join('') || '<tr><td colspan="6" class="muted">Sin movimientos.</td></tr>'}
      </table>`;
  };

  // Opciones del selector de producto/color
  const opciones = await variantOptions();
  $('#variante', el).innerHTML = optionsHTML(opciones, 'Elegí producto y color…');

  // Registrar un ajuste manual
  $('#ajuste', el).onsubmit = async (e) => {
    e.preventDefault();
    try {
      await post('/stock/adjust', {
        variant_id: Number($('#variante', el).value),
        tipo: $('#tipo', el).value,
        cantidad: Number($('#cantidad', el).value),
        motivo: $('#motivo', el).value,
      });
      $('#cantidad', el).value = '';
      $('#motivo', el).value = '';
      toast('ok', 'Movimiento registrado');
      await cargarMovimientos();
    } catch (error) {
      toast('err', error.message);
    }
  };

  await cargarMovimientos();
};
