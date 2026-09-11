'use client';

import { useState } from 'react';

type VoucherShareActionsLabels = {
  shareViaWhatsApp: string;
  copyLink: string;
  linkCopied: string;
  printPdf: string;
};

type VoucherShareActionsProps = {
  whatsAppUrl: string;
  voucherUrl: string;
  labels: VoucherShareActionsLabels;
};

export function VoucherShareActions({
  whatsAppUrl,
  voucherUrl,
  labels,
}: VoucherShareActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(voucherUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable (e.g. non-HTTPS context); silently ignore
    }
  }

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <a
        href={whatsAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#1f7a4d] px-5 text-sm font-semibold text-white transition hover:bg-[#19643f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f7a4d] focus-visible:ring-offset-2"
      >
        {labels.shareViaWhatsApp}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex min-h-11 items-center justify-center gap-2 border border-black/15 bg-transparent px-5 text-sm font-semibold text-[#30372f] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a4b18] focus-visible:ring-offset-2"
      >
        {copied ? labels.linkCopied : labels.copyLink}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex min-h-11 items-center justify-center gap-2 border border-black/15 bg-transparent px-5 text-sm font-semibold text-[#30372f] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a4b18] focus-visible:ring-offset-2"
      >
        {labels.printPdf}
      </button>
    </div>
  );
}
