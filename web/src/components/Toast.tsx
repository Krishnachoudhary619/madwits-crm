"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: number; message: string; tone: "ok" | "err" };

const ToastContext = createContext<(message: string, tone?: "ok" | "err") => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-80 flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto rounded-md border px-3 py-2 text-sm shadow ${
              item.tone === "err"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-line bg-white text-charcoal"
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
