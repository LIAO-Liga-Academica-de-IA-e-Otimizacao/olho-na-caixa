import type { ProduceItem } from "./top-layer";

export type SimStill = {
  url: string;
  name: string;
  item: ProduceItem;
};

/** Top stills the simulator already rendered. Val seeds are the ones divisible by 5. */
export function simStills(): SimStill[] {
  const tangerine = seeds("tangerine", 1, 80);
  const tomato = seeds("tomato", 1001, 1040);
  return [
    ...tomato.filter((row) => row.name.startsWith("val/")),
    ...tangerine.filter((row) => row.name.startsWith("val/")),
    ...tomato.filter((row) => row.name.startsWith("train/")),
    ...tangerine.filter((row) => row.name.startsWith("train/")),
  ];
}

function seeds(item: ProduceItem, first: number, last: number): SimStill[] {
  const rows: SimStill[] = [];
  for (let seed = first; seed <= last; seed += 1) rows.push(still(item, seed));
  return rows;
}

function still(item: ProduceItem, seed: number): SimStill {
  const split = seed % 5 === 0 ? "val" : "train";
  const name = `${split}/${item}-s${seed}.png`;
  return { url: `/stills/${name}`, name, item };
}
