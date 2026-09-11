import type { Locale } from '@/lib/i18n/config';

/**
 * D1 fake-door demo only. Not the production add-on model.
 * See docs/PRD/ParaUsted_PRD_v1_2_Change_Pack_AddOns_and_Offers.md §9 for the real schema.
 */

export type DemoAddon = {
  id: string;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  priceCents: number;
  motif: string;
  mockup: 'magnet' | 'coasters' | 'tile' | 'mug' | 'bottle' | 'tshirt' | 'tote' | 'print' | 'postcards';
};

export type DemoAddonCollection = {
  id: string;
  name: Record<Locale, string>;
  tagline: Record<Locale, string>;
  tone: string;
  ink: string;
  items: readonly DemoAddon[];
};

export type AddonCopy = {
  sectionLabel: string;
  title: string;
  description: string;
  curationNote: string;
  countLabel: (collections: number, pieces: number) => string;
  browseLabel: string;
  brandedEdition: (merchantName: string) => string;
  fulfilmentLegend: string;
  pickupLabel: string;
  pickupHint: string;
  shipLabel: string;
  shipHint: string;
  comingSoon: string;
  previewNotice: string;
};

/**
 * Merchant-facing noun per vertical. A merchant-level override wins over this
 * map in the production model; D1 has no merchant override yet.
 */
const ADDON_CATEGORY_LABEL: Record<string, Record<Locale, string>> = {
  tour: { es: 'Recuerdo', en: 'Souvenir' },
  barber: { es: 'Producto', en: 'Product' },
  restaurant: { es: 'Detalle', en: 'Extra' },
  gym: { es: 'Equipación', en: 'Gear' },
  school: { es: 'Material', en: 'Supplies' },
  other: { es: 'Extra', en: 'Extra' },
};

const FALLBACK_CATEGORY_LABEL: Record<Locale, string> = { es: 'Extra', en: 'Extra' };

/**
 * Themed on the Real Alcázar so the keepsakes read as the companion to the
 * Alcázar guided-tour gift card this merchant already sells.
 */
const TOUR_DEMO_COLLECTIONS: readonly DemoAddonCollection[] = [
  {
    id: 'alcazar-ceramica',
    name: { es: 'Cerámica del Alcázar', en: 'Alcázar ceramics' },
    tagline: {
      es: 'Azulejo esmaltado a mano, el oficio que viste el Real Alcázar desde el siglo XIV.',
      en: 'Hand-glazed azulejo, the craft that has dressed the Royal Alcázar since the 14th century.',
    },
    tone: '#173b36',
    ink: '#f4ead8',
    items: [
      {
        id: 'demo-alcazar-magnet',
        name: { es: 'Imán de azulejo del Real Alcázar', en: 'Royal Alcázar azulejo magnet' },
        description: {
          es: 'Cerámica esmaltada con el motivo del Patio de las Doncellas, personalizada con su nombre y la fecha.',
          en: 'Glazed ceramic with the Patio de las Doncellas motif, personalised with their name and date.',
        },
        priceCents: 600,
        motif: 'AZULEJO',
        mockup: 'magnet',
      },
      {
        id: 'demo-alcazar-coasters',
        name: { es: 'Posavasos de azulejo · set de 2', en: 'Azulejo coasters · set of 2' },
        description: {
          es: 'Dos piezas con la geometría mudéjar del Salón de Embajadores, base de corcho natural.',
          en: 'Two pieces with the Mudéjar geometry of the Salón de Embajadores, natural cork backing.',
        },
        priceCents: 1600,
        motif: 'SET DE 2',
        mockup: 'coasters',
      },
      {
        id: 'demo-alcazar-tile',
        name: { es: 'Azulejo enmarcado 15 × 15', en: 'Framed azulejo 15 × 15' },
        description: {
          es: 'Reproducción enmarcada en madera, numerada a mano y lista para colgar.',
          en: 'Wood-framed reproduction, hand-numbered and ready to hang.',
        },
        priceCents: 2400,
        motif: '15 × 15',
        mockup: 'tile',
      },
    ],
  },
  {
    id: 'alcazar-mesa',
    name: { es: 'Mesa y café', en: 'Table & coffee' },
    tagline: {
      es: 'Para que el Alcázar vuelva a aparecer cada mañana, a 2.000 km de Sevilla.',
      en: 'So the Alcázar shows up again every morning, 2,000 km from Seville.',
    },
    tone: '#6c2f2a',
    ink: '#fff7ec',
    items: [
      {
        id: 'demo-alcazar-mug',
        name: { es: 'Taza de marca «Sevilla»', en: 'Branded "Seville" mug' },
        description: {
          es: 'Cerámica de 350 ml con una fotografía de la Plaza de España, la marca del operador y la fecha de su visita.',
          en: '350 ml ceramic with a Plaza de España photograph, the tour operator brand and their visit date.',
        },
        priceCents: 1400,
        motif: '350 ML',
        mockup: 'mug',
      },
      {
        id: 'demo-alcazar-bottle',
        name: { es: 'Botella térmica «Sevilla»', en: '"Sevilla" insulated bottle' },
        description: {
          es: 'Acero inoxidable de 500 ml, grabada con el plano del casco antiguo. Útil desde el primer día de calor.',
          en: '500 ml stainless steel, engraved with the old town map. Useful from the first hot day.',
        },
        priceCents: 2200,
        motif: '500 ML',
        mockup: 'bottle',
      },
    ],
  },
  {
    id: 'alcazar-textil',
    name: { es: 'Textil', en: 'Textile' },
    tagline: {
      es: 'Algodón orgánico estampado bajo demanda. Solo se produce lo que alguien pide.',
      en: 'Organic cotton printed on demand. Nothing is made until someone asks for it.',
    },
    tone: '#251d1a',
    ink: '#f4ead8',
    items: [
      {
        id: 'demo-alcazar-tshirt',
        name: { es: 'Camiseta de marca «Sevilla»', en: 'Branded "Seville" T-shirt' },
        description: {
          es: 'Algodón orgánico de 180 g con la Plaza de España y la firma de Seville Tours Co.',
          en: '180 g organic cotton with Plaza de España and the Seville Tours Co. signature.',
        },
        priceCents: 2400,
        motif: 'ALGODÓN ORG.',
        mockup: 'tshirt',
      },
      {
        id: 'demo-alcazar-tote',
        name: { es: 'Tote de lino «Patio de las Doncellas»', en: '"Patio de las Doncellas" linen tote' },
        description: {
          es: 'Lino natural con asa larga, serigrafiado con el motivo del patio principal.',
          en: 'Natural linen with a long strap, screen-printed with the main courtyard motif.',
        },
        priceCents: 1400,
        motif: 'LINO',
        mockup: 'tote',
      },
    ],
  },
  {
    id: 'alcazar-papel',
    name: { es: 'Láminas y papel', en: 'Prints & paper' },
    tagline: {
      es: 'Impreso en Sevilla sobre papel de algodón, numerado a mano.',
      en: 'Printed in Seville on cotton paper, numbered by hand.',
    },
    tone: '#d8cab0',
    ink: '#24322d',
    items: [
      {
        id: 'demo-route-print',
        name: { es: 'Lámina «Mi Sevilla»', en: '"Mi Sevilla" route print' },
        description: {
          es: 'Mapa ilustrado A5 con el recorrido de su tour marcado a mano por el guía.',
          en: 'A5 illustrated map with their tour route marked by hand by the guide.',
        },
        priceCents: 1200,
        motif: 'EDICIÓN A5',
        mockup: 'print',
      },
      {
        id: 'demo-alcazar-print',
        name: { es: 'Lámina «Patio de las Doncellas»', en: '"Patio de las Doncellas" print' },
        description: {
          es: 'Ilustración A4 a dos tintas del patio más fotografiado del Alcázar.',
          en: 'Two-ink A4 illustration of the most photographed courtyard in the Alcázar.',
        },
        priceCents: 1800,
        motif: 'EDICIÓN A4',
        mockup: 'print',
      },
      {
        id: 'demo-postcards',
        name: { es: 'Set de 4 postales', en: 'Set of 4 postcards' },
        description: {
          es: 'Cuatro rincones del Alcázar en papel de algodón, con sobres de kraft.',
          en: 'Four corners of the Alcázar on cotton paper, with kraft envelopes.',
        },
        priceCents: 800,
        motif: 'SET DE 4',
        mockup: 'postcards',
      },
    ],
  },
];

/** D1 ships behind a server-only flag, disabled by default. */
export function isAddonDemoEnabled(): boolean {
  return process.env.ADDONS_DEMO_ENABLED === 'true';
}

export function getAddonCategoryLabel(category: string, locale: Locale): string {
  return (ADDON_CATEGORY_LABEL[category] ?? FALLBACK_CATEGORY_LABEL)[locale];
}

/** Tour is the only piloted vertical in D1. Every other category returns null. */
export function getDemoAddonCollections(category: string): readonly DemoAddonCollection[] | null {
  if (!isAddonDemoEnabled() || category !== 'tour') {
    return null;
  }

  return TOUR_DEMO_COLLECTIONS;
}

export function countAddonPieces(collections: readonly DemoAddonCollection[]): number {
  return collections.reduce((total, collection) => total + collection.items.length, 0);
}

export const ADDON_COPY: Record<Locale, AddonCopy> = {
  es: {
    sectionLabel: 'Añade un detalle',
    title: 'Y algo para recordarlo.',
    description:
      'Piezas hechas o impresas en Sevilla que acompañan al regalo. Nunca sustituyen la experiencia.',
    curationNote:
      'Selección ampliada para esta vista previa. Cada negocio publicará una selección corta.',
    countLabel: (collections, pieces) => `${collections} colecciones · ${pieces} piezas`,
    browseLabel: 'Explora por colección',
    brandedEdition: (merchantName) => `Edición ${merchantName}`,
    fulfilmentLegend: '¿Cómo quieres recibirlo?',
    pickupLabel: 'Recogida en el punto de encuentro',
    pickupHint: 'Te lo entrega tu guía el día de la experiencia.',
    shipLabel: 'Envío a casa',
    shipHint: 'Lo enviamos a la dirección que nos indiques.',
    comingSoon: 'Próximamente',
    previewNotice:
      'Vista previa. Los detalles todavía no están a la venta y no se cobra nada por ellos.',
  },
  en: {
    sectionLabel: 'Add a keepsake',
    title: 'And something to remember it by.',
    description:
      'Pieces made or printed in Seville that travel with the gift. They never replace the experience.',
    curationNote:
      'Extended selection for this preview. Each business will publish a short selection.',
    countLabel: (collections, pieces) => `${collections} collections · ${pieces} pieces`,
    browseLabel: 'Browse by collection',
    brandedEdition: (merchantName) => `${merchantName} edition`,
    fulfilmentLegend: 'How would you like to receive it?',
    pickupLabel: 'Pick up at the meeting point',
    pickupHint: 'Your guide hands it to you on the day of the experience.',
    shipLabel: 'Home delivery',
    shipHint: 'We post it to the address you give us.',
    comingSoon: 'Coming soon',
    previewNotice:
      'Preview only. Keepsakes are not on sale yet and nothing is charged for them.',
  },
};
