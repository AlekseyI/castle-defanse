import type { InputHTMLAttributes } from 'react';
import styles from './EditorControls.module.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function EditorCheckbox({ className, ...props }: Props) {
  return <input {...props} type="checkbox" className={[styles.checkbox, className].filter(Boolean).join(' ')} />;
}
