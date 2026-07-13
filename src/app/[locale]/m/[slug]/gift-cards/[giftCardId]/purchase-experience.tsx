'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';

import type { Locale } from '@/lib/i18n/config';
import type { DirectPaymentMethod, PurchasePaymentMethod } from '@/lib/purchases/schema';
import {
  DESIGN_TEMPLATE_VALUES,
  FONT_STYLE_VALUES,
  OCCASION_VALUES,
  RELATIONSHIP_VALUES,
  type FontStyle,
  type Occasion,
} from '@/lib/purchases/schema';
import { resolveAppUrl } from '@/lib/utils/app-url';
import { createPurchaseAction, type PurchaseActionState } from './actions';
import type {
  CheckoutReturnStatus,
  GiftCardDisplayData,
  MerchantDisplayData,
} from './purchase-form';

type PurchaseExperienceProps = {
  locale: Locale;
  merchant: MerchantDisplayData;
  giftCard: GiftCardDisplayData;
  availablePaymentMethods: readonly DirectPaymentMethod[];
  stripeCardAvailable: boolean;
  checkoutReturnStatus: CheckoutReturnStatus;
};

type Copy = {
  back: string;
  secure: string;
  title: string;
  subtitle: string;
  steps: readonly [string, string, string];
  recipientTitle: string;
  recipientHint: string;
  recipientName: string;
  recipientEmail: string;
  buyerEmail: string;
  buyerName: string;
  personalizeTitle: string;
  personalizeHint: string;
  relationship: string;
  occasion: string;
  occasionHint: string;
  design: string;
  fontStyle: string;
  fontHint: string;
  senderName: string;
  message: string;
  messageIdeas: string;
  messageIdeasHint: string;
  useMessage: string;
  customAmount: string;
  paymentTitle: string;
  paymentHint: string;
  consent: string;
  legal: string;
  legalLink: string;
  continue: string;
  previous: string;
  submit: string;
  submitting: string;
  previewLabel: string;
  previewHint: string;
  previewGreeting: (name: string) => string;
  previewFallbackName: string;
  previewFallbackSender: string;
  previewFallbackMessage: string;
  validity: (days: number) => string;
  paymentLabels: Record<PurchasePaymentMethod, string>;
  relationshipLabels: Record<(typeof RELATIONSHIP_VALUES)[number], string>;
  occasionLabels: Record<Occasion, string>;
  designLabels: Record<(typeof DESIGN_TEMPLATE_VALUES)[number], string>;
  fontLabels: Record<FontStyle, string>;
  requiredOption: string;
  checkoutReady: string;
  checkoutPreparing: string;
  checkoutCancelled: string;
  viewGift: string;
  shareWhatsApp: string;
  genericError: string;
  successTitle: string;
  successText: string;
  reference: string;
  nextSteps: string;
};

const COPY: Record<Locale, Copy> = {
  es: {
    back: 'Volver a las experiencias',
    secure: 'Compra segura',
    title: 'Crea un regalo inolvidable',
    subtitle: 'Tres pasos. Una sorpresa hecha especialmente para esa persona.',
    steps: ['Destinatario', 'Diseño y mensaje', 'Pago'],
    recipientTitle: '¿Para quién es este regalo?',
    recipientHint: 'Usaremos estos datos para personalizar la experiencia y preparar la entrega.',
    recipientName: 'Nombre del destinatario',
    recipientEmail: 'Email del destinatario',
    buyerEmail: 'Tu email',
    buyerName: 'Tu nombre (opcional)',
    personalizeTitle: 'Haz que se sienta personal',
    personalizeHint: 'Elige el estilo y escribe unas palabras que solo podrían venir de ti.',
    relationship: '¿Quién es para ti?',
    occasion: '¿Qué celebráis?',
    occasionHint: 'La ocasión nos ayuda a proponerte palabras que encajen de verdad.',
    design: 'Elige un estilo',
    fontStyle: 'Elige la personalidad de la letra',
    fontHint: 'La tipografía elegida también aparecerá en la tarjeta final.',
    senderName: 'Firma del regalo',
    message: 'Tu dedicatoria',
    messageIdeas: 'Ideas para tu dedicatoria',
    messageIdeasHint: 'Elige una como punto de partida y hazla tuya.',
    useMessage: 'Usar este mensaje',
    customAmount: 'Importe del regalo (€)',
    paymentTitle: 'Revisa y completa el regalo',
    paymentHint: 'La tarjeta se emitirá únicamente cuando el pago esté confirmado.',
    consent: 'Acepto la entrega digital inmediata después de confirmar el pago.',
    legal: 'Al continuar aceptas la política de validez, entrega y reembolso.',
    legalLink: 'Ver condiciones',
    continue: 'Continuar',
    previous: 'Atrás',
    submit: 'Completar regalo',
    submitting: 'Preparando pago…',
    previewLabel: 'Vista previa móvil',
    previewHint: 'Así se verá la tarjeta al compartirla desde el móvil.',
    previewGreeting: (name) => `Para ${name}`,
    previewFallbackName: 'alguien especial',
    previewFallbackSender: 'Tu nombre',
    previewFallbackMessage: 'Un momento para disfrutar, recordar y contar después.',
    validity: (days) => `${days} días de validez`,
    paymentLabels: {
      card: 'Tarjeta',
      bizum_direct: 'Bizum',
      bank_transfer: 'Transferencia',
      cash: 'Efectivo',
    },
    relationshipLabels: {
      mama: 'Mamá', papa: 'Papá', hija: 'Hija', hijo: 'Hijo', abuelo: 'Abuelo',
      abuela: 'Abuela', pareja: 'Pareja', familia: 'Familia', amigo: 'Amigo/a', custom: 'Otra persona',
    },
    occasionLabels: {
      birthday: 'Cumpleaños', anniversary: 'Aniversario', wedding: 'Boda', thank_you: 'Gracias',
      congratulations: 'Enhorabuena', christmas: 'Navidad', just_because: 'Porque sí',
    },
    designLabels: {
      classic: 'Editorial', warm: 'Cálido', celebration: 'Celebración', romantic: 'Romántico', family: 'Familiar',
    },
    fontLabels: { elegant: 'Elegante', modern: 'Moderna', handwritten: 'Manuscrita' },
    requiredOption: 'Selecciona una opción',
    checkoutReady: 'Tu tarjeta regalo está lista.',
    checkoutPreparing: 'Pago recibido. Estamos preparando tu tarjeta regalo.',
    checkoutCancelled: 'El pago se canceló. Tus datos siguen aquí para que puedas intentarlo de nuevo.',
    viewGift: 'Ver tarjeta',
    shareWhatsApp: 'Compartir por WhatsApp',
    genericError: 'Revisa los campos indicados e inténtalo de nuevo.',
    successTitle: 'Solicitud creada',
    successText: 'El comercio emitirá la tarjeta cuando confirme el pago.',
    reference: 'Referencia',
    nextSteps: 'Usa esta referencia al realizar el pago.',
  },
  en: {
    back: 'Back to experiences',
    secure: 'Secure purchase',
    title: 'Create an unforgettable gift',
    subtitle: 'Three steps. One surprise made especially for them.',
    steps: ['Recipient', 'Design & message', 'Payment'],
    recipientTitle: 'Who is this gift for?',
    recipientHint: 'We use these details to personalize the experience and prepare delivery.',
    recipientName: "Recipient's name",
    recipientEmail: "Recipient's email",
    buyerEmail: 'Your email',
    buyerName: 'Your name (optional)',
    personalizeTitle: 'Make it feel personal',
    personalizeHint: 'Choose a style and write something that could only come from you.',
    relationship: 'Who are they to you?',
    occasion: 'What are you celebrating?',
    occasionHint: 'The occasion helps us suggest words that feel genuinely right.',
    design: 'Choose a style',
    fontStyle: 'Choose a type personality',
    fontHint: 'Your typography choice will also appear on the final gift card.',
    senderName: 'Gift signature',
    message: 'Your message',
    messageIdeas: 'Message inspiration',
    messageIdeasHint: 'Choose one as a starting point, then make it your own.',
    useMessage: 'Use this message',
    customAmount: 'Gift amount (€)',
    paymentTitle: 'Review and complete the gift',
    paymentHint: 'The gift card is issued only after payment is confirmed.',
    consent: 'I agree to immediate digital delivery after payment confirmation.',
    legal: 'By continuing you accept the validity, delivery, and refund policy.',
    legalLink: 'View terms',
    continue: 'Continue',
    previous: 'Back',
    submit: 'Complete gift',
    submitting: 'Preparing payment…',
    previewLabel: 'Mobile preview',
    previewHint: 'This is how the card will look when shared from a phone.',
    previewGreeting: (name) => `For ${name}`,
    previewFallbackName: 'someone special',
    previewFallbackSender: 'Your name',
    previewFallbackMessage: 'A moment to enjoy, remember, and talk about afterwards.',
    validity: (days) => `${days} days validity`,
    paymentLabels: {
      card: 'Card',
      bizum_direct: 'Bizum',
      bank_transfer: 'Bank transfer',
      cash: 'Cash',
    },
    relationshipLabels: {
      mama: 'Mom', papa: 'Dad', hija: 'Daughter', hijo: 'Son', abuelo: 'Grandfather',
      abuela: 'Grandmother', pareja: 'Partner', familia: 'Family', amigo: 'Friend', custom: 'Someone else',
    },
    occasionLabels: {
      birthday: 'Birthday', anniversary: 'Anniversary', wedding: 'Wedding', thank_you: 'Thank you',
      congratulations: 'Congratulations', christmas: 'Christmas', just_because: 'Just because',
    },
    designLabels: {
      classic: 'Editorial', warm: 'Warm', celebration: 'Celebration', romantic: 'Romantic', family: 'Family',
    },
    fontLabels: { elegant: 'Elegant', modern: 'Modern', handwritten: 'Handwritten' },
    requiredOption: 'Select an option',
    checkoutReady: 'Your gift card is ready.',
    checkoutPreparing: 'Payment received. We are preparing your gift card.',
    checkoutCancelled: 'Payment was cancelled. Your details are still here so you can try again.',
    viewGift: 'View gift card',
    shareWhatsApp: 'Share via WhatsApp',
    genericError: 'Review the highlighted fields and try again.',
    successTitle: 'Request created',
    successText: 'The merchant will issue the card after confirming payment.',
    reference: 'Reference',
    nextSteps: 'Use this reference when making the payment.',
  },
};

const DESIGN_STYLES = {
  classic: 'bg-[#e7dfd1] text-[#1d211d]',
  warm: 'bg-[#a64f32] text-white',
  celebration: 'bg-[#12565a] text-white',
  romantic: 'bg-[#783642] text-white',
  family: 'bg-[#3d5943] text-white',
} as const;

const DESIGN_MARKS = {
  classic: 'EDITION 01',
  warm: 'GOLDEN HOUR',
  celebration: 'CELEBRATE',
  romantic: 'WITH LOVE',
  family: 'TOGETHER',
} as const;

const FONT_STYLE_CLASSES: Record<FontStyle, { display: string; message: string }> = {
  elegant: {
    display: 'gift-font-elegant',
    message: 'gift-font-elegant',
  },
  modern: {
    display: 'gift-font-modern',
    message: 'gift-font-modern',
  },
  handwritten: {
    display: 'gift-font-handwritten',
    message: 'gift-font-handwritten',
  },
};

const MESSAGE_TEMPLATES: Record<Locale, Record<Occasion, readonly [string, string, string]>> = {
  es: {
    birthday: [
      'Feliz cumpleaños, {name}. Que esta experiencia se convierta en uno de esos recuerdos que siempre hacen sonreír.',
      'Hoy celebramos todo lo que te hace especial. Disfruta Sevilla, déjate sorprender y brinda por un año maravilloso.',
      'Una nueva vuelta al sol merece una aventura inolvidable. Este regalo es para que la disfrutes a tu manera.',
    ],
    anniversary: [
      'Por todo lo vivido y por todo lo que todavía nos queda por descubrir. Que esta experiencia sea otro recuerdo juntos.',
      'Nuestro mejor lugar siempre es donde coincidimos. Celebremos este aniversario descubriendo algo nuevo juntos.',
      'El tiempo contigo se mide en momentos que merece la pena guardar. Este es el próximo.',
    ],
    wedding: [
      'Que vuestra nueva vida esté llena de viajes, descubrimientos y momentos compartidos. Con todo nuestro cariño.',
      'Por una historia que acaba de empezar y por todas las aventuras que escribiréis juntos. ¡Enhorabuena!',
      'Un regalo para celebrar vuestro sí y crear un recuerdo precioso en Sevilla.',
    ],
    thank_you: [
      'Gracias por estar, por ayudar y por hacer la diferencia. Espero que disfrutes muchísimo de esta experiencia.',
      'Hay gestos que merecen algo más que palabras. Este regalo es mi forma de decirte gracias de corazón.',
      'Por todo lo que haces y por la manera en que lo haces: gracias. Ahora te toca disfrutar.',
    ],
    congratulations: [
      '¡Enhorabuena, {name}! Tu esfuerzo merece celebrarse con una experiencia a la altura.',
      'Lo conseguiste. Ahora toca parar, celebrarlo y disfrutar de algo inolvidable.',
      'Por este logro y por todos los que vendrán. Que esta experiencia sea el comienzo de una gran celebración.',
    ],
    christmas: [
      'Esta Navidad te regalo tiempo para descubrir, disfrutar y crear un recuerdo precioso. Con todo mi cariño.',
      'Que la magia de estas fiestas continúe en una experiencia inolvidable por Sevilla. Feliz Navidad.',
      'Menos cosas, más momentos. Espero que disfrutes cada instante de este regalo.',
    ],
    just_because: [
      'Porque pensé en ti y quise regalarte un momento especial. Espero que lo disfrutes muchísimo.',
      'No hace falta una fecha para celebrar a alguien importante. Este regalo es para ti, simplemente porque sí.',
      'Una pequeña sorpresa para recordarte lo especial que eres. Disfruta la experiencia a tu manera.',
    ],
  },
  en: {
    birthday: [
      'Happy birthday, {name}. May this experience become one of those memories that always brings a smile.',
      'Today is about everything that makes you special. Enjoy Seville, be surprised, and toast to a wonderful year ahead.',
      'Another trip around the sun deserves an unforgettable adventure. This one is yours to enjoy your way.',
    ],
    anniversary: [
      'For everything we have shared and everything still waiting to be discovered. Here is to another memory together.',
      'The best place is wherever we are together. Let us celebrate this anniversary by discovering somewhere new.',
      'Time with you is measured in moments worth keeping. This is our next one.',
    ],
    wedding: [
      'May your new life be filled with journeys, discoveries, and beautiful moments together. With all our love.',
      'To a story just beginning and every adventure you will write together. Congratulations!',
      'A gift to celebrate your yes and create a beautiful memory together in Seville.',
    ],
    thank_you: [
      'Thank you for showing up, helping out, and making a difference. I hope you enjoy every moment of this experience.',
      'Some gestures deserve more than words. This gift is my way of saying a heartfelt thank you.',
      'For everything you do and the care you bring to it: thank you. Now it is your turn to enjoy.',
    ],
    congratulations: [
      'Congratulations, {name}! Your hard work deserves an experience worth celebrating.',
      'You did it. Now it is time to pause, celebrate, and enjoy something unforgettable.',
      'To this achievement and all those still to come. Let this experience begin the celebration.',
    ],
    christmas: [
      'This Christmas, I am giving you time to discover, enjoy, and make a beautiful memory. With all my love.',
      'May the magic of the season continue with an unforgettable Seville experience. Merry Christmas.',
      'Fewer things, more moments. I hope you enjoy every part of this gift.',
    ],
    just_because: [
      'I thought of you and wanted to give you a special moment. I hope you enjoy every second.',
      'You do not need a date to celebrate someone important. This gift is for you, simply because.',
      'A little surprise to remind you how special you are. Enjoy the experience your way.',
    ],
  },
};

const inputClassName = 'mt-2 min-h-12 w-full border border-black/15 bg-white px-4 text-sm text-[#1d211d] outline-none transition focus:border-[#b45309] focus:ring-2 focus:ring-[#b45309]/15';
const labelClassName = 'block text-sm font-semibold text-[#30372f]';
const errorClassName = 'mt-1.5 text-sm text-red-700';

function getFieldError(state: PurchaseActionState, field: string): string | undefined {
  return state !== null && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;
}

function getVoucherUrl(locale: Locale, voucherCode: string): string {
  return `${resolveAppUrl()}/${locale}/v/${voucherCode}`;
}

export function PurchaseExperience({
  locale,
  merchant,
  giftCard,
  availablePaymentMethods,
  stripeCardAvailable,
  checkoutReturnStatus,
}: PurchaseExperienceProps) {
  const copy = COPY[locale];
  const boundAction = createPurchaseAction.bind(null, {
    locale,
    slug: merchant.slug,
    giftCardId: giftCard.id,
  });
  const [step, setStep] = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [design, setDesign] = useState<(typeof DESIGN_TEMPLATE_VALUES)[number]>('classic');
  const [occasion, setOccasion] = useState<Occasion>('just_because');
  const [fontStyle, setFontStyle] = useState<FontStyle>('elegant');
  const [state, formAction, isPending] = useActionState(
    async (previousState: PurchaseActionState, formData: FormData) => {
      const result = await boundAction(previousState, formData);

      if (result !== null && !result.ok && result.fieldErrors) {
        const fields = Object.keys(result.fieldErrors);
        if (fields.some((field) => ['buyerEmail', 'buyerName', 'recipientName', 'recipientEmail'].includes(field))) {
          setStep(1);
        } else if (fields.some((field) => ['relationship', 'occasion', 'designTemplate', 'fontStyle', 'senderName', 'personalMessage', 'customAmountInput'].includes(field))) {
          setStep(2);
        } else {
          setStep(3);
        }
      }

      return result;
    },
    null,
  );

  useEffect(() => {
    if (state !== null && state.ok && state.data.kind === 'stripe_checkout' && state.data.checkoutUrl) {
      window.location.href = state.data.checkoutUrl;
    }
  }, [state]);

  if (state !== null && state.ok) {
    if (state.data.kind === 'stripe_checkout') {
      return (
        <div className="flex min-h-[70svh] items-center justify-center bg-[#f3f0e9] px-5 text-center">
          <p className="font-serif text-2xl text-[#1d211d]">{copy.submitting}</p>
        </div>
      );
    }
    return (
      <main className="min-h-screen bg-[#f3f0e9] px-5 py-16 text-[#1d211d]">
        <div className="mx-auto max-w-xl border border-black/10 bg-[#faf8f3] p-7 shadow-xl sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">{merchant.name}</p>
          <h1 className="mt-4 font-serif text-4xl">{copy.successTitle}</h1>
          <p className="mt-3 text-sm leading-6 text-black/60">{copy.successText}</p>
          <div className="mt-8 border-y border-black/10 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-black/40">{copy.reference}</p>
            <p className="mt-2 font-mono text-xl font-semibold">{state.data.referenceCode}</p>
            <p className="mt-3 text-sm text-black/55">{copy.nextSteps}</p>
          </div>
          <Link href={`/${locale}/m/${merchant.slug}`} className="mt-8 inline-flex text-sm font-semibold text-[#9a4b12] underline">
            {copy.back}
          </Link>
        </div>
      </main>
    );
  }

  function validateStep(currentStep: number): boolean {
    const fieldIds = currentStep === 1
      ? ['recipientName', 'recipientEmail', 'buyerEmail']
      : ['relationship', 'occasion-birthday', 'designTemplate-classic', 'fontStyle-elegant', 'senderName', 'personalMessage', ...(giftCard.cardType === 'custom_value' ? ['customAmountInput'] : [])];

    for (const id of fieldIds) {
      const field = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (field && !field.reportValidity()) return false;
    }
    return true;
  }

  function nextStep(): void {
    if (validateStep(step)) {
      setStep((current) => Math.min(3, current + 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const isCustomValue = giftCard.cardType === 'custom_value';
  const messageIdeas = MESSAGE_TEMPLATES[locale][occasion].map((template) =>
    template.replace('{name}', recipientName.trim() || copy.previewFallbackName),
  );
  const statusMessage = checkoutReturnStatus.kind === 'success_ready'
    ? copy.checkoutReady
    : checkoutReturnStatus.kind === 'success_preparing'
      ? copy.checkoutPreparing
      : checkoutReturnStatus.kind === 'cancelled'
        ? copy.checkoutCancelled
        : null;

  return (
    <main className="min-h-screen bg-[#f3f0e9] text-[#1d211d]">
      <header className="border-b border-black/10 bg-[#faf8f3] px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href={`/${locale}/m/${merchant.slug}`} className="text-sm font-semibold text-black/60 hover:text-black">
            ← {copy.back}
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">{copy.secure}</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <div className="px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
          <div className="mx-auto max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a14f17]">{merchant.name}</p>
            <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{copy.title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-black/55">{copy.subtitle}</p>

            <ol className="mt-9 grid grid-cols-3 border-y border-black/10 py-4" aria-label={copy.title}>
              {copy.steps.map((label, index) => {
                const number = index + 1;
                return (
                  <li key={label} className={`flex items-center gap-2 text-xs sm:text-sm ${number <= step ? 'text-[#1d211d]' : 'text-black/35'}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${number === step ? 'border-[#a14f17] bg-[#a14f17] text-white' : number < step ? 'border-[#a14f17] text-[#a14f17]' : 'border-black/15'}`}>
                      {number < step ? '✓' : number}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </li>
                );
              })}
            </ol>

            {statusMessage && (
              <div role="status" className="mt-6 border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {statusMessage}
                {checkoutReturnStatus.kind === 'success_ready' && (
                  <div className="mt-2 flex flex-wrap gap-4 font-semibold">
                    <Link href={`/${locale}/v/${checkoutReturnStatus.voucherCode}`} className="underline">{copy.viewGift}</Link>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`${merchant.name} · ${getVoucherUrl(locale, checkoutReturnStatus.voucherCode)}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 underline"
                    >
                      {copy.shareWhatsApp}
                    </a>
                  </div>
                )}
              </div>
            )}

            {state !== null && !state.ok && (
              <div role="alert" className="mt-6 border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-900">
                {state.message || copy.genericError}
              </div>
            )}

            <form action={formAction} className="mt-10" noValidate={false}>
              <section hidden={step !== 1} aria-labelledby="recipient-step-title">
                <h2 id="recipient-step-title" className="font-serif text-3xl">{copy.recipientTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-black/50">{copy.recipientHint}</p>
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  <Field label={copy.recipientName} error={getFieldError(state, 'recipientName')}>
                    <input id="recipientName" name="recipientName" required maxLength={120} autoComplete="off" className={inputClassName} onChange={(event) => setRecipientName(event.target.value)} />
                  </Field>
                  <Field label={copy.recipientEmail} error={getFieldError(state, 'recipientEmail')}>
                    <input id="recipientEmail" name="recipientEmail" type="email" required autoComplete="off" className={inputClassName} />
                  </Field>
                  <Field label={copy.buyerEmail} error={getFieldError(state, 'buyerEmail')}>
                    <input id="buyerEmail" name="buyerEmail" type="email" required autoComplete="email" className={inputClassName} />
                  </Field>
                  <Field label={copy.buyerName} error={getFieldError(state, 'buyerName')}>
                    <input id="buyerName" name="buyerName" maxLength={120} autoComplete="name" className={inputClassName} />
                  </Field>
                </div>
              </section>

              <section hidden={step !== 2} aria-labelledby="personalize-step-title">
                <h2 id="personalize-step-title" className="font-serif text-3xl">{copy.personalizeTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-black/50">{copy.personalizeHint}</p>
                <div className="mt-7 space-y-6">
                  <Field label={copy.relationship} error={getFieldError(state, 'relationship')}>
                    <select id="relationship" name="relationship" required defaultValue="" className={inputClassName}>
                      <option value="" disabled>{copy.requiredOption}</option>
                      {RELATIONSHIP_VALUES.map((relationship) => <option key={relationship} value={relationship}>{copy.relationshipLabels[relationship]}</option>)}
                    </select>
                  </Field>

                  <fieldset>
                    <legend className={labelClassName}>{copy.occasion}</legend>
                    <p className="mt-1 text-xs font-normal leading-5 text-black/45">{copy.occasionHint}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {OCCASION_VALUES.map((value) => (
                        <label
                          key={value}
                          className={`flex min-h-12 cursor-pointer items-center justify-center border px-3 text-center text-xs font-semibold transition ${
                            occasion === value
                              ? 'border-[#a14f17] bg-[#fff8ef] text-[#7c3b12] ring-2 ring-[#a14f17]/15'
                              : 'border-black/10 bg-white text-black/60 hover:border-black/25'
                          }`}
                        >
                          <input
                            id={`occasion-${value}`}
                            checked={occasion === value}
                            className="sr-only"
                            name="occasion"
                            onChange={() => setOccasion(value)}
                            required
                            type="radio"
                            value={value}
                          />
                          {copy.occasionLabels[value]}
                        </label>
                      ))}
                    </div>
                    {getFieldError(state, 'occasion') && <p className={errorClassName}>{getFieldError(state, 'occasion')}</p>}
                  </fieldset>

                  <fieldset>
                    <legend className={labelClassName}>{copy.design}</legend>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {DESIGN_TEMPLATE_VALUES.map((template) => (
                        <label key={template} className={`cursor-pointer border p-3 transition ${design === template ? 'border-[#a14f17] ring-2 ring-[#a14f17]/15' : 'border-black/10 bg-white'}`}>
                          <input
                            id={`designTemplate-${template}`}
                            name="designTemplate"
                            type="radio"
                            value={template}
                            checked={design === template}
                            onChange={() => setDesign(template)}
                            className="sr-only"
                            required
                          />
                          <span className={`block h-8 w-full ${DESIGN_STYLES[template]}`} aria-hidden="true" />
                          <span className="mt-2 block text-[11px] font-medium">{copy.designLabels[template]}</span>
                        </label>
                      ))}
                    </div>
                    {getFieldError(state, 'designTemplate') && <p className={errorClassName}>{getFieldError(state, 'designTemplate')}</p>}
                  </fieldset>

                  <fieldset>
                    <legend className={labelClassName}>{copy.fontStyle}</legend>
                    <p className="mt-1 text-xs font-normal leading-5 text-black/45">{copy.fontHint}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {FONT_STYLE_VALUES.map((value) => (
                        <label
                          key={value}
                          className={`cursor-pointer border bg-white p-3 text-center transition ${
                            fontStyle === value
                              ? 'border-[#a14f17] ring-2 ring-[#a14f17]/15'
                              : 'border-black/10 hover:border-black/25'
                          }`}
                        >
                          <input
                            id={`fontStyle-${value}`}
                            checked={fontStyle === value}
                            className="sr-only"
                            name="fontStyle"
                            onChange={() => setFontStyle(value)}
                            required
                            type="radio"
                            value={value}
                          />
                          <span className={`block text-3xl leading-none ${FONT_STYLE_CLASSES[value].display}`}>Ag</span>
                          <span className="mt-2 block text-[11px] font-semibold text-black/60">{copy.fontLabels[value]}</span>
                        </label>
                      ))}
                    </div>
                    {getFieldError(state, 'fontStyle') && <p className={errorClassName}>{getFieldError(state, 'fontStyle')}</p>}
                  </fieldset>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label={copy.senderName} error={getFieldError(state, 'senderName')}>
                      <input id="senderName" name="senderName" required maxLength={120} autoComplete="name" className={inputClassName} onChange={(event) => setSenderName(event.target.value)} />
                    </Field>
                    {isCustomValue && (
                      <Field label={copy.customAmount} error={getFieldError(state, 'customAmountInput')} hint={giftCard.displayAmount}>
                        <input id="customAmountInput" name="customAmountInput" required inputMode="decimal" placeholder="0.00" className={inputClassName} />
                      </Field>
                    )}
                  </div>
                  <div className="border border-black/10 bg-white/55 p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-[#30372f]">{copy.messageIdeas}</h3>
                    <p className="mt-1 text-xs leading-5 text-black/45">{copy.messageIdeasHint}</p>
                    <div className="mt-3 grid gap-2">
                      {messageIdeas.map((idea) => (
                        <button
                          key={idea}
                          className="group flex w-full flex-col items-start gap-2 border border-black/10 bg-white p-3 text-left transition hover:border-[#a14f17]/50 hover:bg-[#fffaf4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a14f17] sm:flex-row sm:justify-between sm:gap-4"
                          onClick={() => setMessage(idea)}
                          type="button"
                        >
                          <span className="text-sm leading-5 text-black/65">{idea}</span>
                          <span className="shrink-0 self-end text-[10px] font-bold uppercase text-[#a14f17] opacity-70 group-hover:opacity-100">
                            {copy.useMessage}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Field label={copy.message} error={getFieldError(state, 'personalMessage')} hint={`${message.length} / 500`}>
                    <textarea id="personalMessage" name="personalMessage" required maxLength={500} rows={5} className={`${inputClassName} resize-y py-3 ${FONT_STYLE_CLASSES[fontStyle].message}`} onChange={(event) => setMessage(event.target.value)} value={message} />
                  </Field>
                </div>
              </section>

              <section hidden={step !== 3} aria-labelledby="payment-step-title">
                <h2 id="payment-step-title" className="font-serif text-3xl">{copy.paymentTitle}</h2>
                <p className="mt-2 text-sm leading-6 text-black/50">{copy.paymentHint}</p>
                <fieldset className="mt-7">
                  <legend className="sr-only">{copy.paymentTitle}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[...(stripeCardAvailable ? ['card' as const] : []), ...availablePaymentMethods].map((method) => (
                      <label key={method} className="flex min-h-16 cursor-pointer items-center justify-between border border-black/15 bg-white px-4 has-[:checked]:border-[#a14f17] has-[:checked]:ring-2 has-[:checked]:ring-[#a14f17]/15">
                        <span className="text-sm font-semibold">{copy.paymentLabels[method]}</span>
                        <input name="paymentMethod" type="radio" value={method} required className="h-4 w-4 accent-[#a14f17]" />
                      </label>
                    ))}
                  </div>
                  {getFieldError(state, 'paymentMethod') && <p className={errorClassName}>{getFieldError(state, 'paymentMethod')}</p>}
                </fieldset>

                <label className="mt-7 flex cursor-pointer items-start gap-3 border-t border-black/10 pt-6">
                  <input id="consentDelivery" name="consentDelivery" type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#a14f17]" />
                  <span className="text-sm leading-6 text-black/65">{copy.consent}</span>
                </label>
                {getFieldError(state, 'consentDelivery') && <p className={errorClassName}>{getFieldError(state, 'consentDelivery')}</p>}
                <p className="mt-4 text-xs leading-5 text-black/45">
                  {copy.legal}{' '}
                  <Link href={`/${locale}/legal`} target="_blank" className="font-semibold underline">{copy.legalLink}</Link>
                </p>
              </section>

              <div className="mt-10 flex items-center justify-between gap-3 border-t border-black/10 pt-6">
                {step > 1 ? (
                  <button type="button" onClick={() => setStep((current) => current - 1)} className="min-h-12 px-3 text-sm font-semibold text-black/55 hover:text-black">
                    ← {copy.previous}
                  </button>
                ) : <span />}
                {step < 3 ? (
                  <button type="button" onClick={nextStep} className="min-h-12 bg-[#1d211d] px-7 text-sm font-semibold text-white hover:bg-[#30372f]">
                    {copy.continue} →
                  </button>
                ) : (
                  <button type="submit" disabled={isPending} className="min-h-12 bg-[#a14f17] px-7 text-sm font-semibold text-white hover:bg-[#87400f] disabled:opacity-50">
                    {isPending ? copy.submitting : copy.submit}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <aside className="border-t border-black/10 bg-[#1d211d] px-5 py-12 text-white sm:px-8 lg:sticky lg:top-0 lg:h-screen lg:border-l lg:border-t-0 lg:px-12 lg:py-16">
          <div className="mx-auto max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">{copy.previewLabel}</p>
            <p className="mt-2 text-sm leading-6 text-white/50">{copy.previewHint}</p>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-[#dce5d8] p-3 shadow-2xl">
              <div className="overflow-hidden rounded-[20px] bg-[#efeae2]">
                <div className="flex items-center gap-3 bg-[#245c4f] px-4 py-3 text-white">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 font-serif">{merchant.name.charAt(0)}</span>
                  <div>
                    <p className="text-sm font-semibold">{merchant.name}</p>
                    <p className="text-[10px] text-white/60">online</p>
                  </div>
                </div>
                <div className="min-h-[430px] bg-[radial-gradient(circle_at_20%_20%,rgba(42,88,73,0.08)_0_1px,transparent_1px)] bg-[length:18px_18px] p-4">
                  <div className="mt-8 rounded-lg rounded-tl-none bg-white p-2 shadow-sm">
                    <GiftCardPreview
                      copy={copy}
                      design={design}
                      fontStyle={fontStyle}
                      giftCard={giftCard}
                      merchant={merchant}
                      recipientName={recipientName}
                      senderName={senderName}
                      message={message}
                    />
                    <p className="px-1 pb-1 pt-2 text-[11px] leading-4 text-[#3b433d]">
                      {giftCard.title} · {senderName || copy.previewFallbackSender}
                    </p>
                    <p className="text-right text-[9px] text-black/35">12:04 ✓✓</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

type GiftCardPreviewProps = {
  copy: Copy;
  design: (typeof DESIGN_TEMPLATE_VALUES)[number];
  fontStyle: FontStyle;
  giftCard: GiftCardDisplayData;
  merchant: MerchantDisplayData;
  recipientName: string;
  senderName: string;
  message: string;
};

function resolveGiftImage(title: string): string {
  const normalizedTitle = title.toLocaleLowerCase();
  if (normalizedTitle.includes('alcázar') || normalizedTitle.includes('alcazar')) {
    return 'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?auto=format&fit=crop&w=900&q=85';
  }
  if (normalizedTitle.includes('tour') || normalizedTitle.includes('seville')) {
    return 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&w=900&q=85';
  }
  return 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=85';
}

function GiftCardPreview({
  copy,
  design,
  fontStyle,
  giftCard,
  merchant,
  recipientName,
  senderName,
  message,
}: GiftCardPreviewProps) {
  const giftImage = resolveGiftImage(giftCard.title);
  const recipient = recipientName || copy.previewFallbackName;
  const personalMessage = message || copy.previewFallbackMessage;

  return (
    <div className={`relative min-h-[275px] overflow-hidden ${DESIGN_STYLES[design]}`}>
      {design === 'classic' && (
        <>
          <div className="absolute inset-y-0 right-0 w-[38%] bg-cover bg-center grayscale" style={{ backgroundImage: `url(${giftImage})` }} />
          <div className="absolute inset-y-0 right-[38%] w-px bg-[#a14f17]/40" />
          <div className="absolute bottom-5 right-5 h-10 w-10 rounded-full border border-white/60" />
        </>
      )}
      {design === 'warm' && (
        <>
          <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-[#f1bd62]" />
          <div className="absolute bottom-0 right-0 h-[45%] w-full bg-cover bg-center opacity-35 mix-blend-luminosity" style={{ backgroundImage: `url(${giftImage})` }} />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#77321f] to-transparent" />
        </>
      )}
      {design === 'celebration' && (
        <>
          <div className="absolute -right-16 top-8 h-36 w-36 rotate-45 border-[18px] border-[#e0b55f]/80" />
          <div className="absolute right-7 top-7 grid grid-cols-3 gap-2 opacity-70">
            {Array.from({ length: 9 }, (_, index) => <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#f5db8e]" />)}
          </div>
          <div className="absolute bottom-0 right-0 h-28 w-[48%] bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${giftImage})` }} />
        </>
      )}
      {design === 'romantic' && (
        <>
          <div className="absolute inset-0 bg-cover bg-center opacity-35 mix-blend-luminosity" style={{ backgroundImage: `url(${giftImage})` }} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#5c2631] via-[#783642]/90 to-transparent" />
          <div className="absolute right-7 top-7 font-serif text-5xl text-[#eac4b0]/60">&</div>
        </>
      )}
      {design === 'family' && (
        <>
          <div className="absolute -right-5 -top-5 h-40 w-36 rotate-3 border-[7px] border-[#efe7d8] bg-cover bg-center shadow-xl" style={{ backgroundImage: `url(${giftImage})` }} />
          <div className="absolute right-16 top-1 h-5 w-12 -rotate-6 bg-[#d2aa68]/80" />
          <div className="absolute bottom-5 right-6 text-4xl text-[#e6c680]/40">✦</div>
        </>
      )}

      <div className="relative z-10 flex min-h-[275px] flex-col p-5">
        <div className="flex items-center gap-3 text-[8px] font-semibold uppercase tracking-[0.2em] opacity-65">
          <span>{merchant.name}</span>
          <span className="h-px w-7 bg-current opacity-40" />
          <span>{DESIGN_MARKS[design]}</span>
        </div>
        <p className={`mt-7 max-w-[72%] text-2xl leading-tight ${FONT_STYLE_CLASSES[fontStyle].display} ${design === 'classic' ? 'max-w-[58%]' : ''}`}>
          {copy.previewGreeting(recipient)}
        </p>
        <p className={`mt-3 max-w-[72%] text-[11px] leading-4 opacity-80 ${FONT_STYLE_CLASSES[fontStyle].message} ${design === 'classic' ? 'max-w-[58%]' : ''}`}>
          {personalMessage}
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-current/20 pt-3">
          <div>
            <p className={`text-sm opacity-70 ${FONT_STYLE_CLASSES[fontStyle].message}`}>{senderName || copy.previewFallbackSender}</p>
            <p className="mt-1 text-[9px] opacity-50">{copy.validity(giftCard.validDays)}</p>
          </div>
          <span className={`text-xl ${FONT_STYLE_CLASSES[fontStyle].display}`}>{giftCard.displayAmount}</span>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={labelClassName}>
      {label}
      {children}
      {hint && <span className="mt-1.5 block text-xs font-normal text-black/40">{hint}</span>}
      {error && <span className={errorClassName}>{error}</span>}
    </label>
  );
}