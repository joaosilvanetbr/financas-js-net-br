import { FormEvent, useState } from "react";
import { DashboardProfile } from "../../../lib/dashboard-api";

type ConfiguracoesTabProps = {
  profile: DashboardProfile | null;
  userEmail: string | null;
  isBusy: boolean;
  pendingAction: string | null;
  onUpdateDisplayName: (name: string) => Promise<{ error?: any }>;
  onUpdateEmail: (username: string) => Promise<{ error?: any }>;
  onUpdatePassword: (password: string) => Promise<{ error?: any }>;
};

export function ConfiguracoesTab({
  profile,
  userEmail,
  isBusy,
  pendingAction,
  onUpdateDisplayName,
  onUpdateEmail,
  onUpdatePassword,
}: ConfiguracoesTabProps) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [newUsername, setNewUsername] = useState(userEmail ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleNameSubmit(event: FormEvent) {
    event.preventDefault();
    if (isBusy) return;
    await onUpdateDisplayName(displayName.trim());
  }

  async function handleUsernameSubmit(event: FormEvent) {
    event.preventDefault();
    if (isBusy) return;
    const username = newUsername.trim();
    if (!username) return;
    await onUpdateEmail(username);
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (isBusy) return;
    if (newPassword.length < 6) return;
    if (newPassword !== confirmPassword) return;
    const result = await onUpdatePassword(newPassword);
    if (!result.error) {
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <section className="tab-panel panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Conta</p>
          <h2>Configuracoes</h2>
        </div>
      </div>

      <div className="settings-grid">
        <form className="settings-card" onSubmit={handleNameSubmit}>
          <div>
            <p className="eyebrow">Perfil</p>
            <h3>Nome exibido</h3>
            <p>Esse nome aparece no topo do app e no menu lateral.</p>
          </div>
          <label>
            Nome
            <input
              value={displayName}
              placeholder="Seu nome"
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <button className="primary-button" disabled={isBusy}>
            {pendingAction === "profile" ? "Salvando..." : "Salvar nome"}
          </button>
        </form>

        <form className="settings-card" onSubmit={handleUsernameSubmit}>
          <div>
            <p className="eyebrow">Acesso</p>
            <h3>Usuario</h3>
            <p>Troque seu nome de usuario para acessar o sistema.</p>
          </div>
          <label>
            Novo usuario
            <input
              type="text"
              value={newUsername}
              placeholder="Seu novo usuario"
              onChange={(e) => setNewUsername(e.target.value)}
            />
          </label>
          <button className="primary-button" disabled={isBusy}>
            {pendingAction === "email" ? "Salvando..." : "Atualizar usuario"}
          </button>
        </form>

        <form className="settings-card" onSubmit={handlePasswordSubmit}>
          <div>
            <p className="eyebrow">Seguranca</p>
            <h3>Senha</h3>
            <p>Use pelo menos 6 caracteres e confirme a nova senha.</p>
          </div>
          <label>
            Nova senha
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            Confirmar senha
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          <button className="primary-button" disabled={isBusy}>
            {pendingAction === "password" ? "Atualizando..." : "Atualizar senha"}
          </button>
        </form>
      </div>
    </section>
  );
}
