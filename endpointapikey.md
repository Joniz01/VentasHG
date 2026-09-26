# Endpoint Unificado de IA — Diseño e Implementación

Un único endpoint `/api/ai` que enruta peticiones a Anthropic, Google Gemini o Groq con soporte de fallback automático, hasta 4 API keys por proveedor y panel de administración integrado.

---

## Tabla de Contenidos

1. [Estructura de la base de datos](#1-estructura-de-la-base-de-datos)
2. [Endpoint principal](#2-endpoint-principal)
3. [Lógica de fallback](#3-lógica-de-fallback)
4. [Panel de administración](#4-panel-de-administración)
5. [Interfaz de admin — componente React](#5-interfaz-de-admin--componente-react)
6. [Tipos TypeScript](#6-tipos-typescript)
7. [Variables de entorno recomendadas](#7-variables-de-entorno-recomendadas)

---

## 1. Estructura de la base de datos

```sql
-- Tabla principal de configuración de proveedores IA
CREATE TABLE ai_providers (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(50) NOT NULL,          -- 'anthropic' | 'gemini' | 'groq'
  activo        BOOLEAN DEFAULT TRUE,
  orden_prioridad INT DEFAULT 1,               -- 1 = primario, 2 = primer fallback, etc.
  modelo_default VARCHAR(100) NOT NULL,        -- modelo a usar por defecto
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Hasta 4 API keys por proveedor
CREATE TABLE ai_api_keys (
  id            SERIAL PRIMARY KEY,
  provider_id   INT REFERENCES ai_providers(id) ON DELETE CASCADE,
  slot          INT NOT NULL CHECK (slot BETWEEN 1 AND 4),  -- slot 1..4
  api_key       TEXT NOT NULL,                -- la key cifrada
  activa        BOOLEAN DEFAULT TRUE,
  ultimo_uso    TIMESTAMPTZ,
  ultimo_error  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider_id, slot)
);

-- Semilla de proveedores
INSERT INTO ai_providers (nombre, orden_prioridad, modelo_default) VALUES
  ('anthropic', 1, 'claude-sonnet-4-6'),
  ('gemini',    2, 'gemini-2.0-flash'),
  ('groq',      3, 'llama-3.3-70b-versatile');
```

> **Nota**: Las API keys se almacenan cifradas con `LLM_ENCRYPTION_KEY` (AES-256-GCM). Nunca en texto plano.

---

## 2. Endpoint principal

### `POST /api/ai`

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "¿Cuál es el precio del producto X?" }
  ],
  "system": "Eres un asistente de ventas.",   // opcional
  "maxTokens": 1024,                          // opcional, default 1024
  "temperature": 0.7                          // opcional, default 0.7
}
```

**Response:**
```json
{
  "content": "El producto X cuesta $15.00.",
  "provider": "anthropic",
  "modelo": "claude-sonnet-4-6",
  "fallback": false
}
```

### Implementación

```typescript
// app/api/ai/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

interface Message { role: "user" | "assistant"; content: string }

interface AIRequest {
  messages: Message[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

// ── Adaptadores por proveedor ─────────────────────────────────────────────────

async function callAnthropic(apiKey: string, modelo: string, req: AIRequest): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: req.maxTokens ?? 1024,
      system: req.system,
      messages: req.messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text as string;
}

async function callGemini(apiKey: string, modelo: string, req: AIRequest): Promise<string> {
  const contents = req.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const systemInstruction = req.system ? { parts: [{ text: req.system }] } : undefined;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: req.maxTokens ?? 1024,
          temperature: req.temperature ?? 0.7,
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text as string;
}

async function callGroq(apiKey: string, modelo: string, req: AIRequest): Promise<string> {
  const messages = req.system
    ? [{ role: "system", content: req.system }, ...req.messages]
    : req.messages;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelo,
      messages,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.7,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content as string;
}

const CALLERS: Record<string, (key: string, modelo: string, req: AIRequest) => Promise<string>> = {
  anthropic: callAnthropic,
  gemini: callGemini,
  groq: callGroq,
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AIRequest;

  if (!body.messages?.length) {
    return NextResponse.json({ error: "messages requerido" }, { status: 400 });
  }

  // Obtener proveedores ordenados por prioridad
  const providers = await pool.query<{
    id: number; nombre: string; modelo_default: string; orden_prioridad: number;
  }>(
    `SELECT id, nombre, modelo_default, orden_prioridad
     FROM ai_providers WHERE activo = TRUE
     ORDER BY orden_prioridad ASC`
  );

  if (providers.rows.length === 0) {
    return NextResponse.json({ error: "Sin proveedores IA configurados" }, { status: 503 });
  }

  let lastError = "";
  let fallbackUsed = false;

  for (const provider of providers.rows) {
    // Obtener keys activas del proveedor (hasta 4, ordenadas por slot)
    const keys = await pool.query<{ id: number; slot: number; api_key: string }>(
      `SELECT id, slot, api_key FROM ai_api_keys
       WHERE provider_id = $1 AND activa = TRUE
       ORDER BY slot ASC`,
      [provider.id]
    );

    for (const keyRow of keys.rows) {
      try {
        const plainKey = decrypt(keyRow.api_key);
        const caller = CALLERS[provider.nombre];
        if (!caller) continue;

        const content = await caller(plainKey, provider.modelo_default, body);

        // Registrar uso exitoso
        await pool.query(
          `UPDATE ai_api_keys SET ultimo_uso = NOW(), ultimo_error = NULL WHERE id = $1`,
          [keyRow.id]
        );

        return NextResponse.json({
          content,
          provider: provider.nombre,
          modelo: provider.modelo_default,
          fallback: fallbackUsed,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = msg;
        // Registrar error en la key
        await pool.query(
          `UPDATE ai_api_keys SET ultimo_error = $1 WHERE id = $2`,
          [msg.slice(0, 500), keyRow.id]
        );
        // Intentar siguiente key del mismo proveedor
      }
    }

    // Todas las keys del proveedor fallaron → marcar fallback y pasar al siguiente
    fallbackUsed = true;
  }

  return NextResponse.json(
    { error: "Todos los proveedores fallaron", detalle: lastError },
    { status: 502 }
  );
}
```

---

## 3. Lógica de fallback

```
Intento 1: Proveedor prioridad 1 (ej. Anthropic)
  → Key slot 1 → falla → Key slot 2 → falla → Key slot 3 → falla → Key slot 4 → falla
  ↓ (todas las keys del proveedor fallaron)
Intento 2: Proveedor prioridad 2 (ej. Gemini)
  → Key slot 1 → OK ✓ → responde con fallback: true
```

- Dentro de un proveedor se rotan las keys (slots 1→2→3→4) en orden.
- Si un proveedor falla por completo, pasa automáticamente al siguiente según `orden_prioridad`.
- El campo `fallback: true` en la respuesta indica que no respondió el proveedor primario.
- Los errores se guardan en `ai_api_keys.ultimo_error` para diagnóstico en el panel.

---

## 4. Panel de administración

### `GET /api/ai/admin` — Leer configuración

```typescript
// app/api/ai/admin/route.ts
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";

export async function GET() {
  const providers = await pool.query(
    `SELECT p.id, p.nombre, p.activo, p.orden_prioridad, p.modelo_default,
            json_agg(
              json_build_object(
                'id', k.id, 'slot', k.slot,
                'activa', k.activa,
                'tieneKey', k.api_key IS NOT NULL,
                'ultimoUso', k.ultimo_uso,
                'ultimoError', k.ultimo_error
              ) ORDER BY k.slot
            ) FILTER (WHERE k.id IS NOT NULL) AS keys
     FROM ai_providers p
     LEFT JOIN ai_api_keys k ON k.provider_id = p.id
     GROUP BY p.id ORDER BY p.orden_prioridad`
  );
  // Nunca devolver las keys en texto plano
  return NextResponse.json(providers.rows);
}
```

### `POST /api/ai/admin` — Guardar/actualizar key

```typescript
export async function POST(request: Request) {
  const { providerId, slot, apiKey, activa } = await request.json();

  if (!providerId || !slot || slot < 1 || slot > 4) {
    return NextResponse.json({ error: "providerId y slot (1-4) requeridos" }, { status: 400 });
  }

  if (apiKey) {
    // Upsert de la key cifrada
    const cifrada = encrypt(apiKey.trim());
    await pool.query(
      `INSERT INTO ai_api_keys (provider_id, slot, api_key, activa)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider_id, slot)
       DO UPDATE SET api_key = $3, activa = $4, ultimo_error = NULL`,
      [providerId, slot, cifrada, activa ?? true]
    );
  } else if (activa !== undefined) {
    // Solo cambiar estado activa sin tocar la key
    await pool.query(
      `UPDATE ai_api_keys SET activa = $1 WHERE provider_id = $2 AND slot = $3`,
      [activa, providerId, slot]
    );
  }

  return NextResponse.json({ ok: true });
}
```

### `POST /api/ai/admin/test` — Probar una key específica

```typescript
// app/api/ai/admin/test/route.ts
export async function POST(request: Request) {
  const { providerId, slot } = await request.json();

  const row = await pool.query(
    `SELECT k.api_key, p.nombre, p.modelo_default
     FROM ai_api_keys k JOIN ai_providers p ON p.id = k.provider_id
     WHERE k.provider_id = $1 AND k.slot = $2`,
    [providerId, slot]
  );

  if (!row.rows[0]) {
    return NextResponse.json({ error: "Key no encontrada" }, { status: 404 });
  }

  const { api_key, nombre, modelo_default } = row.rows[0];
  const caller = CALLERS[nombre as string];

  try {
    const plainKey = decrypt(api_key as string);
    const respuesta = await caller(plainKey, modelo_default as string, {
      messages: [{ role: "user", content: "Responde solo: ok" }],
      maxTokens: 10,
    });
    await pool.query(
      `UPDATE ai_api_keys SET ultimo_uso = NOW(), ultimo_error = NULL
       WHERE provider_id = $1 AND slot = $2`,
      [providerId, slot]
    );
    return NextResponse.json({ ok: true, respuesta, proveedor: nombre, modelo: modelo_default });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await pool.query(
      `UPDATE ai_api_keys SET ultimo_error = $1 WHERE provider_id = $2 AND slot = $3`,
      [msg.slice(0, 500), providerId, slot]
    );
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
```

### `PATCH /api/ai/admin/providers` — Cambiar prioridad / modelo

```typescript
// app/api/ai/admin/providers/route.ts
export async function PATCH(request: Request) {
  const { id, orden_prioridad, modelo_default, activo } = await request.json();

  await pool.query(
    `UPDATE ai_providers
     SET orden_prioridad = COALESCE($2, orden_prioridad),
         modelo_default  = COALESCE($3, modelo_default),
         activo          = COALESCE($4, activo)
     WHERE id = $1`,
    [id, orden_prioridad ?? null, modelo_default ?? null, activo ?? null]
  );

  return NextResponse.json({ ok: true });
}
```

---

## 5. Interfaz de admin — componente React

```tsx
// components/AIAdminPanel.tsx
"use client";
import { useEffect, useState } from "react";

type KeyInfo = {
  id: number; slot: number; activa: boolean;
  tieneKey: boolean; ultimoUso: string | null; ultimoError: string | null;
};
type Provider = {
  id: number; nombre: string; activo: boolean;
  orden_prioridad: number; modelo_default: string;
  keys: KeyInfo[] | null;
};

const MODELOS: Record<string, string[]> = {
  anthropic: ["claude-opus-5", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  gemini:    ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro"],
  groq:      ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
};

export default function AIAdminPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [keyInput, setKeyInput] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  async function load() {
    const res = await fetch("/api/ai/admin");
    setProviders(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function saveKey(providerId: number, slot: number) {
    const k = `${providerId}-${slot}`;
    const val = keyInput[k]?.trim();
    if (!val) return;
    setSaving((s) => ({ ...s, [k]: true }));
    await fetch("/api/ai/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId, slot, apiKey: val }),
    });
    setKeyInput((prev) => ({ ...prev, [k]: "" }));
    await load();
    setSaving((s) => ({ ...s, [k]: false }));
  }

  async function toggleKey(providerId: number, slot: number, activa: boolean) {
    await fetch("/api/ai/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId, slot, activa }),
    });
    await load();
  }

  async function testKey(providerId: number, slot: number) {
    const k = `${providerId}-${slot}`;
    setTestResult((r) => ({ ...r, [k]: { ok: false, msg: "Probando..." } }));
    const res = await fetch("/api/ai/admin/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId, slot }),
    });
    const data = await res.json();
    setTestResult((r) => ({
      ...r, [k]: { ok: data.ok, msg: data.ok ? `✓ ${data.respuesta}` : `✗ ${data.error}` },
    }));
  }

  async function updateProvider(id: number, patch: Partial<Provider>) {
    await fetch("/api/ai/admin/providers", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    await load();
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h2 style={{ marginBottom: 24 }}>Configuración de Proveedores IA</h2>

      {providers.map((prov) => (
        <div key={prov.id} style={{
          border: "1px solid #e2e8f0", borderRadius: 10,
          padding: 20, marginBottom: 20,
          opacity: prov.activo ? 1 : 0.6,
        }}>
          {/* Cabecera del proveedor */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <h3 style={{ margin: 0, textTransform: "capitalize" }}>{prov.nombre}</h3>
            <span style={{
              padding: "2px 8px", borderRadius: 12, fontSize: 12,
              background: prov.activo ? "#dcfce7" : "#fee2e2",
              color: prov.activo ? "#166534" : "#991b1b",
            }}>
              {prov.activo ? "Activo" : "Inactivo"}
            </span>
            <span style={{ fontSize: 13, color: "#64748b" }}>
              Prioridad {prov.orden_prioridad}
            </span>
            <button onClick={() => updateProvider(prov.id, { activo: !prov.activo })}
              style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 6,
                border: "1px solid #cbd5e1", cursor: "pointer", fontSize: 13 }}>
              {prov.activo ? "Desactivar" : "Activar"}
            </button>
          </div>

          {/* Modelo y prioridad */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>Modelo</label>
              <select value={prov.modelo_default}
                onChange={(e) => updateProvider(prov.id, { modelo_default: e.target.value })}
                style={{ display: "block", padding: "4px 8px", borderRadius: 6,
                  border: "1px solid #cbd5e1", marginTop: 2 }}>
                {(MODELOS[prov.nombre] ?? []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>Prioridad (orden fallback)</label>
              <select value={prov.orden_prioridad}
                onChange={(e) => updateProvider(prov.id, { orden_prioridad: Number(e.target.value) })}
                style={{ display: "block", padding: "4px 8px", borderRadius: 6,
                  border: "1px solid #cbd5e1", marginTop: 2 }}>
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Slots de API keys (1-4) */}
          <div style={{ display: "grid", gap: 10 }}>
            {[1, 2, 3, 4].map((slot) => {
              const k = `${prov.id}-${slot}`;
              const keyInfo = prov.keys?.find((kk) => kk.slot === slot);
              const tr = testResult[k];
              return (
                <div key={slot} style={{
                  background: "#f8fafc", borderRadius: 8, padding: 12,
                  border: "1px solid #e2e8f0",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                      Key #{slot}
                    </span>
                    {keyInfo?.tieneKey && (
                      <span style={{
                        fontSize: 11, padding: "1px 6px", borderRadius: 10,
                        background: keyInfo.activa ? "#dcfce7" : "#fee2e2",
                        color: keyInfo.activa ? "#166534" : "#991b1b",
                      }}>
                        {keyInfo.activa ? "Activa" : "Inactiva"}
                      </span>
                    )}
                    {keyInfo?.ultimoUso && (
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        Último uso: {new Date(keyInfo.ultimoUso).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {keyInfo?.ultimoError && (
                    <div style={{ fontSize: 11, color: "#dc2626", marginBottom: 6,
                      background: "#fee2e2", padding: "4px 8px", borderRadius: 4 }}>
                      {keyInfo.ultimoError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="password"
                      placeholder={keyInfo?.tieneKey ? "••••••• (reemplazar)" : "Pegar API key..."}
                      value={keyInput[k] ?? ""}
                      onChange={(e) => setKeyInput((prev) => ({ ...prev, [k]: e.target.value }))}
                      style={{ flex: 1, padding: "6px 10px", borderRadius: 6,
                        border: "1px solid #cbd5e1", fontSize: 13 }}
                    />
                    <button onClick={() => saveKey(prov.id, slot)}
                      disabled={!keyInput[k]?.trim() || saving[k]}
                      style={{ padding: "6px 14px", borderRadius: 6, border: "none",
                        background: "#1d4ed8", color: "#fff", fontSize: 13, cursor: "pointer",
                        opacity: !keyInput[k]?.trim() || saving[k] ? 0.5 : 1 }}>
                      {saving[k] ? "..." : "Guardar"}
                    </button>
                    {keyInfo?.tieneKey && (
                      <>
                        <button onClick={() => testKey(prov.id, slot)}
                          style={{ padding: "6px 14px", borderRadius: 6,
                            border: "1px solid #cbd5e1", fontSize: 13, cursor: "pointer" }}>
                          Probar
                        </button>
                        <button
                          onClick={() => toggleKey(prov.id, slot, !keyInfo.activa)}
                          style={{ padding: "6px 14px", borderRadius: 6,
                            border: "1px solid #cbd5e1", fontSize: 13, cursor: "pointer" }}>
                          {keyInfo.activa ? "Pausar" : "Reactivar"}
                        </button>
                      </>
                    )}
                  </div>

                  {tr && (
                    <div style={{ fontSize: 12, marginTop: 6,
                      color: tr.ok ? "#166534" : "#dc2626" }}>
                      {tr.msg}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 6. Tipos TypeScript

```typescript
// lib/ai-types.ts

export type AIProvider = "anthropic" | "gemini" | "groq";

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  modelo: string;
  fallback: boolean;
}
```

### Utilidad de cifrado (`lib/crypto.ts`)

```typescript
import crypto from "crypto";

const KEY = Buffer.from(process.env.LLM_ENCRYPTION_KEY!, "hex"); // 32 bytes = 64 hex chars

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(stored: string): string {
  const [ivHex, tagHex, encHex] = stored.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
```

---

## 7. Variables de entorno recomendadas

```env
# Clave de 32 bytes (64 caracteres hex) para cifrar las API keys en BD
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
LLM_ENCRYPTION_KEY=<64_hex_chars>

# Las API keys NO van aquí — se almacenan en la BD cifradas
# Solo LLM_ENCRYPTION_KEY va como variable de entorno en Vercel
```

---

## Resumen de rutas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/ai` | Inferencia con fallback automático |
| `GET` | `/api/ai/admin` | Leer proveedores y estado de keys |
| `POST` | `/api/ai/admin` | Guardar/actualizar una API key |
| `POST` | `/api/ai/admin/test` | Probar una key específica |
| `PATCH` | `/api/ai/admin/providers` | Cambiar modelo, prioridad o estado de un proveedor |

---

## Flujo completo

```
Cliente → POST /api/ai
           │
           ▼
    ┌─────────────────────────────────────┐
    │  Proveedor 1 (prioridad 1)          │
    │  Key slot 1 → falla                 │
    │  Key slot 2 → falla                 │
    │  Key slot 3 → OK ✓ → responde       │
    └─────────────────────────────────────┘
           │ (si TODAS las keys fallan)
           ▼
    ┌─────────────────────────────────────┐
    │  Proveedor 2 (prioridad 2, fallback)│
    │  Key slot 1 → OK ✓ → responde       │
    │  (fallback: true en respuesta)      │
    └─────────────────────────────────────┘
           │ (si TODOS los proveedores fallan)
           ▼
    HTTP 502 — todos los proveedores fallaron
```
