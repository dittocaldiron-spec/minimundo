// src/recipes.js
// -----------------------------------------
// Receitas (crafting) + utilitários puros
// Mantém as receitas clássicas do projeto.
// -----------------------------------------

export const recipes = [
  // stick: 1 madeira => 2 gravetos
  { out: { id: "stick", qty: 2 }, in: { wood: 1 } },

  // ferramentas
  { out: { id: "axe", qty: 1 },     in: { wood: 3, rockshard: 1 } },
  { out: { id: "pickaxe", qty: 1 }, in: { wood: 2, rockshard: 3 } },
  { out: { id: "sword", qty: 1 },   in: { wood: 1, rockshard: 4 } },

  // decor/funcionais
  { out: { id: "campfire", qty: 1 }, in: { wood: 4, coal: 1 } },
  { out: { id: "chest",    qty: 1 }, in: { wood: 8 } },
];

/**
 * Verifica se `cIn` (objeto {id: qtd}) supre uma receita `rc`.
 * Ex.: cIn = { wood: 3, rockshard: 1 }
 */
export function canCraftWith(cIn, rc) {
  if (!rc || !rc.in) return false;
  return Object.entries(rc.in).every(([id, need]) => (cIn[id] || 0) >= need);
}

/**
 * Retorna a lista de receitas craftáveis com os insumos atuais.
 */
export function possibleRecipes(cIn, list = recipes) {
  return list.filter((rc) => canCraftWith(cIn, rc));
}

/**
 * Consome os insumos de `cIn` de acordo com a receita `rc`
 * e retorna o item de saída. Mutates `cIn`.
 *
 * @returns { out: {id, qty} } ou null se não puder
 */
export function applyCraft(cIn, rc) {
  if (!canCraftWith(cIn, rc)) return null;

  // consome insumos
  for (const [id, need] of Object.entries(rc.in)) {
    cIn[id] = (cIn[id] || 0) - need;
    if (cIn[id] <= 0) delete cIn[id];
  }

  // retorna saída
  return { out: { id: rc.out.id, qty: rc.out.qty } };
}

/**
 * Formata a lista de insumos para exibir na UI.
 * Se você tiver um dicionário `items`, pode passar para mostrar nomes.
 */
export function formatNeedList(rc, itemsDict) {
  if (!rc || !rc.in) return "";
  return Object.entries(rc.in)
    .map(([id, qty]) => {
      const n = itemsDict?.[id]?.name || id;
      return `${n} x${qty}`;
    })
    .join(" + ");
}
