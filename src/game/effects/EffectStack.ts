export interface EffectStackEntry<K, T> {
  key: K;
  value: T;
  layer: number;
}

export interface EffectStackReplaceResult<K, T> {
  entry: EffectStackEntry<K, T>;
  replaced?: T;
}

export class EffectStack<K, T> {
  private nextLayer = 0;
  private readonly entries: EffectStackEntry<K, T>[] = [];

  replace(key: K, value: T): EffectStackReplaceResult<K, T> {
    const existingIndex = this.entries.findIndex((entry) => entry.key === key);
    const replaced = existingIndex >= 0 ? this.entries[existingIndex].value : undefined;

    if (existingIndex >= 0) this.entries.splice(existingIndex, 1);

    const entry = { key, value, layer: ++this.nextLayer };
    this.entries.push(entry);
    return { entry, replaced };
  }

  remove(value: T) {
    const index = this.entries.findIndex((entry) => entry.value === value);
    if (index >= 0) this.entries.splice(index, 1);
  }

  get(key: K): T | undefined {
    return this.entries.find((entry) => entry.key === key)?.value;
  }

  values(): T[] {
    return this.entries.map((entry) => entry.value);
  }

  clear() {
    this.entries.length = 0;
    this.nextLayer = 0;
  }
}
