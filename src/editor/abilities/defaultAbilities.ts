import type { AbilityDefinition } from './types';

export const DEFAULT_ABILITIES: AbilityDefinition[] = [
  {
    id: 'fire',
    name: 'Огонь',
    description: 'Наносит огненный урон врагам в области огненной стены.',
    effects: [{
      type: 'damage',
      amount: 55,
      damageSourceId: 'fire',
      criticalChancePercent: 0,
      criticalMultiplier: 1.5,
      target: { type: 'area-enemies', areaHeightPercent: 50 },
    }],
    visualEffect: 'fire',
    color: '#e9573f',
  },
  {
    id: 'ice',
    name: 'Лёд',
    description: 'Замедляет всех врагов на поле.',
    effects: [{
      type: 'slow',
      slowPercent: 82,
      duration: 4,
      target: { type: 'all-enemies' },
    }],
    visualEffect: 'ice',
    color: '#4ba3ff',
  },
  {
    id: 'lightning',
    name: 'Молния',
    description: 'Наносит урон нескольким случайным врагам.',
    effects: [{
      type: 'damage',
      amount: 80,
      damageSourceId: 'lightning',
      criticalChancePercent: 0,
      criticalMultiplier: 1.5,
      target: { type: 'random-enemies', count: 3 },
    }],
    visualEffect: 'lightning',
    color: '#f7c948',
  },
  {
    id: 'shield',
    name: 'Лечение',
    description: 'Восстанавливает здоровье замка.',
    effects: [{
      type: 'heal',
      amount: 22,
      target: { type: 'castle' },
    }],
    visualEffect: 'heal',
    color: '#58c985',
  },
];
