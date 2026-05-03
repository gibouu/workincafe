'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Icon } from '@/components/icons/Icon';
import { formatCents } from '@/lib/loyalty/fees';
import { formatCodeForHumans } from '@/lib/loyalty/qr';

export interface Ticket {
  id: string;
  qr_code: string;
  uses_total: number;
  uses_remaining: number;
  title: string;
  amount_paid_cents: number;
  currency: string;
}

export function DealTicketModal({
  ticket,
  onClose,
}: {
  ticket: Ticket;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, ticket.qr_code, {
      width: 240,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    }).catch(() => null);
  }, [ticket.qr_code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ticket.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-float">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-accent">
              Your ticket
            </div>
            <div className="text-[17px] font-semibold text-[var(--text-primary)]">{ticket.title}</div>
            <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
              {ticket.uses_remaining} of {ticket.uses_total} uses remaining ·{' '}
              {formatCents(ticket.amount_paid_cents, ticket.currency)} paid
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-sys-gray-6"
          >
            <Icon name="X" size={14} />
          </button>
        </div>

        <div className="mt-4 flex flex-col items-center rounded-2xl bg-sys-gray-6 p-4">
          <canvas ref={canvasRef} className="rounded-lg bg-white p-2" />
          <div className="mt-3 font-mono text-[18px] tracking-widest text-[var(--text-primary)]">
            {formatCodeForHumans(ticket.qr_code)}
          </div>
          <button
            type="button"
            onClick={copy}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:opacity-80"
          >
            <Icon name={copied ? 'Check' : 'Copy'} size={14} />
            <span>{copied ? 'Copied' : 'Copy code'}</span>
          </button>
        </div>

        <p className="mt-4 text-center text-[12px] text-[var(--text-secondary)]">
          Show this to the café — they&apos;ll scan or type the code. One scan = one use.
        </p>
      </div>
    </div>
  );
}
