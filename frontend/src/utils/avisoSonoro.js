/**
 * Sonido y notificación del navegador para avisos importantes (comida lista, comanda nueva).
 * Los navegadores sólo permiten sonar después de que el usuario tocó la página una vez.
 */
let ctx;

export function sonar(tipo = 'listo') {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const notas = tipo === 'nuevo' ? [660, 880] : [880, 1175, 1568];
    notas.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gan = ctx.createGain();
      const t = ctx.currentTime + i * 0.18;
      osc.frequency.value = f;
      osc.type = 'sine';
      gan.gain.setValueAtTime(0.0001, t);
      gan.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gan.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gan).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  } catch { /* sin audio disponible */ }
}

export const puedeNotificar = () => 'Notification' in window;
export const permisoNotificaciones = () => (puedeNotificar() ? Notification.permission : 'denied');
export const pedirPermiso = () => (puedeNotificar() ? Notification.requestPermission() : Promise.resolve('denied'));

/** Notificación del sistema (se ve aunque la pestaña esté en segundo plano). */
export function notificar(titulo, cuerpo) {
  if (permisoNotificaciones() !== 'granted') return;
  try {
    new Notification(titulo, { body: cuerpo, icon: '/favicon.svg', tag: `${titulo}-${cuerpo}` });
  } catch { /* algunos móviles sólo permiten notificaciones desde un service worker */ }
}

/** Devuelve los elementos nuevos respecto a la consulta anterior (para avisar sólo una vez). */
export function detectarNuevos(previosRef, lista) {
  const ids = new Set(lista.map((x) => x.id));
  const nuevos = previosRef.current ? lista.filter((x) => !previosRef.current.has(x.id)) : [];
  previosRef.current = ids;
  return nuevos;
}
