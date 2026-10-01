/**
 * Which account each item uses. The screen still offers only tangerine and tomato.
 *
 * Carrot uses the tomato account: liters times the lot's kilograms per liter.
 * Banana uses hands: visible hands times fingers per hand times hand layers.
 * A new item does not get its own copy of the crate, the arc, or the tolerance.
 * It still needs a mesh, a peel mask, and a height reader when the piece is not round.
 */

export const ACCOUNTS = {
  tangerine: "layers",
  tomato: "liters",
  carrot: "liters",
  banana: "bunches",
} as const;

export type Account = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

export type CatalogItem = keyof typeof ACCOUNTS;

/** Items the conference offers in this phase. */
export const PHASE_ITEMS = ["tangerine", "tomato"] as const;
