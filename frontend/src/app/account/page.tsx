"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AccountPage() {
  const { token, setToken, setUserName, userName } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      if (mode === "register") {
        const res = await api.register({
          name: String(fd.get("name")),
          email: String(fd.get("email")),
          password: String(fd.get("password")),
        });
        setToken(res.token);
        setUserName(String(fd.get("name")));
      } else {
        const res = await api.login({
          email: String(fd.get("email")),
          password: String(fd.get("password")),
        });
        setToken(res.token);
        setUserName(res.user.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  if (token) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-3xl">Account</h1>
        <p>Signed in as {userName || "shopper"}.</p>
        <p className="text-sm text-teal-900/60">Cart stays in this browser if you filled it before login.</p>
        <button
          className="rounded-full border border-teal-900/20 px-4 py-2 text-sm"
          onClick={() => {
            setToken(null);
            setUserName(null);
          }}
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">{mode === "login" ? "Log in" : "Register"}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "register" ? (
          <input name="name" required placeholder="Name" className="w-full rounded-xl border px-3 py-2" />
        ) : null}
        <input name="email" type="email" required placeholder="Email" className="w-full rounded-xl border px-3 py-2" />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Password"
          className="w-full rounded-xl border px-3 py-2"
        />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" className="w-full rounded-full bg-brand py-3 font-semibold text-white">
          {mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
      <button className="text-sm underline" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Need an account? Register" : "Have an account? Log in"}
      </button>
    </div>
  );
}
