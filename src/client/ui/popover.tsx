/**
 * shadcn 的 Popover，底座为 Radix。来源：
 * https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/popover.tsx（MIT）。
 * 相对源码给浮层加 `data-dsh-lark-ui`，让插件的局部 base 覆盖到 portal 出去的浮层。
 */
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { type ComponentProps, forwardRef } from 'react';

import { cn } from './cn.ts';

/** 浮层容器。 */
export const Popover = PopoverPrimitive.Root;

/** 浮层触发器。 */
export const PopoverTrigger = PopoverPrimitive.Trigger;

/** 浮层锚点。 */
export const PopoverAnchor = PopoverPrimitive.Anchor;

/** 浮层面板，portal 到 body 并自动翻转定位。 */
export const PopoverContent = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof PopoverPrimitive.Content>
>(function PopoverContent({ className, align = 'center', sideOffset = 4, ...props }, ref) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        data-slot="popover-content"
        data-dsh-lark-ui
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
