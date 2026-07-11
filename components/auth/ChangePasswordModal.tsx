"use client";

import { FormEvent, useState } from "react";

type Props = {
  onClose: () => void;
};

export function ChangePasswordModal({ onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message || "Failed to change password.");
      } else {
        setSuccess("Password updated. Please sign in again.");
        setTimeout(() => {
          onClose();
          window.location.assign("/");
        }, 900);
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-prism-text">Change password</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-prism-bg text-prism-text shadow-sm transition hover:shadow-md"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-prism-text outline-none focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/30"
              required
            />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}
          {success && <p className="text-xs text-emerald-600">{success}</p>}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[#221B51] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
