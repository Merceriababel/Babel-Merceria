/**
 * Configuración del frontend.
 *
 * API_URL es la dirección del backend (FastAPI):
 *   - En Vercel el backend vive en el mismo sitio, bajo /api → no hay que tocar nada.
 *   - En tu compu (localhost) se usa el backend local, que corre en el puerto 8000.
 */
const esLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

window.APP_CONFIG = {
  API_URL: esLocal ? 'http://localhost:8000' : '/api',
};
