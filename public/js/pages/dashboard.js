/**
 * Dashboard: resumen general del negocio.
 *
 * Ruta: #/    ·    API: GET /reports/dashboard, GET /reports/top (solo admin)
 *
 * Todos ven: stock total, ventas del día y productos con poco stock.
 * Solo el administrador ve además: compras, ganancias y pérdidas del mes, y los más vendidos.
 */
pages.dashboard = async (el) => {
  // --- Datos ---
  const datos = await get('/reports/dashboard');
  const masVendidos = isAdmin() ? await get('/reports/top', { dias: 30 }) : [];
  const maxIngreso = Math.max(...masVendidos.map((t) => t.ingreso), 1);  // base para el largo de las barras

  // --- Accesos rápidos (los de admin solo se muestran al admin) ---
  const accesos = `
    <a class="btn" href="#/venta">Nueva venta</a>
    ${isAdmin() ? `
      <a class="btn alt" href="#/productos?nuevo=1">Nuevo producto</a>
      <a class="btn alt" href="#/compras">Nueva compra</a>` : ''}
    <a class="btn alt" href="#/stock">Ver stock bajo</a>`;

  // --- Indicadores ---
  const indicadores = `
    ${stat('Stock total', num(datos.stock_total), 'unidades, m y kg')}
    ${stat('Ventas del día', money(datos.ventas_hoy.total), `${datos.ventas_hoy.cantidad} ventas`)}
    ${stat('Productos con poco stock', datos.bajo_count)}
    ${datos.mes ? `
      ${stat('Compras del mes', money(datos.mes.compras))}
      ${stat('Ganancias del mes', money(datos.mes.ganancia), 'venta - costo')}
      ${stat('Pérdidas del mes', money(datos.mes.perdidas), 'roturas y ajustes')}` : ''}`;

  // --- Tabla de stock bajo ---
  const tablaBajo = datos.bajo.length
    ? `<table class="tbl">
         <tr><th>Producto</th><th>Queda</th><th>Estado</th></tr>
         ${datos.bajo.map((v) => `
           <tr>
             <td>${esc(v.producto)} · ${esc(v.color)}</td>
             <td>${qty(v.stock_actual, v.unidad)}</td>
             <td>${pill(v.estado)}</td>
           </tr>`).join('')}
       </table>`
    : '<p class="muted">Todo en orden 🎉</p>';

  // --- Más vendidos del mes (solo admin) ---
  const barras = masVendidos.slice(0, 5).map((t) => `
    <div class="hbar">
      <span class="n">${esc(t.producto)}</span>
      <div class="t"><div class="f" style="width:${(t.ingreso / maxIngreso) * 100}%"></div></div>
    </div>`).join('');

  const tarjetaMasVendidos = isAdmin() ? `
    <div class="card grow2">
      <h2>Más vendidos del mes</h2>
      ${masVendidos.length ? barras : '<p class="muted">Todavía no hay ventas.</p>'}
    </div>` : '';

  // --- Armado final ---
  el.innerHTML = `
    ${titleBar(`Hola, ${esc(user.nombre)}`, 'Resumen general del negocio', accesos)}
    <div class="row">${indicadores}</div>
    <div class="row">
      <div class="card grow2"><h2>Stock bajo</h2>${tablaBajo}</div>
      ${tarjetaMasVendidos}
    </div>`;
};
