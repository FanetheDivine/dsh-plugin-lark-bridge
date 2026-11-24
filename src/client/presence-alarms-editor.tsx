/**
 * 闹钟条目编辑弹窗：表盘式时间选择与逐条跳过设置。
 * 导出 PresenceAlarmEditor 与 defaultAlarmTime。
 */
import { Button, Checkbox, Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { TimePicker } from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';

import {
  alarmId,
  isAlarmTime,
  type PresenceAction,
  type PresenceAlarm,
} from '../lark-super-agent/alarms.ts';
import type { NS } from './locales.ts';
import './presence-alarms.css';

/** 新条目的默认时间：当前本地时间。 */
export function defaultAlarmTime(now: Date = new Date()): string {
  const hour = `${now.getHours()}`.padStart(2, '0');
  const minute = `${now.getMinutes()}`.padStart(2, '0');
  return `${hour}:${minute}`;
}

// react-time-picker 输入时给出不带前导零的小时，保存前统一补零。
function padTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  const hour = match?.[1];
  const minute = match?.[2];
  if (hour === undefined || minute === undefined) return value;
  return `${hour.padStart(2, '0')}:${minute}`;
}

/** 文档语言，作为时间选择器的 locale。 */
function documentLocale(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const lang = document.documentElement.lang;
  return lang === '' ? undefined : lang;
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
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const body = useRef<HTMLDivElement>(null);

  // 表盘挂到弹窗内部，避免被滚动容器裁切。
  useEffect(() => {
    setPortal(body.current);
  }, []);

  const locale = documentLocale();
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
      <div ref={body} style={bodyStyle} data-dsh-lark-alarm-editor>
        <span style={labelStyle}>{t('presenceConfig.editor.time')}</span>
        <TimePicker
          value={time}
          onChange={(value) => {
            setTime(typeof value === 'string' ? padTime(value) : '');
          }}
          format="HH:mm"
          {...(locale === undefined ? {} : { locale })}
          portalContainer={portal}
          openClockOnFocus={false}
          clearIcon={null}
          disabled={props.disabled}
          className="dsh-lark-time-picker"
          hourAriaLabel={t('presenceConfig.editor.hour')}
          minuteAriaLabel={t('presenceConfig.editor.minute')}
          clockAriaLabel={t('presenceConfig.editor.clock')}
        />
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
  gap: 8,
  minWidth: 260,
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
  paddingTop: 4,
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};
