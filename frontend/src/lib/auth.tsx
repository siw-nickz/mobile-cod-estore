"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type AuthCtx = {
  token: string | null;
  adminToken: string | null;
  setToken: (t: string | null) => void;
  setAdminToken: (t: string | null) => void;
  userName: string | null;
  setUserName: (n: string | null) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [adminToken, setAdminTokenState] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setTokenState(localStorage.getItem("cod_token"));
    setAdminTokenState(localStorage.getItem("cod_admin_token"));
    setUserName(localStorage.getItem("cod_user_name"));
  }, []);

  const setToken = (t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem("cod_token", t);
    else localStorage.removeItem("cod_token");
  };

  const setAdminToken = (t: string | null) => {
    setAdminTokenState(t);
    if (t) localStorage.setItem("cod_admin_token", t);
    else localStorage.removeItem("cod_admin_token");
  };

  useEffect(() => {
    if (userName) localStorage.setItem("cod_user_name", userName);
    else localStorage.removeItem("cod_user_name");
  }, [userName]);

  return (
    <Ctx.Provider value={{ token, adminToken, setToken, setAdminToken, userName, setUserName }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
