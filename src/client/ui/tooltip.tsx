/**
 * shadcn 的 Tooltip，底座为 Radix。来源：
 * https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/tooltip.tsx（MIT）。
 * 相对源码给浮层加 `data-dsh-lark-ui`，让插件的局部 base 覆盖到 portal 出去的浮层。
 */
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { type ComponentProps, forwardRef } from 'react';

import { cn } from './cn.ts';

/** 提示上下文，统一控制打开延迟。 */
export const TooltipProvider = TooltipPrimitive.Provider;

/** 提示根节点。 */
export const Tooltip = TooltipPrimitive.Root;

/** 提示触发器。 */
export const TooltipTrigger = TooltipPrimitive.Trigger;

/** 提示浮层，portal 到 body 并在空间不足时自动翻转。 */
export const TooltipContent = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, side = 'top', sideOffset = 6, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        data-slot="tooltip-content"
        data-dsh-lark-ui
        side={side}
        sideOffset={sideOffset}
        className={cn(
          'z-[1100] w-fit max-w-64 origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-foreground px-3 py-1.5 text-xs text-balance text-background fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
