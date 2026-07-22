"use client";

// app/page.tsx
import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error?.message || "Unable to sign in.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("The authentication service is unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-10 px-6 md:flex-row md:gap-16 lg:gap-20">
          {/* PRISM identity */}
          <div className="w-72 sm:w-80 md:w-[390px]">
            <Image
              src="/Prism-logo.png"
              alt="PRISM-Ghana — Price Index System Monitor"
              width={1254}
              height={1254}
              sizes="(max-width: 768px) 288px, 390px"
              className="h-auto w-full select-none object-contain"
              priority
            />
          </div>

          {/* Right login block */}
          <div className="flex w-full max-w-[360px] flex-col">
            <h1 className="text-4xl font-extrabold tracking-tight text-black">Sign in to PRISM</h1>
            <p className="mb-5 mt-1 text-sm font-semibold text-prism-muted">Price Index System Monitor</p>

            <form className="w-full space-y-4" onSubmit={handleSubmit}>
              {/* Username */}
              <div className="space-y-1">
                <label
                  htmlFor="username"
                  className="text-xs font-medium text-prism-muted"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@statsghana.gov.gh"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-full border border-prism-border bg-white px-4 py-2 text-sm text-prism-text outline-none placeholder:text-gray-300 focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/40"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label
                  htmlFor="password"
                  className="text-xs font-medium text-prism-muted"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="************"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-full border border-prism-border bg-white px-4 py-2 text-sm text-prism-text outline-none placeholder:text-gray-300 focus:border-prism-purple focus:ring-2 focus:ring-prism-purple/40"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600" role="alert">
                  {error}
                </p>
              )}

              {/* Login button */}
              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full rounded-full bg-prism-purple py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-sm hover:bg-prism-purple-dark transition"
              >
                {loading ? "Signing in..." : "Login"}
              </button>
            </form>
          </div>
        </div>

      </div>
    </main>
  );
}
