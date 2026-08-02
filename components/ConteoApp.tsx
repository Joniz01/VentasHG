"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SesionConteo } from "@/lib/auth";

type ProductoConteo = {
  id: number;
  nombre: string;
  stockSistema: number;
  unidadMedida: string;
  categoriaNombre: string | null;
};

type EntradaConteo = {
  stockContado: string;
  nota: string;
};

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginForm({ onLogin }: { onLogin: (s: SesionConteo) => void }) {
  const [form, setForm] = useState({ usuario: "", clave: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/conteo/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      onLogin(data.conteoUsuario);
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al iniciar sesión");
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--erp-bg, #f5f5f5)",
    }}>
      <div style={{
        background: "var(--erp-surface, #fff)",
        border: "1px solid var(--erp-border, #e5e7eb)",
        borderRadius: "14px",
        padding: "2rem 2.5rem",
        width: "100%",
        maxWidth: "360px",
        boxShadow: "0 4px 24px rgba(0,0,0,.07)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📋</div>
          <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--erp-text, #111)" }}>
            Conteo de Inventario
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--erp-text-2, #6b7280)" }}>
            Inicia sesión para continuar
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input
            type="text"
            placeholder="Usuario"
            value={form.usuario}
            onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))}
            required
            autoComplete="username"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Clave"
            value={form.clave}
            onChange={(e) => setForm((f) => ({ ...f, clave: e.target.value }))}
            required
            autoComplete="current-password"
            style={inputStyle}
          />
          {error && <p style={{ color: "#dc2626", fontSize: "0.8rem", margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={btnPrimaryStyle}>
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── App principal ────────────────────────────────────────────────────────────
export default function ConteoApp() {
  const [sesion, setSesion] = useState<SesionConteo | null | "loading">("loading");
  const [productos, setProductos] = useState<ProductoConteo[]>([]);
  const [entradas, setEntradas] = useState<Record<number, EntradaConteo>>({});
  const [conteoId, setConteoId] = useState<number | null>(null);
  const [fase, setFase] = useState<"contando" | "enviando" | "enviado">("contando");
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [notaConteo, setNotaConteo] = useState("");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verificar sesión al montar
  useEffect(() => {
    fetch("/api/conteo/sesion")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSesion(data?.conteoUsuario ?? null));
  }, []);

  const loadProductos = useCallback(async () => {
    const res = await fetch("/api/conteo/productos");
    if (res.ok) {
      const prods: ProductoConteo[] = await res.json();
      setProductos(prods);
      setEntradas(
        Object.fromEntries(
          prods.map((p) => [p.id, { stockContado: "", nota: "" }])
        )
      );
    }
  }, []);

  useEffect(() => {
    if (sesion && sesion !== "loading") {
      loadProductos();
    }
  }, [sesion, loadProductos]);

  // Crear conteo en borrador automáticamente al entrar
  useEffect(() => {
    if (sesion && sesion !== "loading" && conteoId === null) {
      fetch("/api/conteo/conteos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota: null }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data?.id) setConteoId(data.id); });
    }
  }, [sesion, conteoId]);

  async function handleLogout() {
    await fetch("/api/conteo/auth", { method: "DELETE" });
    setSesion(null);
    setConteoId(null);
    setEntradas({});
    setProductos([]);
    setFase("contando");
  }

  function setEntrada(productoId: number, field: "stockContado" | "nota", value: string) {
    setEntradas((prev) => ({
      ...prev,
      [productoId]: { ...prev[productoId], [field]: value },
    }));

    // Auto-guardar 1.5s después del último cambio
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => autoGuardar(), 1500);
  }

  async function autoGuardar() {
    if (!conteoId) return;
    const items = buildItems();
    if (items.length === 0) return;
    await fetch(`/api/conteo/conteos/${conteoId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  }

  function buildItems() {
    return productos
      .filter((p) => entradas[p.id]?.stockContado !== "")
      .map((p) => ({
        productoId: p.id,
        stockSistema: p.stockSistema,
        stockContado: Number(entradas[p.id]?.stockContado ?? 0),
        nota: entradas[p.id]?.nota || null,
      }));
  }

  async function handleGuardar() {
    if (!conteoId) return;
    setGuardando(true);
    setError("");
    const items = buildItems();
    if (items.length === 0) {
      setError("Debes ingresar al menos un conteo");
      setGuardando(false);
      return;
    }
    const res = await fetch(`/api/conteo/conteos/${conteoId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
    }
    setGuardando(false);
  }

  async function handleEnviar() {
    if (!conteoId) return;
    setEnviando(true);
    setError("");
    // Guardar primero
    const items = buildItems();
    if (items.length === 0) {
      setError("Debes ingresar al menos un conteo antes de enviar");
      setEnviando(false);
      return;
    }
    const saveRes = await fetch(`/api/conteo/conteos/${conteoId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!saveRes.ok) {
      setEnviando(false);
      return;
    }

    // Enviar para aprobación
    const res = await fetch(`/api/conteo/conteos/${conteoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "ENVIAR" }),
    });
    if (res.ok) {
      setFase("enviado");
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al enviar");
    }
    setEnviando(false);
  }

  // ── Estados de carga / login ──
  if (sesion === "loading") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--erp-text-2, #6b7280)" }}>Cargando…</p>
      </div>
    );
  }

  if (!sesion) {
    return <LoginForm onLogin={setSesion} />;
  }

  // ── Enviado ──
  if (fase === "enviado") {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--erp-bg, #f5f5f5)" }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
          <h2 style={{ margin: "0 0 0.5rem", color: "var(--erp-text, #111)" }}>Conteo enviado</h2>
          <p style={{ color: "var(--erp-text-2, #6b7280)", marginBottom: "1.5rem" }}>
            El supervisor revisará y aprobará el conteo pronto.
          </p>
          <button
            type="button"
            onClick={() => { setFase("contando"); setConteoId(null); setEntradas({}); loadProductos(); }}
            style={btnPrimaryStyle}
          >
            Nuevo conteo
          </button>
        </div>
      </div>
    );
  }

  const productosFiltrados = busqueda.trim()
    ? productos.filter((p) =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.categoriaNombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
      )
    : productos;

  const contados = productos.filter((p) => entradas[p.id]?.stockContado !== "").length;

  // Agrupar por categoría
  const grupos = productosFiltrados.reduce<Record<string, ProductoConteo[]>>((acc, p) => {
    const cat = p.categoriaNombre ?? "Sin categoría";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100dvh", background: "var(--erp-bg, #f5f5f5)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        background: "var(--erp-surface, #fff)",
        borderBottom: "1px solid var(--erp-border, #e5e7eb)",
        padding: "0.75rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.25rem" }}>📋</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--erp-text, #111)" }}>Conteo de Inventario</div>
            <div style={{ fontSize: "0.75rem", color: "var(--erp-text-2, #6b7280)" }}>
              {sesion.nombre} · {contados}/{productos.length} contados
            </div>
          </div>
        </div>
        <button type="button" onClick={handleLogout} style={{ fontSize: "0.775rem", color: "var(--erp-text-2)", background: "none", border: "none", cursor: "pointer" }}>
          Cerrar sesión
        </button>
      </header>

      {/* Barra de búsqueda + acciones */}
      <div style={{ padding: "0.75rem 1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", background: "var(--erp-surface, #fff)", borderBottom: "1px solid var(--erp-border, #e5e7eb)" }}>
        <input
          type="search"
          placeholder="Buscar producto o categoría…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ ...inputStyle, flex: "1 1 180px", minWidth: 0 }}
        />
        <button type="button" onClick={handleGuardar} disabled={guardando} style={{ ...btnSecStyle, whiteSpace: "nowrap" }}>
          {guardando ? "Guardando…" : "💾 Guardar borrador"}
        </button>
        <button
          type="button"
          onClick={() => setFase("enviando")}
          disabled={contados === 0}
          style={{ ...btnPrimaryStyle, whiteSpace: "nowrap", opacity: contados === 0 ? 0.5 : 1 }}
        >
          Enviar al supervisor →
        </button>
      </div>

      {error && (
        <div style={{ padding: "0.5rem 1rem", background: "#fee2e2", color: "#991b1b", fontSize: "0.8rem" }}>
          {error}
        </div>
      )}

      {/* Confirmación de envío */}
      {fase === "enviando" && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }}>
          <div style={{ background: "var(--erp-surface, #fff)", borderRadius: "12px", padding: "1.5rem", maxWidth: "380px", width: "100%" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--erp-text)" }}>¿Enviar conteo?</h3>
            <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "var(--erp-text-2)" }}>
              Se registrarán <strong>{contados}</strong> productos contados. El supervisor podrá revisar y aprobar el conteo.
            </p>
            <textarea
              placeholder="Nota opcional para el supervisor…"
              value={notaConteo}
              onChange={(e) => setNotaConteo(e.target.value)}
              rows={2}
              style={{ ...inputStyle, width: "100%", resize: "vertical", marginBottom: "0.75rem", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setFase("contando")} style={btnSecStyle}>Cancelar</button>
              <button type="button" onClick={handleEnviar} disabled={enviando} style={btnPrimaryStyle}>
                {enviando ? "Enviando…" : "Confirmar envío"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de productos */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1rem" }}>
        {Object.entries(grupos).map(([cat, prods]) => (
          <div key={cat} style={{ marginBottom: "1rem" }}>
            <div style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--erp-text-2, #6b7280)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "0.4rem 0",
              borderBottom: "1px solid var(--erp-border, #e5e7eb)",
              marginBottom: "0.4rem",
            }}>
              {cat}
            </div>
            {prods.map((p) => {
              const entrada = entradas[p.id] ?? { stockContado: "", nota: "" };
              const contado = entrada.stockContado !== "" ? Number(entrada.stockContado) : null;
              const diff = contado != null ? contado - p.stockSistema : null;

              return (
                <div key={p.id} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: "0.5rem",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  marginBottom: "0.25rem",
                  background: "var(--erp-surface, #fff)",
                  borderRadius: "8px",
                  border: "1px solid var(--erp-border, #e5e7eb)",
                }}>
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--erp-text)" }}>{p.nombre}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--erp-text-2)" }}>
                      Sistema: <strong style={{ fontVariantNumeric: "tabular-nums" }}>{p.stockSistema}</strong> {p.unidadMedida}
                      {diff != null && (
                        <span style={{
                          marginLeft: "0.5rem",
                          fontWeight: 700,
                          color: diff === 0 ? "#16a34a" : diff > 0 ? "#2563eb" : "#dc2626",
                        }}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Cant."
                    value={entrada.stockContado}
                    onChange={(e) => setEntrada(p.id, "stockContado", e.target.value)}
                    style={{
                      width: "80px",
                      padding: "0.4rem 0.5rem",
                      border: "1px solid var(--erp-border, #e5e7eb)",
                      borderRadius: "6px",
                      fontSize: "0.95rem",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      background: entrada.stockContado !== "" ? "var(--erp-primary-lt, #eff6ff)" : "var(--erp-bg, #f5f5f5)",
                      color: "var(--erp-text)",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Nota"
                    value={entrada.nota}
                    onChange={(e) => setEntrada(p.id, "nota", e.target.value)}
                    style={{
                      width: "100px",
                      padding: "0.4rem 0.5rem",
                      border: "1px solid var(--erp-border, #e5e7eb)",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      background: "var(--erp-bg, #f5f5f5)",
                      color: "var(--erp-text)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        ))}
        {productosFiltrados.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--erp-text-2)", padding: "2rem" }}>Sin resultados</p>
        )}
      </div>
    </div>
  );
}

// ── Estilos reutilizables ─────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  border: "1px solid var(--erp-border, #e5e7eb)",
  borderRadius: "6px",
  fontSize: "0.875rem",
  background: "var(--erp-bg, #f5f5f5)",
  color: "var(--erp-text, #111)",
  outline: "none",
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "var(--erp-primary, #1d4ed8)",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.875rem",
  fontWeight: 600,
};

const btnSecStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "var(--erp-surface, #fff)",
  color: "var(--erp-text, #111)",
  border: "1px solid var(--erp-border, #e5e7eb)",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.875rem",
};
