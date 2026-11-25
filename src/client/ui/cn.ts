/**
 * shadcn 的 `cn`：clsx 合并条件类名，tailwind-merge 消解同族冲突。
 * 来源：https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/lib/utils.ts（MIT）。
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并类名，后写的同族 Tailwind 类覆盖先写的。 */
export function cn(...inputs: readonly ClassValue[]): string {
  return twMerge(clsx(inputs));
}
