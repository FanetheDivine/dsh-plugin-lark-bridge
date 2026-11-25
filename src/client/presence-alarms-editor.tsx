/**
 * 时间条目编辑弹窗：列式时间选择与逐条跳过设置。
 * 导出 PresenceAlarmEditor 与 defaultAlarmTime。
 */
import { Button, Checkbox, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { type CSSProperties, useState } from 'react';

import {
  alarmId,
  isAlarmTime,
  type PresenceAction,
  type PresenceAlarm,
} from '../lark-super-agent/alarms.ts';
import type { NS } from './locales.ts';
import {
  TimePicker,
  TimePickerColumns,
  TimePickerConfirm,
  TimePickerContent,
  TimePickerFooter,
  TimePickerInput,
  TimePickerNow,
} from './ui/time-picker.tsx';

/** 新条目的默认时间：当前本地时间。 */
export function defaultAlarmTime(now: Date = new Date()): string {
  const hour = `${now.getHours()}`.padStart(2, '0');
  const minute = `${now.getMinutes()}`.padStart(2, '0');
  return `${hour}:${minute}`;
}

/** 编辑弹窗属性。 */
export interface PresenceAlarmEditorProps {
  readonly t: TranslateNS<typeof NS>;
  readonly action: PresenceAction;
  /** 被编辑的条目；缺省表示新增。 */
  readonly alarm?: PresenceAlarm | undefined;
  /** 同分区已有的时间，用于阻止重复。 */
  readonly existingTimes: readonly string[];
  readonly disabled: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (alarm: PresenceAlarm) => void;
}

/** 渲染添加或编辑条目的弹窗。 */
export function PresenceAlarmEditor(props: PresenceAlarmEditorProps) {
  const { t } = props;
  const [time, setTime] = useState(props.alarm?.time ?? defaultAlarmTime());
  const [skipWeekends, setSkipWeekends] = useState(props.alarm?.skipWeekends ?? true);
  const [skipHolidays, setSkipHolidays] = useState(props.alarm?.skipHolidays ?? true);
  const [enabled, setEnabled] = useState(props.alarm?.enabled ?? true);

  const invalid = !isAlarmTime(time);
  const duplicate = !invalid && props.existingTimes.includes(time);
  const canSubmit = !invalid && !duplicate && !props.disabled;
  const title =
    props.alarm === undefined
      ? t('presenceConfig.editor.add.title')
      : t('presenceConfig.editor.edit.title');

  const submit = (): void => {
    if (!canSubmit) return;
    props.onSubmit({
      id: props.alarm?.id ?? alarmId(),
      time,
      action: props.action,
      enabled,
      skipWeekends,
      skipHolidays,
    });
    props.onClose();
  };

  return (
    <Modal
      open
      onClose={props.onClose}
      title={title}
      closeLabel={t('presenceConfig.editor.cancel')}
      footer={
        <div style={footerStyle}>
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            {t('presenceConfig.editor.cancel')}
          </Button>
          <Button variant="primary" size="sm" disabled={!canSubmit} onClick={submit}>
            {t('presenceConfig.editor.save')}
          </Button>
        </div>
      }
    >
      <div style={bodyStyle} data-dsh-lark-alarm-editor data-dsh-lark-ui>
        <span style={labelStyle}>{t('presenceConfig.editor.time')}</span>
        <TimePicker
          value={invalid ? null : time}
          onValueChange={(next) => {
            if (next !== null) setTime(next);
          }}
          granularity="minute"
          hourCycle={24}
          disabled={props.disabled}
          aria-label={t('presenceConfig.editor.time')}
          i18n={{
            labels: {
              placeholder: t('presenceConfig.editor.placeholder'),
              hour: t('presenceConfig.editor.hour'),
              minute: t('presenceConfig.editor.minute'),
              panelLabel: t('presenceConfig.editor.panel'),
              openPicker: t('presenceConfig.editor.openPicker'),
              now: t('presenceConfig.editor.now'),
              confirm: t('presenceConfig.editor.save'),
            },
          }}
        >
          <TimePickerInput placeholder={t('presenceConfig.editor.placeholder')} />
          <TimePickerContent align="start">
            <TimePickerColumns />
            <TimePickerFooter>
              <TimePickerNow />
              <TimePickerConfirm />
            </TimePickerFooter>
          </TimePickerContent>
        </TimePicker>
        {duplicate ? <p style={warningStyle}>{t('presenceConfig.editor.duplicate')}</p> : null}
        <div style={checksStyle}>
          <Checkbox
            label={t('presenceConfig.alarm.skipWeekends')}
            checked={skipWeekends}
            onChange={setSkipWeekends}
            disabled={props.disabled}
          />
          <Checkbox
            label={t('presenceConfig.alarm.skipHolidays')}
            checked={skipHolidays}
            onChange={setSkipHolidays}
            disabled={props.disabled}
          />
          <Checkbox
            label={t('presenceConfig.alarm.enabled')}
            checked={enabled}
            onChange={setEnabled}
            disabled={props.disabled}
          />
        </div>
      </div>
    </Modal>
  );
}

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 280,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--dsw-alias-label-secondary)',
};

const warningStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: 'var(--dsw-alias-state-warn-primary)',
};

const checksStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  paddingTop: 2,
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};
