import type { InputHTMLAttributes } from 'react';
import styles from './EditorControls.module.css';

type Props = InputHTMLAttributes<HTMLInputElement>;

export function EditorInput({ className, ...props }: Props) {
  return <input {...props} className={[styles.control, className].filter(Boolean).join(' ')} />;
}
