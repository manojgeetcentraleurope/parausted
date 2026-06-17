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

  // Pre-escape all dynamic values once; reused in both locale branches
  const eRecipient = escapeHtml(recipientName);
  const eSender = escapeHtml(senderName);
  const eMerchant = escapeHtml(merchantName);
  const eAmount = escapeHtml(formattedAmount);
  const eCode = escapeHtml(context.voucherCode);
  const eUrl = escapeHtml(context.voucherUrl);

  if (locale === 'en') {
    const subject = `You have a gift card from ${senderName}`;

    const personalMessageBlock = personalMessage
      ? [
          '<tr><td style="padding:0 0 20px;">',
          '<p style="font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#374151;margin:0 0 8px;">Personal message</p>',
          `<p style="font-family:Georgia,serif;font-size:15px;color:#374151;line-height:1.7;background:#f9fafb;border-left:3px solid #4f46e5;padding:12px 16px;border-radius:0 6px 6px 0;margin:0;">${formatMessageForHtml(personalMessage)}</p>`,
          '</td></tr>',
        ].join('')
      : '';

    const html = [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="UTF-8" />',
      '<meta name="viewport" content="width=device-width,initial-scale=1.0" />',
      '<meta name="x-apple-disable-message-reformatting" />',
      '</head>',
      '<body style="margin:0;padding:0;background:#f3f4f6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">',
      '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;padding:32px 16px;">',
      '<tr><td align="center">',
      '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">',
      // Header
      '<tr><td align="center" style="background:#4f46e5;padding:20px 32px;border-radius:12px 12px 0 0;">',
      '<span style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:1px;">ParaUsted</span>',
      '</td></tr>',
      // Body
      '<tr><td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">',
      '<table role="presentation" cellpadding="0" cellspacing="0" width="100%">',
      // Greeting
      '<tr><td style="padding:0 0 16px;">',
      `<p style="font-family:Georgia,serif;font-size:16px;color:#1f2937;line-height:1.6;margin:0;">Hello ${eRecipient},</p>`,
      '</td></tr>',
      // Intro
      '<tr><td style="padding:0 0 24px;">',
      `<p style="font-family:Georgia,serif;font-size:16px;color:#1f2937;line-height:1.6;margin:0;">${eSender} sent you a gift card for <strong>${eMerchant}</strong>.</p>`,
      '</td></tr>',
      // Gift card info box
      '<tr><td style="padding:0 0 24px;">',
      '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:10px;">',
      '<tr><td style="padding:20px 24px;">',
      '<p style="font-family:Georgia,serif;font-size:12px;color:#7c3aed;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Gift Card</p>',
      `<p style="font-family:Georgia,serif;font-size:32px;font-weight:bold;color:#4f46e5;margin:0 0 4px;line-height:1;">${eAmount}</p>`,
      `<p style="font-family:Georgia,serif;font-size:14px;color:#6b7280;margin:0;">${eMerchant}</p>`,
      '</td></tr>',
      '</table>',
      '</td></tr>',
      // Personal message (conditional)
      personalMessageBlock,
      // CTA button
      '<tr><td style="padding:0 0 12px;" align="center">',
      `<a href="${eUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">Open my gift card</a>`,
      '</td></tr>',
      // Fallback URL
      '<tr><td style="padding:0 0 28px;" align="center">',
      '<p style="font-family:Georgia,serif;font-size:13px;color:#6b7280;margin:0 0 4px;">If the button does not work, copy and paste this link:</p>',
      `<a href="${eUrl}" style="font-family:Georgia,serif;font-size:12px;color:#4f46e5;word-break:break-all;">${eUrl}</a>`,
      '</td></tr>',
      // Voucher code (secondary)
      '<tr><td style="padding:16px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">',
      `<p style="font-family:Georgia,serif;font-size:13px;color:#6b7280;margin:0;">Code: <span style="font-family:monospace;color:#374151;font-weight:bold;">${eCode}</span></p>`,
      '</td></tr>',
      // Source of truth note
      '<tr><td style="padding:20px 0 0;">',
      '<p style="font-family:Georgia,serif;font-size:12px;color:#9ca3af;margin:0;font-style:italic;">The gift card page is the official source for status, validity, and redemption.</p>',
      '</td></tr>',
      '</table>',
      '</td></tr>',
      // Footer
      '<tr><td style="background:#f9fafb;padding:16px 32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">',
      `<p style="font-family:Georgia,serif;font-size:12px;color:#9ca3af;margin:0;text-align:center;line-height:1.6;">If you need help, reply to this email.<br />Sent by ParaUsted for ${eMerchant}.</p>`,
      '</td></tr>',
      '</table>',
      '</td></tr>',
      '</table>',
      '</body>',
      '</html>',
    ].join('');

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
      '',
      'Open your gift card:',
      context.voucherUrl,
      '',
      'If the button does not work, copy and paste the link above.',
      '',
      'The gift card page is the official source for status, validity, and redemption.',
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

  const personalMessageBlock = personalMessage
    ? [
        '<tr><td style="padding:0 0 20px;">',
        '<p style="font-family:Georgia,serif;font-size:14px;font-weight:bold;color:#374151;margin:0 0 8px;">Mensaje personal</p>',
        `<p style="font-family:Georgia,serif;font-size:15px;color:#374151;line-height:1.7;background:#f9fafb;border-left:3px solid #4f46e5;padding:12px 16px;border-radius:0 6px 6px 0;margin:0;">${formatMessageForHtml(personalMessage)}</p>`,
        '</td></tr>',
      ].join('')
    : '';

  const html = [
    '<!DOCTYPE html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width,initial-scale=1.0" />',
    '<meta name="x-apple-disable-message-reformatting" />',
    '</head>',
    '<body style="margin:0;padding:0;background:#f3f4f6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f3f4f6;padding:32px 16px;">',
    '<tr><td align="center">',
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">',
    // Header
    '<tr><td align="center" style="background:#4f46e5;padding:20px 32px;border-radius:12px 12px 0 0;">',
    '<span style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:1px;">ParaUsted</span>',
    '</td></tr>',
    // Body
    '<tr><td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%">',
    // Greeting
    '<tr><td style="padding:0 0 16px;">',
    `<p style="font-family:Georgia,serif;font-size:16px;color:#1f2937;line-height:1.6;margin:0;">Hola ${eRecipient},</p>`,
    '</td></tr>',
    // Intro
    '<tr><td style="padding:0 0 24px;">',
    `<p style="font-family:Georgia,serif;font-size:16px;color:#1f2937;line-height:1.6;margin:0;">${eSender} te ha enviado una tarjeta regalo para <strong>${eMerchant}</strong>.</p>`,
    '</td></tr>',
    // Gift card info box
    '<tr><td style="padding:0 0 24px;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:10px;">',
    '<tr><td style="padding:20px 24px;">',
    '<p style="font-family:Georgia,serif;font-size:12px;color:#7c3aed;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Tarjeta regalo</p>',
    `<p style="font-family:Georgia,serif;font-size:32px;font-weight:bold;color:#4f46e5;margin:0 0 4px;line-height:1;">${eAmount}</p>`,
    `<p style="font-family:Georgia,serif;font-size:14px;color:#6b7280;margin:0;">${eMerchant}</p>`,
    '</td></tr>',
    '</table>',
    '</td></tr>',
    // Personal message (conditional)
    personalMessageBlock,
    // CTA button
    '<tr><td style="padding:0 0 12px;" align="center">',
    `<a href="${eUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-family:Georgia,serif;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">Abrir mi tarjeta regalo</a>`,
    '</td></tr>',
    // Fallback URL
    '<tr><td style="padding:0 0 28px;" align="center">',
    '<p style="font-family:Georgia,serif;font-size:13px;color:#6b7280;margin:0 0 4px;">Si el botón no funciona, copia y pega este enlace:</p>',
    `<a href="${eUrl}" style="font-family:Georgia,serif;font-size:12px;color:#4f46e5;word-break:break-all;">${eUrl}</a>`,
    '</td></tr>',
    // Voucher code (secondary)
    '<tr><td style="padding:16px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">',
    `<p style="font-family:Georgia,serif;font-size:13px;color:#6b7280;margin:0;">Código: <span style="font-family:monospace;color:#374151;font-weight:bold;">${eCode}</span></p>`,
    '</td></tr>',
    // Source of truth note
    '<tr><td style="padding:20px 0 0;">',
    '<p style="font-family:Georgia,serif;font-size:12px;color:#9ca3af;margin:0;font-style:italic;">La página de la tarjeta regalo es la fuente oficial para consultar el estado, la validez y el canje.</p>',
    '</td></tr>',
    '</table>',
    '</td></tr>',
    // Footer
    '<tr><td style="background:#f9fafb;padding:16px 32px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">',
    `<p style="font-family:Georgia,serif;font-size:12px;color:#9ca3af;margin:0;text-align:center;line-height:1.6;">Si necesitas ayuda, responde a este correo.<br />Enviado por ParaUsted para ${eMerchant}.</p>`,
    '</td></tr>',
    '</table>',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('');

  const textLines = [
    `Hola ${recipientName},`,
    '',
    `${senderName} te ha enviado una tarjeta regalo para ${merchantName}.`,
    personalMessage ? '' : null,
    personalMessage ? 'Mensaje personal:' : null,
    personalMessage || null,
    '',
    `Importe: ${formattedAmount}`,
    `Código: ${context.voucherCode}`,
    '',
    'Abrir tu tarjeta regalo:',
    context.voucherUrl,
    '',
    'Si el botón no funciona, copia y pega el enlace de arriba.',
    '',
    'La página de la tarjeta regalo es la fuente oficial para consultar el estado, la validez y el canje.',
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
