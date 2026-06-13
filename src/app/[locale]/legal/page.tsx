import type { Metadata } from 'next';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isSupportedLocale } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { getCanonicalUrl, getAlternateLanguageUrls } from '@/lib/seo/metadata';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LegalPageProps = {
  params: Promise<{ locale: string }>;
};

type LegalSection = {
  heading: string;
  body: string;
};

type LegalCopy = {
  metaTitle: string;
  metaDescription: string;
  pageTitle: string;
  lastUpdated: string;
  pilotNotice: string;
  sections: LegalSection[];
};

// ---------------------------------------------------------------------------
// Inline copy
// ---------------------------------------------------------------------------

const PAGE_COPY: Record<Locale, LegalCopy> = {
  es: {
    metaTitle: 'Condiciones del programa | ParaUsted',
    metaDescription:
      'Condiciones de uso, validez de tarjetas regalo, política de reembolso y privacidad del programa ParaUsted.',
    pageTitle: 'Condiciones del programa de tarjetas regalo',
    lastUpdated: 'Programa piloto — junio 2026',
    pilotNotice:
      'Este servicio se encuentra en fase piloto y puede estar sujeto a cambios. Algunas funcionalidades pueden no estar disponibles en esta etapa.',
    sections: [
      {
        heading: 'Emisión del vale',
        body: 'Tu tarjeta regalo se genera únicamente después de que el comercio confirme la recepción del pago. Para pagos directos (Bizum, transferencia bancaria o efectivo), el comercio verifica el pago de forma independiente. No se emite ningún vale antes de dicha confirmación, independientemente del método de pago elegido.',
      },
      {
        heading: 'Validez de la tarjeta regalo',
        body: 'Las tarjetas regalo son válidas durante el número de días indicado en la tarjeta, contado desde la fecha de emisión del vale. Puedes consultar el saldo, el estado y la fecha de vencimiento en la página de tu tarjeta regalo en cualquier momento. Para tarjetas regalo de servicio, la tarjeta no reserva automáticamente una cita; la fecha, disponibilidad y prestación del servicio se acuerdan directamente con el comercio participante.',
      },
      {
        heading: 'Reembolsos y atención al comprador',
        body: 'Una vez emitida la tarjeta regalo, los reembolsos no son automáticos. Cualquier solicitud se revisará caso por caso, teniendo en cuenta la normativa aplicable, las condiciones del comercio participante y las circunstancias concretas. Si tienes algún problema con tu tarjeta regalo, contacta con el comercio directamente o escríbenos a nuestro equipo de soporte.',
      },
      {
        heading: 'Fuente de información oficial',
        body: 'La página de tu tarjeta regalo es la fuente de información oficial sobre su saldo, estado y validez. El correo electrónico de entrega es un canal adicional; si no recibes ningún correo, accede a tu tarjeta a través del enlace o código que te proporcionamos.',
      },
      {
        heading: 'Privacidad y datos personales',
        body: 'Usamos los datos personales necesarios para gestionar, emitir y entregar la tarjeta regalo, prestar soporte y cumplir obligaciones legales aplicables. Podemos compartir la información necesaria con el comercio participante y con proveedores que nos ayudan a prestar el servicio, siempre de forma limitada a esa finalidad.',
      },
    ],
  },
  en: {
    metaTitle: 'Programme terms and policy | ParaUsted',
    metaDescription:
      'Gift card validity, refund policy, privacy summary and programme terms for ParaUsted.',
    pageTitle: 'Gift card programme terms, validity and refund policy',
    lastUpdated: 'Pilot programme — June 2026',
    pilotNotice:
      'This service is in a pilot phase and may be subject to changes. Some features may not be available at this stage.',
    sections: [
      {
        heading: 'Voucher issuance',
        body: 'Your gift card is generated only after the merchant confirms receipt of payment. For direct payments (Bizum, bank transfer or cash), the merchant verifies payment independently. No voucher is issued before payment confirmation, regardless of the payment method chosen.',
      },
      {
        heading: 'Gift card validity',
        body: 'Gift cards are valid for the number of days shown on the card, counted from the date of issuance. You can check the balance, status and expiry date on your gift card page at any time. For service gift cards, the card does not automatically book an appointment; scheduling, availability and service delivery are arranged directly with the participating merchant.',
      },
      {
        heading: 'Refunds and buyer support',
        body: 'Once a gift card has been issued, refunds are not automatic. Any request will be reviewed case by case, taking into account applicable law, the participating merchant conditions and the specific circumstances. If you have a problem with your gift card, please contact the merchant directly or reach our support team.',
      },
      {
        heading: 'Authoritative source of information',
        body: 'Your gift card page is the authoritative source of information about your card\'s balance, status and validity. Email delivery is an additional channel; if you do not receive an email, access your card using the link or code we provided.',
      },
      {
        heading: 'Privacy and personal data',
        body: 'We use the personal data needed to manage, issue and deliver the gift card, provide support and comply with applicable legal obligations. We may share necessary information with the participating merchant and service providers that help us provide the service, limited to that purpose.',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export function generateStaticParams(): Array<{ locale: string }> {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const copy = PAGE_COPY[locale];

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: {
      canonical: getCanonicalUrl('/legal', locale),
      languages: getAlternateLanguageUrls('/legal'),
    },
    robots: { index: false, follow: false },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function LegalPage({ params }: LegalPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const copy = PAGE_COPY[locale];

  return (
    <main className="min-h-screen bg-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-medium text-gray-500">ParaUsted</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{copy.pageTitle}</h1>
        <p className="mt-2 text-xs text-gray-400">{copy.lastUpdated}</p>

        {/* Pilot notice */}
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {copy.pilotNotice}
        </div>

        {/* Sections */}
        <div className="mt-8 space-y-8">
          {copy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold text-gray-900">{section.heading}</h2>
              <p className="mt-2 text-sm text-gray-600">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
