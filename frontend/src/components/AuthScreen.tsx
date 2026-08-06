import { useState } from "react";
import { motion } from "framer-motion";
import { Anchor, Loader2 } from "lucide-react";
import { useStore } from "../store";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);
  const authBusy = useStore((s) => s.authBusy);
  const authError = useStore((s) => s.authError);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "login") {
      await login(email, password);
    } else {
      await register(email, password, name);
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-bg text-text">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-[340px] flex flex-col gap-4 bg-surface border border-border rounded-lg p-6"
      >
        <div className="flex items-center gap-2 justify-center mb-2">
          <Anchor size={20} className="text-accent" strokeWidth={2.5} />
          <span className="font-display font-semibold text-[16px]">Anchor</span>
        </div>

        <div className="flex bg-surface-raised rounded-md p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 rounded text-[12px] font-medium capitalize transition-colors ${
                mode === m ? "bg-accent text-bg" : "text-text-dim"
              }`}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {mode === "register" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className="bg-surface-raised rounded-md px-3 py-2 text-[13px] outline-none placeholder:text-text-faint focus:ring-1 focus:ring-accent"
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email"
          required
          className="bg-surface-raised rounded-md px-3 py-2 text-[13px] outline-none placeholder:text-text-faint focus:ring-1 focus:ring-accent"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          required
          minLength={mode === "register" ? 8 : undefined}
          className="bg-surface-raised rounded-md px-3 py-2 text-[13px] outline-none placeholder:text-text-faint focus:ring-1 focus:ring-accent"
        />

        {authError && (
          <p className="text-[12px]" style={{ color: "var(--color-status-4xx)" }}>
            {authError}
          </p>
        )}

        <button
          type="submit"
          disabled={authBusy}
          className="flex items-center justify-center gap-2 bg-accent text-bg font-semibold text-[13px] py-2 rounded-md hover:bg-accent-dim transition-colors disabled:opacity-60"
        >
          {authBusy && <Loader2 size={14} className="animate-spin" />}
          {mode === "login" ? "Sign in" : "Create account"}
        </button>
      </motion.form>
    </div>
  );
}
