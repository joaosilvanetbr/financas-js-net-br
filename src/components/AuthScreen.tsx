import { FormEvent, useState } from "react";
import { Landmark } from "lucide-react";
import { useAuth } from "../context/AuthContext";

type MessageTone = "info" | "success" | "error";

const messageStyles: Record<MessageTone, Record<string, string>> = {
  error: {
    background: "rgba(214, 51, 108, 0.12)",
    color: "#d6336c",
    border: "1px solid rgba(214, 51, 108, 0.25)",
  },
  success: {
    background: "rgba(47, 158, 68, 0.12)",
    color: "#2f9e44",
    border: "1px solid rgba(47, 158, 68, 0.25)",
  },
  info: {
    background: "rgba(25, 113, 194, 0.12)",
    color: "#1971c2",
    border: "1px solid rgba(25, 113, 194, 0.25)",
  },
};

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");
  const [busy, setBusy] = useState(false);

  function showMessage(text: string, tone: MessageTone) {
    setMessage(text);
    setMessageTone(tone);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!username.trim() || password.length < 6) {
      showMessage("Informe um usuario e senha com pelo menos 6 caracteres.", "error");
      return;
    }

    setBusy(true);
    const action = mode === "login" ? signIn : signUp;
    const result = await action(username.trim(), password);
    setBusy(false);

    if (result.error) {
      showMessage(result.error, "error");
      return;
    }

    if (mode === "signup") {
      showMessage("Conta criada com sucesso!", "success");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
          <div className="brand-mark">
            <Landmark size={24} />
          </div>
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Financas</p>
            <h1 style={{ margin: 0, fontSize: "1.5rem" }}>
              {mode === "login" ? "Entrar" : "Criar conta"}
            </h1>
          </div>
        </div>

        <p style={{ color: "var(--muted)", margin: "8px 0 20px" }}>
          {mode === "login"
            ? "Acesse seu controle financeiro pessoal."
            : "Comece a controlar suas financas hoje."}
        </p>

        <div className="segmented" role="tablist" aria-label="Modo de autenticacao">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => { setMode("login"); setMessage(""); }}
            role="tab"
            aria-selected={mode === "login"}
            type="button"
          >
            Entrar
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => { setMode("signup"); setMessage(""); }}
            role="tab"
            aria-selected={mode === "signup"}
            type="button"
          >
            Cadastrar
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Usuario
            <input
              type="text"
              placeholder="Seu nome de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              autoComplete="username"
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              placeholder="Minimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          <button
            className="primary-button"
            type="submit"
            disabled={busy}
            style={{ width: "100%", marginTop: "4px" }}
          >
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>

          {message && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontWeight: 600,
                ...messageStyles[messageTone],
              }}
            >
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
