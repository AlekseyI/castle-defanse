import { EditorCheckbox } from './EditorCheckbox';
import styles from './EditorControls.module.css';

export interface EditorMultiSelectOption<T extends string> {
  value: T;
  label: string;
}

interface EditorMultiSelectProps<T extends string> {
  value: readonly T[];
  options: readonly EditorMultiSelectOption<T>[];
  onChange: (value: T[]) => void;
  placeholder?: string;
  invalid?: boolean;
}

export function EditorMultiSelect<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Не выбрано',
  invalid = false,
}: EditorMultiSelectProps<T>) {
  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);

  return (
    <details className={styles.multiSelect} aria-invalid={invalid || undefined}>
      <summary>{selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}</summary>
      <div className={styles.multiSelectMenu}>
        {options.map((option) => {
          const checked = value.includes(option.value);
          return (
            <label key={option.value} className={styles.multiSelectOption}>
              <EditorCheckbox
                checked={checked}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...value, option.value]
                    : value.filter((selectedValue) => selectedValue !== option.value);
                  onChange(next);
                }}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}
