'use client';

import type { ReactNode } from 'react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: 'default' | 'danger';
  confirmDisabled?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  confirmVariant = 'default',
  confirmDisabled,
  loading,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) return null;

  const confirmClassName =
    confirmVariant === 'danger'
      ? 'bg-[#7a2a1d] text-white'
      : 'bg-[#6f7f6a] text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-[520px] rounded-[var(--winey-radius)] border border-[color:var(--winey-border)] bg-white shadow-[var(--winey-shadow-lg)]">
        <div className="border-b border-[color:var(--winey-border)] px-5 py-4">
          <p className="text-[14px] font-semibold">{title}</p>
          {description ? <div className="mt-1 text-[12px] text-[color:var(--winey-muted)]">{description}</div> : null}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border)] bg-white px-3 py-1.5 text-[12px] font-semibold shadow-[var(--winey-shadow-sm)]"
            disabled={!!loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-[var(--winey-radius-sm)] border border-[color:var(--winey-border-strong)] px-3 py-1.5 text-[12px] font-semibold shadow-[var(--winey-shadow-sm)] disabled:opacity-50 ${confirmClassName}`}
            disabled={!!loading || !!confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


