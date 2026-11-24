import { ErrorApi } from './errores';
import { obtenerToken, olvidarSesion } from '@/composables/useAuth';
import router from '@/router';

const BASE_URL = import.meta.env.VITE_API_URL;
const TIEMPO_MAXIMO_MS = 10_000;

export interface OpcionesApi {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

/**
 * TODO [M1] Cliente HTTP único de la aplicación (8 pts).
 *
 * api<T>(ruta, { method, body, params }) debe:
 *  1. Construir la URL como BASE_URL + ruta y agregar como query string solo los params
 *     que tengan valor (ni undefined ni '').           ej. api('/equipos', { params: { page: 2, q: '' } })
 *  2. Enviar siempre "Accept: application/json".
 *  3. Si hay token (obtenerToken()), enviar "Authorization: Bearer <token>". Nunca en la URL.
 *  4. Si hay body, enviarlo como JSON ("Content-Type: application/json" + JSON.stringify).
 *  5. Cancelar la petición si tarda más de TIEMPO_MAXIMO_MS (AbortController).
 *     Si fetch falla sin respuesta (sin red, tiempo agotado, CORS), lanzar
 *     new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' }).
 *  6. Si la respuesta es 204, devolver null.
 *  7. Si response.ok es false, lanzar new ErrorApi(status, cuerpoJson).
 *     Si el estado es 401 (y la ruta no es /login): await olvidarSesion() y router.replace('/login').
 *  8. En cualquier otro caso, devolver el cuerpo JSON.
 */
function construirUrl(ruta: string, params?: Record<string, string | number | undefined>): string {
  const urlBase = `${(BASE_URL ?? '').replace(/\/+$/, '')}${ruta}`;
  if (!params) return urlBase;

  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== '') {
      query.set(clave, String(valor));
    }
  }

  const queryString = query.toString();
  return queryString ? `${urlBase}?${queryString}` : urlBase;
}

function construirEncabezados(tieneCuerpo: boolean): Record<string, string> {
  const encabezados: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = obtenerToken();
  if (token) {
    encabezados.Authorization = `Bearer ${token}`;
  }

  if (tieneCuerpo) {
    encabezados['Content-Type'] = 'application/json';
  }

  return encabezados;
}

export async function api<T = unknown>(ruta: string, opciones: OpcionesApi = {}): Promise<T> {
  const { method = 'GET', body, params } = opciones;
  const tieneCuerpo = body !== undefined;
  const url = construirUrl(ruta, params);
  const headers = construirEncabezados(tieneCuerpo);

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method,
      headers,
      body: tieneCuerpo ? JSON.stringify(body) : undefined,
      signal: controlador.signal,
    });
  } catch {
    clearTimeout(temporizador);
    throw new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' });
  }

  try {
    if (respuesta.status === 204) {
      return null as T;
    }

    const cuerpo = await respuesta.json().catch(() => {
      if (controlador.signal.aborted) {
        throw new ErrorApi(0, { mensaje: 'No fue posible conectar con la API.' });
      }
      return null;
    });

    if (!respuesta.ok) {
      if (respuesta.status === 401 && ruta !== '/login') {
        await olvidarSesion();
        await router.replace('/login');
      }
      throw new ErrorApi(respuesta.status, cuerpo);
    }

    return cuerpo as T;
  } finally {
    clearTimeout(temporizador);
  }
}
