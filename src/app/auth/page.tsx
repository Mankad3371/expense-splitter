"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AuthPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState("");

  async function handleAuth() {
    setMessage("");

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      window.location.href = "/group";
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Account created! Check your email to confirm your account."
      );
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-md">

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900">
            {isLogin ? "Login" : "Create account"}
          </h1>

          <p className="mt-2 text-gray-600">
            {isLogin
              ? "Login to your expense splitter account."
              : "Create an account to join expense groups."}
          </p>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-black"
            />
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-black"
            />
          </div>

          <button
            type="button"
            onClick={handleAuth}
            className="mt-6 w-full rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
          >
            {isLogin ? "Login" : "Create account"}
          </button>

          {message && (
            <p className="mt-4 rounded-lg bg-gray-100 p-3 text-sm text-gray-700">
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage("");
            }}
            className="mt-5 w-full text-sm font-medium text-gray-700 underline"
          >
            {isLogin
              ? "Don't have an account? Create one"
              : "Already have an account? Login"}
          </button>

        </div>

      </div>
    </main>
  );
}