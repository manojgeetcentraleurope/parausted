import type { Locale } from '../config';
import { enMessages } from './en';
import { esMessages } from './es';
import type { MessagesShape } from './es';

export const messages = {
  es: esMessages,
  en: enMessages,
} as const;

export type Messages = MessagesShape;

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
