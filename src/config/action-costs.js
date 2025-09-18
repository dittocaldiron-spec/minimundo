export const ACTION_COSTS = {
  walk: ['hunger<0.02>'],
  run: ['hunger<0.06>', 'stamina<8>'],
  break: ['hunger<0.08>', 'stamina<2>'],
  craft: ['hunger<0.04>'],
  attack: ['hunger<0.05>', 'stamina<3>'],
  'time:tick': ['hunger<0.01>'],
};
