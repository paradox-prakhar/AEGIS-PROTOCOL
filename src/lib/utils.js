import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn-style class merger used by Vengeance UI components. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
