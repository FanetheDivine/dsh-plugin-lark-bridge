/**
 * shadcn 的 InputGroup。来源：
 * https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/input-group.tsx（MIT）。
 * 只保留 time picker 用到的四个部分；相对源码改为 forwardRef，以兼容 React 18。
 */
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps, forwardRef } from 'react';

import { Button, type ButtonProps } from './button.tsx';
import { cn } from './cn.ts';
import { Input } from './input.tsx';

/** 带前后附加内容的输入框容器。 */
export const InputGroup = forwardRef<HTMLDivElement, ComponentProps<'div'>>(function InputGroup(
  { className, ...props },
  ref,
) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: shadcn 的 InputGroup 用 div 承载 group 角色，与上游一致。
    <div
      ref={ref}
      data-slot="input-group"
      role="group"
      className={cn(
        'group/input-group relative flex h-9 w-full min-w-0 items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] outline-none',
        'has-[>[data-align=inline-start]]:[&>input]:pl-2',
        'has-[>[data-align=inline-end]]:[&>input]:pr-2',
        'has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50',
        'has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20',
        className,
      )}
      {...props}
    />
  );
});

/** 附加区的对齐方式。 */
const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        'inline-start': 'order-first pl-3 has-[>button]:ml-[-0.45rem]',
        'inline-end': 'order-last pr-3 has-[>button]:mr-[-0.45rem]',
        'block-start': 'order-first w-full justify-start px-3 pt-3',
        'block-end': 'order-last w-full justify-start px-3 pb-3',
      },
    },
    defaultVariants: { align: 'inline-start' },
  },
);

/** 输入框内联的附加区。 */
export const InputGroupAddon = forwardRef<
  HTMLDivElement,
  ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>
>(function InputGroupAddon({ className, align = 'inline-start', ...props }, ref) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: 附加区同样用 div 承载 group 角色。
    <div
      ref={ref}
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      {...props}
    />
  );
});

/** 附加区里的按钮尺寸。 */
const inputGroupButtonVariants = cva('flex items-center gap-2 text-sm shadow-none', {
  variants: {
    size: {
      xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
      sm: 'h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5',
      'icon-xs': 'size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0',
      'icon-sm': 'size-8 p-0 has-[>svg]:p-0',
    },
  },
  defaultVariants: { size: 'xs' },
});

/** 附加区里的按钮。 */
export const InputGroupButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'size'> & VariantProps<typeof inputGroupButtonVariants>
>(function InputGroupButton(
  { className, type = 'button', variant = 'ghost', size = 'xs', ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
});

/** 附加区之外的主输入框。 */
export const InputGroupInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  function InputGroupInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        data-slot="input-group-control"
        className={cn(
          'flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0',
          className,
        )}
        {...props}
      />
    );
  },
);
