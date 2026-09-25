import type { InputHTMLAttributes } from 'react';
import styles from './EditorControls.module.css';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  mode?: 'hidden' | 'overlay';
};

export function EditorFileInput({ className, mode = 'hidden', ...props }: Props) {
  const modeClassName = mode === 'overlay' ? styles.fileInputOverlay : styles.fileInputHidden;

  return <input {...props} type="file" className={[modeClassName, className].filter(Boolean).join(' ')} />;
}
