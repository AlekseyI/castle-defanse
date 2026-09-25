import type { InputHTMLAttributes } from 'react';
import styles from './EditorControls.module.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function EditorColorInput({ className, ...props }: Props) {
  return <input {...props} type="color" className={[styles.control, styles.colorInput, className].filter(Boolean).join(' ')} />;
}
