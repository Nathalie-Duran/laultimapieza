export const mansionArcadeCatalog = [
  ['archivo', 'El archivo cifrado', 'Descifra dos sellos con el alfabeto de la archivera.', 1],
  ['relojero', 'El relojero de Valdemar', 'Encaja las ruedas de un reloj que ha perdido la hora.', 1],
  ['museo', 'El museo de las sombras', 'Busca tres piezas extraviadas entre las vitrinas.', 1],
  ['cartas', 'Las cartas de Ada', 'Reconstruye una carta rasgada y lee su mensaje secreto.', 2],
  ['jardin', 'El jardín olvidado', 'Devuelve el agua a los bancales de la casa.', 1],
  ['espejo', 'El espejo imposible', 'Encuentra tres objetos que cambian al otro lado del cristal.', 2]
].map(([id,title,description,prize]) => Object.freeze({id,title,description,prize}));
