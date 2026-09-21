export interface DamageSourceIcon {
  name: string;
  src: string;
}

export interface DamageSource {
  id: string;
  name: string;
  description?: string;
  icon?: DamageSourceIcon;
  color?: string;
}
