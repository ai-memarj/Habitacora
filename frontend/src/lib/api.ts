import axios from "axios";

/**
 * Cliente HTTP único hacia la API de FastAPI. La URL base viene de una
 * variable de entorno pública (NEXT_PUBLIC_*, visible en el bundle de
 * cliente) para poder apuntar a localhost en desarrollo y al dominio real
 * una vez desplegado, sin tocar código.
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

/** Fetcher que SWR usa por defecto para las claves de tipo string (rutas de la API). */
export const fetcher = (url: string) => api.get(url).then((res) => res.data);
