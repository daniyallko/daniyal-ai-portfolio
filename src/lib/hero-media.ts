export const BUILDING_VIEW_BOX = "0 0 1800 1200" as const;

export type WindowPoint = readonly [number, number];

export type WindowLightGroup = {
  readonly id: string;
  readonly polygons: readonly (readonly WindowPoint[])[];
};

/**
 * Window corners traced on the 1800×1200 source photograph. These are not
 * viewport coordinates: the image and every SVG share one cover-cropped frame.
 * The central tower remains in the narrowest centered mobile crop.
 */
export const WINDOW_LIGHT_GROUPS: readonly WindowLightGroup[] = [
  {
    id: "north",
    polygons: [
      [[812, 380], [819.5, 386.5], [818, 399.5], [810, 392.5]],
      [[826.5, 392.5], [834.5, 399.5], [833.5, 413], [825, 406]],
      [[843, 406.5], [851, 413.5], [850.5, 428], [841.5, 420.5]],
      [[805, 403], [813.5, 410], [812, 424.5], [803, 417]],
      [[821, 417], [830, 424.5], [829, 439.5], [819.5, 432]],
    ],
  },
  {
    id: "middle",
    polygons: [
      [[838.5, 432.5], [847.5, 440.5], [847, 456], [837, 447.5]],
      [[796, 432], [805.5, 440], [803.5, 456.5], [793.5, 447.5]],
      [[813.5, 448.5], [823.5, 457], [822, 474], [811, 465]],
      [[832, 466], [842.5, 475], [841.5, 493], [830, 483]],
      [[786, 466], [797, 475], [794.5, 493.5], [783, 483.5]],
    ],
  },
  {
    id: "south",
    polygons: [
      [[806, 485], [817, 494.5], [815, 514], [803, 503.5]],
      [[826.5, 505.5], [838.5, 515.5], [837, 536], [824, 524.5]],
      [[775, 505.5], [787.5, 516], [784.5, 537.5], [771.5, 525.5]],
      [[797, 528.5], [810, 539.5], [807.5, 562], [793.5, 549.5]],
      [[820, 553.5], [834, 565.5], [832, 589.5], [817, 575.5]],
    ],
  },
] as const;
