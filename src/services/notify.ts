/** Avisos de fin de etapa: notificación del sistema (si se permite) y un tono suave. */
export async function pedirPermisoNotificaciones() {
  try {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  } catch {
    /* sin soporte */
  }
}

export function avisar(titulo: string, cuerpo: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(titulo, { body: cuerpo, silent: true });
  } catch {
    /* sin soporte */
  }
  tono();
}

let ctx: AudioContext | undefined;
export function tono() {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime;
    [660, 880].forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t0 + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.4);
      o.connect(g).connect(ctx!.destination);
      o.start(t0 + i * 0.22);
      o.stop(t0 + i * 0.22 + 0.45);
    });
  } catch {
    /* sin audio */
  }
}
