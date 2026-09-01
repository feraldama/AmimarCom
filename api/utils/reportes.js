// Helpers compartidos por los endpoints de reportes.

// Parsea el parámetro de query `cajaIds` (lista de CajaId separada por
// comas, ej: "4,5") y devuelve un array de números válidos. Lista vacía
// significa "todas las cajas" (sin filtro).
const parseCajaIds = (query) => {
  if (!query || !query.cajaIds) return [];
  return String(query.cajaIds)
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => !isNaN(id) && id > 0);
};

module.exports = { parseCajaIds };
