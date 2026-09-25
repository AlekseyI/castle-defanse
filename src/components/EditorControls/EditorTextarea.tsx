import type { TextareaHTMLAttributes } from 'react';
import styles from './EditorControls.module.css';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function EditorTextarea({ className, ...props }: Props) {
  return <textarea {...props} className={[styles.control, styles.textarea, className].filter(Boolean).join(' ')} />;
}
