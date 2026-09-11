import Image from 'next/image';

import type { DemoAddon } from '@/lib/addons/demo-catalog';

type ProductMockupProps = {
  item: DemoAddon;
  merchantName: string;
  tone: string;
  ink: string;
};

const SEVILLE_ARTWORK_URL = '/images/seville-tours-collage.svg';

const PRODUCT_IMAGE_URL: Partial<Record<DemoAddon['mockup'], string>> = {
  magnet: '/images/seville-magnet.jpg',
  mug: '/images/seville-mug.jpg',
  tshirt: '/images/seville-tshirt.jpg',
};

function BrandMark({ merchantName, compact = false }: { merchantName: string; compact?: boolean }) {
  return (
    <span className="flex flex-col items-center text-center font-semibold uppercase leading-none tracking-[0.14em]">
      <span className={compact ? 'text-[7px]' : 'text-[9px]'}>STC</span>
      {!compact && <span className="mt-1 max-w-20 text-[5px] tracking-[0.08em]">{merchantName}</span>}
    </span>
  );
}

function CeramicPattern({ ink }: { ink: string }) {
  return (
    <span
      className="absolute inset-0 opacity-35"
      style={{
        backgroundImage: [
          `repeating-linear-gradient(45deg, ${ink} 0 1px, transparent 1px 10px)`,
          `repeating-linear-gradient(-45deg, ${ink} 0 1px, transparent 1px 10px)`,
        ].join(', '),
      }}
      aria-hidden="true"
    />
  );
}

function ProductShape({ item, merchantName, tone, ink }: ProductMockupProps) {
  if (item.mockup === 'mug') {
    return (
      <div className="relative h-32 w-44">
        <div className="absolute right-0 top-6 h-20 w-14 rounded-r-full border-[10px] border-[#173c57] bg-transparent" />
        <div
          className="absolute left-1 top-1 flex h-30 w-36 items-center justify-center overflow-hidden rounded-b-2xl border-t-4 border-[#173c57] bg-[#fffdf8] shadow-xl"
        >
          <Image
            src={SEVILLE_ARTWORK_URL}
            alt=""
            width={240}
            height={280}
            className="h-full w-full scale-110 object-contain"
          />
        </div>
      </div>
    );
  }

  if (item.mockup === 'tshirt') {
    return (
      <div
        className="relative flex h-40 w-44 items-center justify-center drop-shadow-xl"
        style={{
          backgroundColor: '#fffdf8',
          clipPath: 'polygon(22% 8%, 38% 0, 62% 0, 78% 8%, 100% 28%, 84% 43%, 75% 34%, 78% 100%, 22% 100%, 25% 34%, 16% 43%, 0 28%)',
        }}
      >
        <span className="absolute left-1/2 top-0 h-8 w-14 -translate-x-1/2 rounded-b-full" style={{ backgroundColor: tone }} />
        <Image
          src={SEVILLE_ARTWORK_URL}
          alt=""
          width={240}
          height={280}
          className="mt-6 h-[82%] w-[70%] object-contain"
        />
      </div>
    );
  }

  if (item.mockup === 'bottle') {
    return (
      <div className="relative flex h-32 w-16 items-center justify-center rounded-b-2xl rounded-t-[1.8rem] shadow-xl" style={{ backgroundColor: ink, color: tone }}>
        <span className="absolute -top-2 h-5 w-8 rounded-t-md" style={{ backgroundColor: ink }} />
        <CeramicPattern ink={tone} />
        <BrandMark merchantName={merchantName} compact />
      </div>
    );
  }

  if (item.mockup === 'tote') {
    return (
      <div className="relative mt-5 flex h-24 w-28 items-center justify-center border shadow-xl" style={{ backgroundColor: ink, borderColor: `${tone}55`, color: tone }}>
        <span className="absolute -top-8 h-12 w-16 rounded-t-full border-4 border-b-0" style={{ borderColor: ink }} />
        <CeramicPattern ink={tone} />
        <BrandMark merchantName={merchantName} />
      </div>
    );
  }

  if (item.mockup === 'coasters') {
    return (
      <div className="relative h-28 w-32">
        {[['left-2', 'top-5', '-rotate-6'], ['right-2', 'top-2', 'rotate-6']].map(([x, y, rotation], index) => (
          <div key={index} className={`absolute ${x} ${y} ${rotation} flex h-20 w-20 items-center justify-center overflow-hidden border-4 shadow-xl`} style={{ backgroundColor: ink, borderColor: tone, color: tone }}>
            <CeramicPattern ink={tone} />
            <BrandMark merchantName={merchantName} compact />
          </div>
        ))}
      </div>
    );
  }

  if (item.mockup === 'magnet' || item.mockup === 'tile') {
    const size = item.mockup === 'magnet' ? 'h-20 w-20' : 'h-28 w-28';
    return (
      <div className={`${size} relative flex rotate-2 items-center justify-center overflow-hidden border-4 shadow-xl`} style={{ backgroundColor: ink, borderColor: tone, color: tone }}>
        <CeramicPattern ink={tone} />
        <BrandMark merchantName={merchantName} compact={item.mockup === 'magnet'} />
      </div>
    );
  }

  if (item.mockup === 'postcards') {
    return (
      <div className="relative h-28 w-36">
        {['-rotate-6 left-0 top-4', 'rotate-3 left-8 top-1', 'rotate-6 right-0 top-5'].map((position, index) => (
          <div key={position} className={`absolute ${position} flex h-20 w-24 items-center justify-center border bg-[#f4ead8] shadow-lg`} style={{ borderColor: `${tone}55`, color: tone }}>
            <span className="font-serif text-2xl">0{index + 1}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative flex h-32 w-24 rotate-2 items-center justify-center border-4 bg-[#f5efe2] p-3 shadow-xl" style={{ borderColor: ink, color: tone }}>
      <CeramicPattern ink={tone} />
      <BrandMark merchantName={merchantName} />
    </div>
  );
}

export function ProductMockup(props: ProductMockupProps) {
  const productImageUrl = PRODUCT_IMAGE_URL[props.item.mockup];

  if (productImageUrl !== undefined) {
    return (
      <div
        className="relative aspect-[5/3] overflow-hidden bg-[#eee7da]"
        role="img"
        aria-label={`${props.item.name.es}, ${props.merchantName}`}
      >
        <Image
          src={productImageUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 82vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition duration-700 group-hover:scale-[1.025]"
        />
        <span className="absolute left-4 top-4 bg-[#fffaf0]/90 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#173c57] shadow-sm backdrop-blur-sm">
          {props.item.motif}
        </span>
      </div>
    );
  }

  return (
    <div
      className="relative flex aspect-[5/3] items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(145deg, ${props.tone}, color-mix(in srgb, ${props.tone} 78%, white))`,
      }}
      role="img"
      aria-label={`${props.item.name.es}, ${props.merchantName}`}
    >
      <span className="absolute -left-10 -top-16 h-40 w-40 rounded-full border opacity-20" style={{ borderColor: props.ink }} />
      <span className="absolute -bottom-20 -right-8 h-44 w-44 rounded-full border opacity-20" style={{ borderColor: props.ink }} />
      <span className="absolute left-4 top-4 text-[9px] font-semibold uppercase tracking-[0.2em] opacity-60" style={{ color: props.ink }}>
        {props.item.motif}
      </span>
      <ProductShape {...props} />
    </div>
  );
}