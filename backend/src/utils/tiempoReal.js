/**
 * Tiempo real con Supabase Realtime (Broadcast por REST).
 *
 * El backend no guarda conexiones abiertas (en Vercel cada petición es una función
 * de corta duración): después de cada cambio envía un aviso al canal del restaurante
 * y Supabase lo reparte por WebSocket a las pantallas conectadas, que recargan sus datos.
 *
 * El aviso no lleva datos sensibles (sólo qué cambió) y el nombre del canal se deriva
 * con HMAC de JWT_SECRET, así que no se puede adivinar el de otro restaurante.
 */
const crypto = require('crypto');
const env = require('../config/env');

const canalDe = (restauranteId) =>
  `erp-${restauranteId}-${crypto.createHmac('sha256', env.jwt.secret).update(`canal:${restauranteId}`).digest('hex').slice(0, 24)}`;

const configurado = () => Boolean(env.realtime.url && env.realtime.key);

/** Envía el aviso. Nunca lanza: si Supabase falla, la operación del usuario ya se guardó. */
const notificar = async (restauranteId, payload) => {
  if (!configurado() || env.isTest) return;
  try {
    const res = await fetch(`${env.realtime.url.replace(/\/+$/, '')}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: env.realtime.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: canalDe(restauranteId), event: 'cambio', payload }] }),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) console.warn(`[tiempo real] Supabase respondió ${res.status}`);
  } catch (e) {
    console.warn(`[tiempo real] no se pudo enviar el aviso: ${e.message}`);
  }
};

module.exports = { canalDe, notificar, configurado };
