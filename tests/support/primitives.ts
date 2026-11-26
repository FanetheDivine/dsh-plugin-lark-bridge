/**
 * 测试使用的平台组件入口：直接把 `@deepseek-ai/dsh-client-ui-primitives` 指向包的源码。
 * 已发布的 lib 内联了未声明的第三方依赖（shiki、katex 等），源码只依赖 react、clsx
 * 与 dsh-client-store；vitest 能处理源码里的 CSS Module。
 */

export { Button } from '@deepseek-ai/dsh-client-ui-primitives/src/Button.tsx';
export { Checkbox } from '@deepseek-ai/dsh-client-ui-primitives/src/Checkbox.tsx';
export { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives/src/clipboard.ts';
export { FileTypeIcon } from '@deepseek-ai/dsh-client-ui-primitives/src/FileTypeIcon.tsx';
export {
  IconCheckOutlineRegular,
  IconChevronDownOutlineRegular,
  IconClockOutlineRegular,
  IconCloseOutlineRegular,
  IconPaperPlaneOutlineRegular,
  IconPlusOutlineRegular,
} from '@deepseek-ai/dsh-client-ui-primitives/src/icons/index.tsx';
export { Menu, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives/src/Menu.tsx';
export { Modal } from '@deepseek-ai/dsh-client-ui-primitives/src/Modal.tsx';
export { Pill } from '@deepseek-ai/dsh-client-ui-primitives/src/Pill.tsx';
export { Switch } from '@deepseek-ai/dsh-client-ui-primitives/src/Switch.tsx';
export type { SettingsFieldProps } from '@deepseek-ai/dsh-client-ui-primitives/src/settings-form/fields.tsx';
export {
  SettingsSecretField,
  SettingsValueField,
} from '@deepseek-ai/dsh-client-ui-primitives/src/settings-form/fields.tsx';
export type {
  SettingsFieldSpec,
  SettingsFieldState,
  SettingsFieldWrite,
  SettingsFormActions,
  SettingsFormPathOp,
  SettingsFormScope,
  SettingsFormScopeSnapshot,
  SettingsFormShell,
  SettingsSecretSpec,
} from '@deepseek-ai/dsh-client-ui-primitives/src/settings-form/form-model.ts';
export {
  SettingsFormModel,
  settingsNumberField,
  settingsTextField,
} from '@deepseek-ai/dsh-client-ui-primitives/src/settings-form/form-model.ts';
export type {
  SettingsFormLabels,
  SettingsFormProps,
} from '@deepseek-ai/dsh-client-ui-primitives/src/settings-form/SettingsForm.tsx';
export { SettingsForm } from '@deepseek-ai/dsh-client-ui-primitives/src/settings-form/SettingsForm.tsx';
export type { TagTone } from '@deepseek-ai/dsh-client-ui-primitives/src/Tag.tsx';
export { Tag } from '@deepseek-ai/dsh-client-ui-primitives/src/Tag.tsx';
export { useClipboardCopy } from '@deepseek-ai/dsh-client-ui-primitives/src/use-clipboard-copy.ts';
