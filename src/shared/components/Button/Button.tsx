import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  const variantClass = styles[variant] ?? '';
  const sizeClass = styles[size] ?? '';
  const combined = [styles.btn, variantClass, sizeClass, className]
    .filter(Boolean)
    .join(' ');

  return <button className={combined} {...props} />;
}
