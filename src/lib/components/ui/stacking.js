// Floating windows share one stacking order: the last one used is on top.
// Capped below the top-bar menus (z 9000) so their dropdowns always win.
let top = 40;
export const nextZ = () => (top = Math.min(top + 1, 8000));
