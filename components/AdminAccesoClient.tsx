"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Props = {
  nombre: string;
  usuario: string;
};

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

function PasswordInput({
  label, value, onChange, required, autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          minLength={6}
          style={{
            width: "100%",
            padding: "0.4rem 2.4rem 0.4rem 0.65rem",
            border: "1px solid var(--erp-border)",
            borderRadius: "6px",
            background: "var(--erp-bg)",
            color: "var(--erp-text)",
            fontSize: "0.875rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          tabIndex={-1}
          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--erp-text-3)" }}
          aria-label={show ? "Ocultar clave" : "Ver clave"}
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
}

export default function AdminAccesoClient({ nombre, usuario }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openForm() {
    setShowForm(true);
    setError(null);
    setSuccess(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function closeForm() {
    setShowForm(false);
    setError(null);
    setSuccess(null);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/usuarios/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "No se pudo cambiar la contraseña");
      }
      setSuccess("Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => { setShowForm(false); setSuccess(null); }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/admin");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 480 }}>
      {/* User info card with action buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: "0.9rem 1rem",
          border: "1px solid var(--erp-border)",
          borderRadius: "8px",
          background: "var(--erp-surface)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          <span style={{ fontSize: "0.875rem", color: "var(--erp-text)" }}>
            <strong>Nombre:</strong> {nombre}
          </span>
          <span style={{ fontSize: "0.875rem", color: "var(--erp-text)" }}>
            <strong>Usuario:</strong> {usuario}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={showForm ? closeForm : openForm}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.4rem 0.9rem",
              background: showForm ? "transparent" : "var(--erp-primary)",
              color: showForm ? "var(--erp-text-2)" : "#fff",
              border: `1px solid ${showForm ? "var(--erp-border)" : "var(--erp-primary)"}`,
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.825rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            🔑 {showForm ? "Cancelar" : "Cambiar contraseña"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: "0.4rem 0.9rem",
              background: "transparent",
              color: "var(--erp-text-2)",
              border: "1px solid var(--erp-border)",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.825rem",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Collapsible password form */}
      {showForm && (
        <div
          style={{
            border: "1px solid var(--erp-border)",
            borderRadius: "8px",
            padding: "1rem",
            background: "var(--erp-surface)",
          }}
        >
          <h3 style={{ margin: "0 0 0.85rem 0", fontSize: "0.95rem", fontWeight: 600, color: "var(--erp-text)" }}>
            Cambiar contraseña
          </h3>
          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <PasswordInput
              label="Contraseña actual"
              value={currentPassword}
              onChange={setCurrentPassword}
              required
              autoComplete="current-password"
            />
            <PasswordInput
              label="Nueva contraseña"
              value={newPassword}
              onChange={setNewPassword}
              required
              autoComplete="new-password"
            />
            <PasswordInput
              label="Confirmar nueva contraseña"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              autoComplete="new-password"
            />

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.5rem 0.75rem", color: "#b91c1c", fontSize: "0.825rem" }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "0.5rem 0.75rem", color: "#166534", fontSize: "0.825rem" }}>
                {success}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "0.4rem 1.1rem",
                  background: "var(--erp-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Guardando..." : "Confirmar cambio"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                style={{
                  padding: "0.4rem 1rem",
                  background: "transparent",
                  color: "var(--erp-text-2)",
                  border: "1px solid var(--erp-border)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
