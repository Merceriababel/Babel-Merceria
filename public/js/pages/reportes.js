/**
 * Reportes (solo admin): ganancias y pérdidas, comparativa mensual y productos más vendidos.
 *
 * Ruta: #/reportes
 * API:  GET /reports/profit, GET /reports/monthly, GET /reports/top
 *
 * Los gráficos se dibujan solo con HTML/CSS (sin librerías):
 *   - Barras verticales (comparativa mensual) y horizontales (ranking): divs con alto/ancho en %.
 *   - Torta: un degradado cónico (conic-gradient) calculado con los porcentajes de cada producto.
 */
pages.reportes = async (el) => {
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  // Colores de las porciones de la torta (paleta terracota)
  const COLORES = ['#B4432C', '#D9826B', '#8E3322', '#E8B4A4', '#5C453D',
                   '#C99A8B', '#7A625A', '#F0CFC3', '#A0583F', '#3B2A25'];

  let periodo = 'mes';  // 'dia' | 'mes' | 'anio'

  // --- Estructura base ---
  el.innerHTML = `
    ${titleBar('Reportes', 'Ganancias, pérdidas y productos más vendidos')}

    <!-- Ganancias y pérdidas del período elegido -->
    <div class="card" style="margin-bottom:16px">
      <div class="row tight" style="align-items:center">
        <button class="btn" data-periodo="dia">Diario</button>
        <button class="btn alt" data-periodo="mes">Mensual</button>
        <button class="btn alt" data-periodo="anio">Anual</button>
        <input id="fecha" aria-label="Fecha" type="date" class="input" style="width:auto"
               value="${today()}" max="${today()}">
      </div>
      <div id="ganancias" class="row" style="margin:0"></div>
    </div>

    <!-- Comparativa mes a mes -->
    <div class="card" style="margin-bottom:16px">
      <h2 id="titulo-mensual"></h2>
      <div id="mensual"></div>
    </div>

    <!-- Top 10 más vendidos -->
    <div class="card">
      <div class="row tight" style="justify-content:space-between;align-items:center">
        <h2 style="margin:0">Top 10 productos más vendidos</h2>
        <select id="dias" class="input" aria-label="Período" style="width:auto">
          <option value="15">Últimos 15 días</option>
          <option value="30" selected>Último mes</option>
          <option value="90">Últimos 3 meses</option>
          <option value="365">Año</option>
        </select>
      </div>
      <div id="top"></div>
    </div>`;

  const fechaElegida = () => $('#fecha', el).value || today();

  /* -------------------------------------------------------------------------
   * 1. Ganancias y pérdidas
   * ----------------------------------------------------------------------- */
  const cargarGanancias = async () => {
    const d = await get('/reports/profit', { periodo, fecha: fechaElegida() });
    $('#ganancias', el).innerHTML = `
      ${stat('Total vendido', money(d.ventas))}
      ${stat('Total comprado', money(d.compras))}
      ${stat('Ganancia', money(d.ganancia), 'venta - costo')}
      ${stat('Pérdidas', money(d.perdidas), 'roturas, pérdidas, ajustes')}
      ${stat('Ganancia neta', money(d.neta), 'ganancia - pérdidas')}`;
  };

  /* -------------------------------------------------------------------------
   * 2. Comparativa mensual (barras verticales: ventas, compras, ganancia)
   * ----------------------------------------------------------------------- */
  const cargarMensual = async () => {
    const anio = fechaElegida().slice(0, 4);
    $('#titulo-mensual', el).textContent = `Comparativa mensual ${anio}`;
    const meses = await get('/reports/monthly', { year: anio });

    // El mayor valor del año define el 100 % de altura
    const maximo = Math.max(...meses.flatMap((m) => [m.ventas, m.compras, m.ganancia]), 1);
    const alto = (valor) => `${Math.max((valor / maximo) * 100, valor > 0 ? 2 : 0)}%`;

    $('#mensual', el).innerHTML = `
      <div class="chart">
        ${meses.map((m) => `
          <div class="grp">
            <div class="bars" style="width:100%;justify-content:center">
              <div class="bar" style="height:${alto(m.ventas)};background:#B4432C" title="Ventas ${money(m.ventas)}"></div>
              <div class="bar" style="height:${alto(m.compras)};background:#E8B4A4" title="Compras ${money(m.compras)}"></div>
              <div class="bar" style="height:${alto(m.ganancia)};background:#5C453D" title="Ganancia ${money(m.ganancia)}"></div>
            </div>
            <div class="m">${MESES[m.mes - 1]}</div>
          </div>`).join('')}
      </div>
      <div class="legend">
        <span>${swatch('#B4432C')}Ventas</span>
        <span>${swatch('#E8B4A4')}Compras</span>
        <span>${swatch('#5C453D')}Ganancia</span>
      </div>`;
  };

  /* -------------------------------------------------------------------------
   * 3. Top 10 productos (tabla + barras horizontales + torta)
   * ----------------------------------------------------------------------- */
  const cargarTop = async () => {
    const top = await get('/reports/top', { dias: $('#dias', el).value });
    if (!top.length) {
      $('#top', el).innerHTML = '<p class="muted">Todavía no hay ventas en este período.</p>';
      return;
    }

    const maxIngreso = Math.max(...top.map((x) => x.ingreso), 1);
    const sumaIngresos = top.reduce((suma, x) => suma + x.ingreso, 0);

    // Torta: cada producto ocupa un tramo del círculo proporcional a su ingreso.
    // conic-gradient( color inicio% fin%, color inicio% fin%, ... )
    let acumulado = 0;
    const tramos = top.map((x, i) => {
      const inicio = acumulado;
      acumulado += (x.ingreso / sumaIngresos) * 100;
      return `${COLORES[i % COLORES.length]} ${inicio}% ${acumulado}%`;
    }).join(',');

    $('#top', el).innerHTML = `
      <div class="scroll">
        <table class="tbl">
          <tr><th>#</th><th>Producto</th><th>Cantidad vendida</th><th>Ingreso generado</th></tr>
          ${top.map((x, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="b">${esc(x.producto)}</td>
              <td>${qty(x.cantidad, x.unidad)}</td>
              <td>${money(x.ingreso)}</td>
            </tr>`).join('')}
        </table>
      </div>

      <div class="row top sep">
        <div class="grow2">
          <h3>Barras</h3>
          ${top.map((x) => `
            <div class="hbar">
              <span class="n">${esc(x.producto)}</span>
              <div class="t"><div class="f" style="width:${(x.ingreso / maxIngreso) * 100}%"></div></div>
            </div>`).join('')}
        </div>
        <div class="grow2">
          <h3>Torta</h3>
          <div class="pie" style="background:conic-gradient(${tramos})" role="img"
               aria-label="Participación de cada producto en los ingresos"></div>
          <div class="legend">
            ${top.map((x, i) => `<span>${swatch(COLORES[i % COLORES.length])}${esc(x.producto)}</span>`).join('')}
          </div>
        </div>
      </div>`;
  };

  /** Recarga las tres secciones (se usa al cambiar la fecha). */
  const cargarTodo = () =>
    Promise.all([cargarGanancias(), cargarMensual(), cargarTop()]).catch((e) => toast('err', e.message));

  // --- Eventos ---

  // Cambiar entre diario / mensual / anual (resalta el botón elegido)
  el.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-periodo]');
    if (!boton) return;
    periodo = boton.dataset.periodo;
    $$('[data-periodo]', el).forEach((b) => b.classList.toggle('alt', b !== boton));
    cargarGanancias().catch((error) => toast('err', error.message));
  });

  $('#fecha', el).onchange = cargarTodo;
  $('#dias', el).onchange = () => cargarTop().catch((e) => toast('err', e.message));

  await cargarTodo();
};
