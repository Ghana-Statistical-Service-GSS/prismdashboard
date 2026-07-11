"use client";

import { useCallback, useEffect, useState } from "react";

type DecisionMode = "approve" | "reject";

type DecisionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  itemName?: string;
  mode: DecisionMode | null;
  itemId?: number;
};

export function DecisionModal({
  isOpen,
  onClose,
  itemName,
  mode,
  itemId,
}: DecisionModalProps) {
  const [comment, setComment] = useState("");

  const close = useCallback(() => {
    setComment("");
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    },
    [close]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !mode) return null;

  const isApprove = mode === "approve";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-prism-text">
              {isApprove ? "Approve Item" : "Reject Item"}
            </h3>
            {itemName && (
              <p className="mt-1 text-sm text-prism-muted">Item: {itemName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close modal"
            className="h-9 w-9 rounded-full bg-prism-bg text-prism-text shadow-sm transition hover:shadow-md"
          >
            ×
          </button>
        </div>

        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const payload = {
              id: itemId,
              comment,
              action: mode,
            };
            console.log("Decision", payload);
            close();
          }}
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Comment (optional)
            </label>
            <textarea
              className="mt-2 w-full rounded-2xl border border-prism-border bg-white px-3 py-2 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note for this decision"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-prism-border px-4 py-2 text-sm font-semibold text-prism-text transition hover:bg-prism-bg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                isApprove
                  ? "bg-teal-500 hover:brightness-105"
                  : "bg-rose-500 hover:brightness-105"
              }`}
            >
              {isApprove ? "Approve" : "Reject"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
