import type { DamageSource } from './types';

export const DEFAULT_DAMAGE_SOURCES: DamageSource[] = [
  {
    id: 'fire',
    name: 'Огонь',
    description: 'Огненный источник урона.',
    icon: '🔥',
    color: '#e9573f',
  },
  {
    id: 'ice',
    name: 'Лёд',
    description: 'Ледяной источник урона.',
    icon: '❄️',
    color: '#4ba3ff',
  },
  {
    id: 'lightning',
    name: 'Молния',
    description: 'Электрический источник урона.',
    icon: '⚡',
    color: '#f7c948',
  },
];
