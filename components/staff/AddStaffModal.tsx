"use client";

import { useCallback, useEffect } from "react";

type AddStaffModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const regions = [
  "Western",
  "Central",
  "Greater Accra",
  "Volta",
  "Eastern",
  "Ashanti",
  "Western North",
  "Ahafo",
  "Bono",
  "Bono East",
  "Oti",
  "Northern",
  "Savannah",
  "North East",
  "Upper East",
  "Upper West",
];

const roles = [
  "Admin",
  "HQ",
  "Regional Statistician",
  "Supervisor",
  "Market Reader",
];

export function AddStaffModal({ isOpen, onClose }: AddStaffModalProps) {
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
    "mt-1 w-full rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60";
  const labelClass =
    "text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl rounded-[2rem] bg-white px-10 py-10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          aria-label="Close modal"
          onClick={onClose}
          className="absolute right-6 top-6 h-10 w-10 rounded-full bg-prism-bg text-prism-text shadow-sm transition hover:shadow-md"
        >
          ×
        </button>

        <h2 className="text-center text-3xl md:text-4xl font-extrabold text-slate-900">
          Add Staff
        </h2>

        <form
          className="mt-8 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const payload = Object.fromEntries(data.entries());
            console.log("Add staff payload", payload);
            onClose();
          }}
        >
          {/* Row 1 */}
          <div>
            <label className={labelClass}>Username</label>
            <input name="username" placeholder="username" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <input
              name="password"
              type="password"
              placeholder="**********"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Contact</label>
            <input name="contact" placeholder="+233" className={fieldClass} />
          </div>

          {/* Row 2 */}
          <div>
            <label className={labelClass}>First Name</label>
            <input name="firstName" placeholder="First Name" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Last Name</label>
            <input name="lastName" placeholder="Last Name" className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Middle Name</label>
            <input name="middleName" placeholder="Middle Name" className={fieldClass} />
          </div>

          {/* Row 3 */}
          <div>
            <label className={labelClass}>Region</label>
            <select name="region" defaultValue="Greater Accra" className={fieldClass}>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select name="role" defaultValue="" className={fieldClass}>
              <option value="" disabled>
                Select Role
              </option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="mt-auto inline-flex w-full items-center justify-center rounded-full bg-[#221B51] px-8 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#312a7a]"
            >
              Add User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
