/**
 * Cliente de la API (backend FastAPI).
 *
 * Funciones disponibles en todo el sitio:
 *   get(ruta, parametros)   → GET con parámetros opcionales en la URL
 *   post(ruta, cuerpo)      → POST con JSON
 *   put(ruta, cuerpo)       → PUT con JSON
 *
 * Todas devuelven los datos ya convertidos (JSON) o lanzan un Error con un mensaje
 * legible para mostrar al usuario con toast('err', error.message).
 */
const API = ((window.APP_CONFIG && window.APP_CONFIG.API_URL) || 'http://localhost:8000').replace(/\/$/, '');

/** Pantallas que no requieren sesión (si falla el login ahí, no se cierra la sesión). */
const RUTAS_PUBLICAS = /^#\/(login|recuperar|restablecer)/;

/**
 * Función base: hace el pedido, adjunta el token de sesión y traduce los errores.
 * @param {string} metodo  GET | POST | PUT
 * @param {string} ruta    ej. '/products'
 * @param {object} [cuerpo]    se envía como JSON
 * @param {object} [parametros] se agregan a la URL como ?clave=valor (se omiten vacíos)
 */
async function api(metodo, ruta, cuerpo, parametros) {
  // 1. Armar la URL con los parámetros que tengan valor
  let url = API + ruta;
  if (parametros) {
    const q = new URLSearchParams(Object.entries(parametros).filter(([, v]) => v !== '' && v != null));
    if ([...q].length) url += '?' + q;
  }

  // 2. Encabezados: JSON + token de sesión si existe
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = 'Bearer ' + token;

  // 3. Enviar
  let respuesta;
  try {
    respuesta = await fetch(url, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  } catch (e) {
    throw new Error('No se pudo conectar con el servidor');
  }

  // 4. Leer el JSON (algunas respuestas pueden venir sin cuerpo)
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch (e) {
    /* sin cuerpo: no pasa nada */
  }

  // 5. Manejar errores
  if (!respuesta.ok) {
    // Sesión vencida o inválida: volver al login (salvo que ya estemos en una pantalla pública)
    if (respuesta.status === 401 && !RUTAS_PUBLICAS.test(location.hash)) logout();

    // La API envía el motivo en `detail`: texto simple o lista de errores de validación
    const detalle = datos && datos.detail;
    throw new Error(Array.isArray(detalle) ? detalle.map((x) => x.msg).join('. ') : detalle || 'Error del servidor');
  }
  return datos;
}

const get = (ruta, parametros) => api('GET', ruta, null, parametros);
const post = (ruta, cuerpo) => api('POST', ruta, cuerpo || {});
const put = (ruta, cuerpo) => api('PUT', ruta, cuerpo);
