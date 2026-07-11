"use client";

import { useEffect, useCallback } from "react";
import clsx from "clsx";

type AddItemModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function AddItemModal({ isOpen, onClose }: AddItemModalProps) {
  const handleBackdropClick = () => onClose();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const fieldClass =
    "mt-1 w-full rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30 outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-6xl rounded-[2rem] bg-white px-10 py-10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute right-6 top-6 h-10 w-10 rounded-full bg-prism-bg text-prism-text shadow-sm transition hover:shadow-md"
        >
          ×
        </button>

        <h2 className="mb-8 text-center text-4xl font-extrabold uppercase text-prism-text">
          Add ITEM
        </h2>

        <form
          className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            onClose();
          }}
        >
          {/* Left column */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Name</label>
              <input className={fieldClass} placeholder="enter item name" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Imp Local</label>
              <input className={fieldClass} placeholder="*******" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Volatility Category</label>
              <select className={clsx(fieldClass, "bg-white")}>
                <option value="">select category</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Core 3</label>
              <input className={fieldClass} placeholder="*******" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">COICOP08</label>
              <input className={fieldClass} placeholder="*******" />
            </div>
          </div>

          {/* Middle column */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Code</label>
              <input className={fieldClass} placeholder="Item code" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Goods &amp; Services</label>
              <input className={fieldClass} placeholder="*********" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Core 1</label>
              <input className={fieldClass} placeholder="*******" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Core 4</label>
              <input className={fieldClass} placeholder="*******" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">UoM Non Standardized</label>
              <input className={fieldClass} placeholder="*******" />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Brand</label>
              <select className={clsx(fieldClass, "bg-white")}>
                <option value="">Select Brand</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Durability Category</label>
              <select className={clsx(fieldClass, "bg-white")}>
                <option value="">select category</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Core 2</label>
              <input className={fieldClass} placeholder="*******" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">COICOP06</label>
              <input className={fieldClass} placeholder="*******" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Standardized</label>
              <input className={fieldClass} placeholder="*******" />
            </div>
          </div>

          {/* Description full width */}
          <div className="md:col-span-3">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <input className={fieldClass} placeholder="Item description" />
          </div>

          {/* Footer button */}
          <div className="md:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-full bg-[#221B51] px-8 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 hover:translate-y-[-1px]"
            >
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
