/** "Tacos Don Pepe" → "tacos-don-pepe" (quita acentos y símbolos). */
const slugify = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

module.exports = { slugify };
