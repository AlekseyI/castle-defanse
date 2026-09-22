import type { AbilityDefinition } from './types';

export const DEFAULT_ABILITIES: AbilityDefinition[] = [
  {
    id: 'fire',
    name: 'Огонь',
    description: 'Наносит огненный урон врагам в области огненной стены.',
    effects: [{ type: 'damage', amount: 55, damageSourceId: 'fire' }],
    color: '#e9573f',
    target: { type: 'area-enemies', areaHeightPercent: 50 },
  },
  {
    id: 'ice',
    name: 'Лёд',
    description: 'Замедляет всех врагов на поле.',
    effects: [{ type: 'slow', slowPercent: 82, duration: 4 }],
    color: '#4ba3ff',
    target: { type: 'all-enemies' },
  },
  {
    id: 'lightning',
    name: 'Молния',
    description: 'Наносит урон нескольким случайным врагам.',
    effects: [{ type: 'damage', amount: 80, damageSourceId: 'lightning' }],
    color: '#f7c948',
    target: { type: 'random-enemies', count: 3 },
  },
  {
    id: 'shield',
    name: 'Лечение',
    description: 'Восстанавливает здоровье замка.',
    effects: [{ type: 'heal', amount: 22 }],
    color: '#58c985',
    target: { type: 'castle' },
  },
];
