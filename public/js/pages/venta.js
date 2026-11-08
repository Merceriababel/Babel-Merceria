/**
 * Nueva venta: buscador de productos + carrito + cobro.
 *
 * Ruta: #/venta    ·    API: GET /products, POST /sales
 *
 * Flujo: buscar → "Agregar" una variante (color) al carrito → ajustar cantidades →
 * elegir método de pago → "Confirmar venta" (descuenta stock) o "Guardar como pendiente".
 */
pages.venta = async (el) => {
  // --- Estado de la pantalla ---
  let carrito = [];          // [{variant_id, nombre, color, unidad, precio, cantidad}]
  let productos = [];        // resultado de la última búsqueda
  let metodo = 'efectivo';   // método de pago elegido

  const METODOS = [
    ['efectivo', 'Efectivo'],
    ['tarjeta', 'Tarjeta'],
    ['transferencia', 'Transferencia'],
  ];

  // --- Estructura base (las zonas dinámicas se rellenan con las funciones de abajo) ---
  el.innerHTML = `
    ${titleBar('Nueva venta', 'Buscá, elegí el color y cobrá')}
    <div class="row top">
      <div class="card grow3">
        <label class="label" for="q">Buscar por nombre, código, categoría o color</label>
        <input id="q" class="input" placeholder="ej: cinta raso" autocomplete="off">
        <div id="resultados" class="sep"></div>
      </div>

      <div class="card grow2">
        <h2>Venta actual</h2>
        <div id="carrito"></div>
        <div class="total">Total <span id="total"></span></div>

        <label class="label">Método de pago</label>
        <div id="metodos" class="row tight"></div>

        <div class="stack">
          <input id="nro" class="input" placeholder="Nº de operación (opcional)">
          <input id="obs" class="input" placeholder="Observaciones (opcional)">
          <button class="btn block" id="confirmar">Confirmar venta</button>
          <button class="btn alt block" id="pendiente">Guardar como pendiente</button>
        </div>
      </div>
    </div>`;

  // --- Cálculos ---
  const calcularTotal = () =>
    carrito.reduce((suma, item) => suma + item.precio * (Number(item.cantidad) || 0), 0);

  // --- Dibujo de cada zona ---

  /** Total y estado de los botones (se deshabilitan si el carrito está vacío). */
  const dibujarTotal = () => {
    $('#total', el).textContent = money(calcularTotal());
    $('#confirmar', el).disabled = !carrito.length || calcularTotal() <= 0;
    $('#pendiente', el).disabled = !carrito.length;
  };

  /** Botones de método de pago (el elegido se ve resaltado). */
  const dibujarMetodos = () => {
    $('#metodos', el).innerHTML = METODOS.map(([clave, texto]) =>
      `<button class="btn ${metodo === clave ? '' : 'alt'}" data-metodo="${clave}">${texto}</button>`
    ).join('');
  };

  /** Renglones del carrito con campo de cantidad y botón para quitar. */
  const dibujarCarrito = () => {
    $('#carrito', el).innerHTML = carrito.length
      ? `<table class="tbl">
           <tr><th>Ítem</th><th>Cant.</th><th>Total</th><th></th></tr>
           ${carrito.map((item, i) => `
             <tr>
               <td>${esc(item.nombre)} · ${esc(item.color)}<br><small>${money(item.precio)} / ${item.unidad}</small></td>
               <td>
                 <input aria-label="Cantidad" class="input" style="width:84px;min-height:40px"
                        type="number" min="0" step="0.01" value="${item.cantidad}" data-indice="${i}">
               </td>
               <td id="subtotal${i}">${money(item.precio * item.cantidad)}</td>
               <td>
                 <button class="btn alt" style="min-height:36px;padding:0 10px"
                         aria-label="Quitar" data-quitar="${i}">✕</button>
               </td>
             </tr>`).join('')}
         </table>`
      : '<p class="muted">Agregá productos desde la búsqueda.</p>';
    dibujarTotal();
  };

  /** Resultados de la búsqueda: cada producto con una fila por color. */
  const dibujarResultados = () => {
    $('#resultados', el).innerHTML = productos.length
      ? productos.map((p) => `
          <div class="prod">
            <h3>${esc(p.nombre)} <small>· ${esc(p.codigo)} · ${money(p.precio_venta)} / ${p.unidad}</small></h3>
            <table class="tbl">
              ${p.variants.map((v) => `
                <tr>
                  <td>${swatch(v.codigo_color)}${esc(v.color)}</td>
                  <td>${qty(v.stock_actual, p.unidad)}</td>
                  <td>${pill(v.estado)}</td>
                  <td class="r">
                    <button class="btn alt" data-agregar="${v.id}" ${v.stock_actual <= 0 ? 'disabled' : ''}>Agregar</button>
                  </td>
                </tr>`).join('')}
            </table>
          </div>`).join('')
      : '<p class="muted">Sin resultados.</p>';
  };

  // --- Acciones ---

  /** Pide los productos al servidor según el texto buscado. */
  const buscar = async () => {
    productos = await get('/products', { q: $('#q', el).value, activos: true, limit: 30 });
    dibujarResultados();
  };

  /** Registra la venta en el servidor. `estado` es 'aprobada' o 'pendiente'. */
  const confirmar = async (estado) => {
    try {
      await post('/sales', {
        metodo_pago: metodo,
        estado,
        nro_operacion: $('#nro', el).value || null,
        observaciones: $('#obs', el).value || null,
        items: carrito.map((x) => ({ variant_id: x.variant_id, cantidad: Number(x.cantidad) })),
      });
      // Limpiar para la próxima venta
      carrito = [];
      $('#nro', el).value = '';
      $('#obs', el).value = '';
      dibujarCarrito();
      toast('ok', estado === 'aprobada' ? 'Venta registrada' : 'Venta guardada como pendiente');
      buscar();  // refrescar los stocks mostrados
    } catch (error) {
      toast('err', error.message);
    }
  };

  // --- Eventos ---

  // Buscar mientras se escribe (con una pequeña espera para no saturar al servidor)
  $('#q', el).addEventListener('input', debounce(() => buscar().catch((e) => toast('err', e.message))));

  // "Agregar": suma la variante al carrito (si ya está, aumenta la cantidad en 1)
  $('#resultados', el).addEventListener('click', (e) => {
    const boton = e.target.closest('[data-agregar]');
    if (!boton) return;
    const id = Number(boton.dataset.agregar);

    for (const p of productos) {
      const variante = p.variants.find((v) => v.id === id);
      if (!variante) continue;

      const existente = carrito.find((c) => c.variant_id === id);
      if (existente) {
        existente.cantidad = Number(existente.cantidad) + 1;
      } else {
        carrito.push({
          variant_id: id, nombre: p.nombre, color: variante.color,
          unidad: p.unidad, precio: p.precio_venta, cantidad: 1,
        });
      }
      dibujarCarrito();
    }
  });

  // Cambiar una cantidad: actualiza solo ese subtotal y el total (sin redibujar, para no perder el cursor)
  $('#carrito', el).addEventListener('input', (e) => {
    const indice = e.target.dataset.indice;
    if (indice === undefined) return;
    carrito[indice].cantidad = e.target.value;
    $('#subtotal' + indice, el).textContent = money(carrito[indice].precio * (Number(e.target.value) || 0));
    dibujarTotal();
  });

  // Quitar un renglón del carrito
  $('#carrito', el).addEventListener('click', (e) => {
    const boton = e.target.closest('[data-quitar]');
    if (!boton) return;
    carrito.splice(Number(boton.dataset.quitar), 1);
    dibujarCarrito();
  });

  // Elegir método de pago
  $('#metodos', el).addEventListener('click', (e) => {
    const boton = e.target.closest('[data-metodo]');
    if (!boton) return;
    metodo = boton.dataset.metodo;
    dibujarMetodos();
  });

  $('#confirmar', el).onclick = () => confirmar('aprobada');
  $('#pendiente', el).onclick = () => confirmar('pendiente');

  // --- Carga inicial ---
  dibujarMetodos();
  dibujarCarrito();
  await buscar();
};
