import 'server-only';

import type { DeliveryContext } from './types';

type RenderedGiftCardDeliveryEmail = {
  subject: string;
  html: string;
  text: string;
};

const LOCALE_TO_BCP47: Record<DeliveryContext['locale'], string> = {
  es: 'es-ES',
  en: 'en-GB',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrency(amountCents: number, currency: string, locale: DeliveryContext['locale']): string {
  return new Intl.NumberFormat(LOCALE_TO_BCP47[locale], {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

function formatMessageForHtml(message: string): string {
  return escapeHtml(message).replace(/\r?\n/g, '<br />');
}

export function buildGiftCardDeliveryEmail(
  context: DeliveryContext,
): RenderedGiftCardDeliveryEmail {
  const locale = context.locale;
  const recipientName = context.recipientName.trim();
  const senderName = context.senderName.trim();
  const merchantName = context.merchantName.trim();
  const personalMessage = context.personalMessage.trim();
  const formattedAmount = `${formatCurrency(context.amountCents, context.currency, locale)} (${context.currency})`;

  if (locale === 'en') {
    const subject = `You have a gift card from ${senderName}`;
    const html = [
      '<div style="font-family: Georgia, serif; line-height: 1.6; color: #1f2937;">',
      `<p>Hello ${escapeHtml(recipientName)},</p>`,
      `<p>${escapeHtml(senderName)} sent you a gift card for <strong>${escapeHtml(merchantName)}</strong>.</p>`,
      personalMessage
        ? `<p><strong>Personal message</strong><br />${formatMessageForHtml(personalMessage)}</p>`
        : '',
      '<p><strong>Your gift card details</strong></p>',
      '<ul>',
      `<li>Amount: ${escapeHtml(formattedAmount)}</li>`,
      `<li>Code: ${escapeHtml(context.voucherCode)}</li>`,
      '</ul>',
      `<p><a href="${escapeHtml(context.voucherUrl)}">Open your gift card</a></p>`,
      '<p>If you need help, reply to this email.</p>',
      `<p>Sent by ParaUsted for ${escapeHtml(merchantName)}.</p>`,
      '</div>',
    ]
      .filter(Boolean)
      .join('');

    const textLines = [
      `Hello ${recipientName},`,
      '',
      `${senderName} sent you a gift card for ${merchantName}.`,
      personalMessage ? '' : null,
      personalMessage ? 'Personal message:' : null,
      personalMessage || null,
      '',
      `Amount: ${formattedAmount}`,
      `Code: ${context.voucherCode}`,
      `Open your gift card: ${context.voucherUrl}`,
      '',
      'If you need help, reply to this email.',
      `Sent by ParaUsted for ${merchantName}.`,
    ].filter((line): line is string => line !== null);

    return {
      subject,
      html,
      text: textLines.join('\n'),
    };
  }

  const subject = `Tienes una tarjeta regalo de ${senderName}`;
  const html = [
    '<div style="font-family: Georgia, serif; line-height: 1.6; color: #1f2937;">',
    `<p>Hola ${escapeHtml(recipientName)},</p>`,
    `<p>${escapeHtml(senderName)} te ha enviado una tarjeta regalo para <strong>${escapeHtml(merchantName)}</strong>.</p>`,
    personalMessage
      ? `<p><strong>Mensaje personal</strong><br />${formatMessageForHtml(personalMessage)}</p>`
      : '',
    '<p><strong>Detalles de tu tarjeta regalo</strong></p>',
    '<ul>',
    `<li>Importe: ${escapeHtml(formattedAmount)}</li>`,
    `<li>Código: ${escapeHtml(context.voucherCode)}</li>`,
    '</ul>',
    `<p><a href="${escapeHtml(context.voucherUrl)}">Abrir mi tarjeta regalo</a></p>`,
    '<p>Si necesitas ayuda, responde a este correo.</p>',
    `<p>Enviado por ParaUsted para ${escapeHtml(merchantName)}.</p>`,
    '</div>',
  ]
    .filter(Boolean)
    .join('');

  const textLines = [
    `Hola ${recipientName},`,
    '',
    `${senderName} te ha enviado una tarjeta regalo para ${merchantName}.`,
    personalMessage ? '' : null,
    personalMessage ? 'Mensaje personal:' : null,
    personalMessage || null,
    '',
    `Importe: ${formattedAmount}`,
    `Codigo: ${context.voucherCode}`,
    `Abrir tu tarjeta regalo: ${context.voucherUrl}`,
    '',
    'Si necesitas ayuda, responde a este correo.',
    `Enviado por ParaUsted para ${merchantName}.`,
  ].filter((line): line is string => line !== null);

  return {
    subject,
    html,
    text: textLines.join('\n'),
  };
}
