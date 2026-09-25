import type { SelectHTMLAttributes } from 'react';
import styles from './EditorControls.module.css';

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export function EditorSelect({ className, children, ...props }: Props) {
  return (
    <select {...props} className={[styles.control, className].filter(Boolean).join(' ')}>
      {children}
    </select>
  );
}
