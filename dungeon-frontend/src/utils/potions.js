export const POTION_CATALOG = [
  {
    id: 'minor_potion',
    name: 'Minor Potion',
    icon: '🧪',
    healAmount: 25,
    cost: 10,
    rarity: 'Common'
  },
  {
    id: 'greater_potion',
    name: 'Greater Potion',
    icon: '🧪✨',
    healAmount: 50,
    cost: 20,
    rarity: 'Rare'
  },
  {
    id: 'full_elixir',
    name: 'Full Elixir',
    icon: '🧪🔥',
    healAmount: 100,
    cost: 35,
    rarity: 'Legendary'
  }
];

export const DEFAULT_POTIONS = {
  minor_potion: 0,
  greater_potion: 0,
  full_elixir: 0
};