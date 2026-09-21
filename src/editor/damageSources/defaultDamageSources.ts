import type { DamageSource } from './types';

export const DEFAULT_DAMAGE_SOURCES: DamageSource[] = [
  {
    id: 'fire',
    name: 'Огонь',
    description: 'Огненный источник урона.',
    color: '#e9573f',
  },
  {
    id: 'ice',
    name: 'Лёд',
    description: 'Ледяной источник урона.',
    color: '#4ba3ff',
  },
  {
    id: 'lightning',
    name: 'Молния',
    description: 'Электрический источник урона.',
    color: '#f7c948',
  },
];
