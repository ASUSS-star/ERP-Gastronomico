/**
 * Tickets en comandos ESC/POS (texto plano de la propia impresora).
 * Se usan con la impresión directa por USB: no dependen del driver de Windows,
 * imprimen al instante y permiten cortar papel y abrir el cajón de dinero.
 *
 * 58 mm → 32 caracteres por línea (fuente A). 80 mm → 48.
 * Acentos: página de códigos CP850 (ESC t 2), la más soportada por impresoras genéricas.
 */
const ESC = 0x1b;
const GS = 0x1d;

// Caracteres fuera de ASCII → byte en CP850
const CP850 = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, ü: 0x81, Ü: 0x9a,
  Á: 0xb5, É: 0x90, Í: 0xd6, Ó: 0xe0, Ú: 0xe9, '¿': 0xa8, '¡': 0xad, '°': 0xf8,
};
const SIN_ACENTO = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', ñ: 'n', Ñ: 'N', ü: 'u', Ü: 'U', '¿': '', '¡': '' };

export class Ticket {
  constructor({ papel = 58, acentos = true } = {}) {
    this.ancho = Number(papel) === 80 ? 48 : 32;
    this.acentos = acentos;
    this.bytes = [ESC, 0x40, ESC, 0x74, 0x02]; // inicializar + CP850
  }

  raw(...b) { this.bytes.push(...b); return this; }

  texto(s) {
    for (const ch of String(s ?? '')) {
      const c = ch.codePointAt(0);
      if (c < 0x80) this.bytes.push(c);
      else if (this.acentos && CP850[ch]) this.bytes.push(CP850[ch]);
      else {
        const plano = SIN_ACENTO[ch] ?? (ch.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?'));
        for (const p of plano) this.bytes.push(p.charCodeAt(0));
      }
    }
    return this;
  }

  linea(s = '') { return this.texto(s).raw(0x0a); }
  centro(on = true) { return this.raw(ESC, 0x61, on ? 1 : 0); }
  negrita(on = true) { return this.raw(ESC, 0x45, on ? 1 : 0); }
  grande(on = true) { return this.raw(GS, 0x21, on ? 0x11 : 0x00); }
  separador() { return this.linea('-'.repeat(this.ancho)); }
  avanzar(n = 1) { return this.raw(ESC, 0x64, Math.min(n, 255)); }

  /** Texto partido en varias líneas sin cortar palabras. */
  parrafo(s, ancho = this.ancho) {
    const palabras = String(s ?? '').split(/\s+/).filter(Boolean);
    let actual = '';
    for (const p of palabras) {
      if ((actual ? `${actual} ${p}` : p).length > ancho && actual) { this.linea(actual); actual = p; } else actual = actual ? `${actual} ${p}` : p;
    }
    if (actual) this.linea(actual);
    return this;
  }

  /** Izquierda … derecha en la misma línea; si no cabe, la izquierda se parte en renglones. */
  fila(izq, der = '') {
    const d = String(der);
    const espacio = this.ancho - d.length - 1;
    const i = String(izq ?? '');
    if (i.length <= espacio) return this.linea(i + ' '.repeat(this.ancho - i.length - d.length) + d);
    const partes = [];
    let resto = i;
    while (resto.length > espacio) {
      let corte = resto.lastIndexOf(' ', espacio);
      if (corte <= 0) corte = espacio;
      partes.push(resto.slice(0, corte));
      resto = resto.slice(corte).trimStart();
    }
    partes.forEach((p) => this.linea(p));
    return this.linea(resto + ' '.repeat(Math.max(1, this.ancho - resto.length - d.length)) + d);
  }

  cortar() { return this.avanzar(4).raw(GS, 0x56, 0x42, 0x00); }
  /** Pulso al cajón conectado al RJ11 de la impresora (pin 2). */
  abrirCajon() { return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa); }

  fin({ cortar = false, cajon = false } = {}) {
    if (cajon) this.abrirCajon();
    return cortar ? this.cortar() : this.avanzar(5);
  }

  toUint8Array() { return Uint8Array.from(this.bytes); }
}
