"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAuth() {
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    setSubmitting(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setSubmitting(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace("/groups");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      setSubmitting(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Account created! Check your email to confirm your account.");
    }
  }

  const isSuccess = message.startsWith("Account created!");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f8fb] px-5 py-12 text-slate-900">
      {/* Decorative wave background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg
          className="absolute left-0 top-0 h-full w-full"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M-120 210C120 90 280 330 520 210C760 90 920 90 1160 210C1400 330 1560 90 1800 210" stroke="#10B981" strokeOpacity="0.15" strokeWidth="2" />
          <path d="M-120 250C120 130 280 370 520 250C760 130 920 130 1160 250C1400 370 1560 130 1800 250" stroke="#10B981" strokeOpacity="0.13" strokeWidth="2" />
          <path d="M-120 290C120 170 280 410 520 290C760 170 920 170 1160 290C1400 410 1560 170 1800 290" stroke="#10B981" strokeOpacity="0.11" strokeWidth="2" />
          <path d="M-120 650C120 530 280 770 520 650C760 530 920 530 1160 650C1400 770 1560 530 1800 650" stroke="#0F172A" strokeOpacity="0.095" strokeWidth="2" />
          <path d="M-120 690C120 570 280 810 520 690C760 570 920 570 1160 690C1400 810 1560 570 1800 690" stroke="#0F172A" strokeOpacity="0.085" strokeWidth="2" />
          <circle cx="180" cy="170" r="150" fill="#10B981" fillOpacity="0.085" />
          <circle cx="1290" cy="720" r="210" fill="#10B981" fillOpacity="0.08" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <a href="/" className="text-2xl font-bold tracking-tight text-slate-950">
            Expense<span className="text-emerald-600">Splitter</span>
          </a>
          <p className="mt-2 text-sm text-slate-500">Shared expenses, made simple.</p>
        </div>

        {/* Auth card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-7 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-9">
          <div className="mb-7">
            <div className="mb-4 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {isLogin ? "WELCOME BACK" : "GET STARTED"}
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              {isLogin ? "Login" : "Create account"}
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {isLogin
                ? "Login to your expense splitter account."
                : "Create an account to join expense groups."}
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleAuth();
            }}
          >
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>

            <div className="mt-5">
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-7 flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Please wait..." : isLogin ? "Login" : "Create account"}
            </button>
          </form>

          {message && (
            <div
              role="status"
              className={`mt-5 rounded-xl border p-4 text-sm leading-6 ${
                isSuccess
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {message}
            </div>
          )}

          <div className="mt-7 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-slate-500">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
            </p>
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage("");
              }}
              className="mt-2 text-sm font-bold text-emerald-700 transition hover:text-emerald-800"
            >
              {isLogin ? "Create an account" : "Login instead"}
            </button>
          </div>

          <a
            href="/"
            className="mt-6 block text-center text-sm font-medium text-slate-400 transition hover:text-slate-700"
          >
            ← Back to homepage
          </a>
        </div>

        <p className="mt-7 text-center text-xs text-slate-400">
          Expense Splitter · Manage shared expenses effortlessly.
        </p>
      </div>
    </main>
  );
}
