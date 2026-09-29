"use client";

import { useEffect, useRef, useState } from "react";

type Extra = { id: number; nombre: string; precioAdicional: number };
type Producto = { id: number; nombre: string; precioVenta: number; categoriaNombre: string | null; lineaNombre: string | null; extras: Extra[]; extrasCount: number; imagenUrl: string | null; tipoProducto: string; variadaRaciones: number; tipoEmpaqueId: number | null; tipoEmpaqueNombre: string | null };
type Motorizado = { id: number; nombre: string; apellido: string };
type LineaCarrito = { uid: string; productoId: number; nombre: string; precio: number; qty: number; extraId: number | null; extraNombre: string | null; extraPrecio: number; variadaSelecciones: string[] };
type Theme = "dark" | "light" | "azul" | "beige";
type Borrador = {
  id: string;
  nombre: string;
  savedAt: string;
  carrito: LineaCarrito[];
  pagos: { metodo: string; monto: string }[];
  entrega: "LOCAL" | "DELIVERY" | "PICKUP";
  direccion: string;
  horaEntrega: string;
  fechaEntrega: string;
  clienteNombre: string;
  clienteApellido: string;
  clienteCi: string;
  clienteTel: string;
  costoDelivery: string;
  total: number;
};
type AgendaItem = { productoId: number; cantidad: number; extraId?: number | null; nombre: string; precio: number };
type AgendaPedido = {
  id: number;
  cliente: string | null;
  clienteTelefono: string | null;
  items: AgendaItem[];
  totalUsd: number;
  recordatorioAt: string;
  entregaAt: string | null;
  minsPreparacion: number;
  minsRetiro: number;
  estado: "pendiente" | "confirmada" | "cancelada";
  alertaCobroDisparada: boolean;
  alertaPreparacionDisparada: boolean;
  alertaRetiroDisparada: boolean;
  ventaId: number | null;
};
type HistVenta = {
  id: number;
  fecha: string;
  cliente: string;
  items: { nombreProducto: string; cantidad: number; precioUnit: number; extraNombre: string | null; extraPrecio: number }[];
  pagos: { metodo: string; monto: number }[];
  modoEntrega: string;
  pedidoEntregado: boolean;
  cuentaPorCobrar: boolean;
  cuentaCobrada: boolean;
  tasaDelDia: number;
};

const HIST_COLS = [
  { key: "pedido",   label: "Pedido #" },
  { key: "fecha",    label: "Fecha" },
  { key: "cliente",  label: "Cliente" },
  { key: "productos",label: "Productos" },
  { key: "total",    label: "Total" },
  { key: "entrega",  label: "Entrega" },
  { key: "cobro",    label: "Cobro" },
] as const;
type HistCol = typeof HIST_COLS[number]["key"];
const ALL_HIST_COLS = HIST_COLS.map((c) => c.key) as HistCol[];

const METODO_LABEL: Record<string, string> = {
  EFECTIVO_BS: "Bs", PUNTO_VENTA: "Punto", PAGO_MOVIL: "P.Móvil",
  EFECTIVO_USD: "USD", CASHEA: "Cashea", CXC_DIRECTA: "CxC",
};

let _uid = 0;
function uid() { return `c${++_uid}`; }
function fmt(n: number) { return `$${n.toFixed(2)}`; }
function fmtBs(n: number, tasa: number) {
  return `Bs ${(n * tasa).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function today() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" }); }

const PAY_OPTS = [
  { key: "EFECTIVO_BS",  label: "Efectivo Bs", icon: "💵" },
  { key: "PUNTO_VENTA",  label: "Punto",        icon: "💳" },
  { key: "PAGO_MOVIL",   label: "Pago Móvil",   icon: "📱" },
  { key: "EFECTIVO_USD", label: "USD Cash",      icon: "💲" },
  { key: "CASHEA",       label: "Cashea",        icon: "📋" },
  { key: "CXC_DIRECTA",  label: "CxC",           icon: "🤝" },
] as const;

const CXP_METHODS = ["CASHEA", "CXC_DIRECTA"];

const THEMES: { key: Theme; label: string; icon: string; swatch: [string, string] }[] = [
  { key: "dark",  label: "Oscuro",  icon: "🌑", swatch: ["#1C1C1E", "#C8960C"] },
  { key: "light", label: "Claro",   icon: "☀️", swatch: ["#ffffff", "#C8960C"] },
  { key: "azul",  label: "Azul",    icon: "🔷", swatch: ["#1A3A5C", "#3A9BD5"] },
  { key: "beige", label: "Hechizo", icon: "🪙", swatch: ["#1A1A1A", "#D4A84A"] },
];

const THEME_VARS: Record<Theme, string> = {
  dark: `--bg:#F5F2ED;--surface:#FFF;--topbar:#1C1C1E;--tb-text:#ccc;--tb-border:#2e2e2e;
         --dk:#242426;--dk2:#2E2E30;--dk3:#383838;
         --accent:#C8960C;--al:rgba(200,150,12,.13);--ab:#D4A820;
         --text:#1C1C1E;--t2:#78786E;--t3:#AEAE9E;--border:#E8E4DC;
         --tt:#F0EDE8;--tt2:#888880;--tt3:#555550;--tl:#343434;
         --catbg:#1C1C1E;--cattext:#fff;--bs:#7ec8ff;--bbg:#F8F7F4;--bborder:#E0DDD8;`,
  light: `--bg:#F0F0EE;--surface:#FFF;--topbar:#FFF;--tb-text:#444;--tb-border:#E0E0DC;
          --dk:#FFF;--dk2:#F5F5F3;--dk3:#E8E8E5;
          --accent:#C8960C;--al:rgba(200,150,12,.1);--ab:#D4A820;
          --text:#1C1C1E;--t2:#78786E;--t3:#AEAE9E;--border:#E0DDD8;
          --tt:#1C1C1E;--tt2:#78786E;--tt3:#AEAE9E;--tl:#E0DDD8;
          --catbg:#1C1C1E;--cattext:#fff;--bs:#1A6FA8;--bbg:#FAFAF8;--bborder:#E0DDD8;`,
  azul: `--bg:#EBF2FA;--surface:#FFF;--topbar:#1A3A5C;--tb-text:#BDD5EE;--tb-border:#142E48;
         --dk:#D8EDF8;--dk2:#C8E3F4;--dk3:#B8D8F0;
         --accent:#3A9BD5;--al:rgba(58,155,213,.15);--ab:#4AAEE0;
         --text:#1A2A3A;--t2:#4A6A8A;--t3:#7A9AB8;--border:#C5D9EC;
         --tt:#1A2A3A;--tt2:#4A6A8A;--tt3:#7A9AB8;--tl:#B5CEEA;
         --catbg:#1A3A5C;--cattext:#BDD5EE;--bs:#7ec8ff;--bbg:#EBF2FA;--bborder:#B5CEEA;`,
  beige: `--bg:#FEF9F0;--surface:#FFF;--topbar:#1A1A1A;--tb-text:#D4A84A;--tb-border:#111;
          --dk:#3D2B1A;--dk2:#4A3520;--dk3:#5A4228;
          --accent:#C8960C;--al:rgba(200,150,12,.15);--ab:#D4A820;
          --text:#1A1A1A;--t2:#5C3A1E;--t3:#A07040;--border:#F0DEB8;
          --tt:#F5EAD8;--tt2:#9A7A5A;--tt3:#6A4A2A;--tl:#2E1C0E;
          --catbg:#1A1A1A;--cattext:#D4A84A;--bs:#F0C860;--bbg:#FAF3E8;--bborder:#EDD5A8;`,
};

const CSS = `
html,body{height:100%;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:14px}
*,*::before,*::after{box-sizing:border-box}
button,input{font-family:inherit}
button{cursor:pointer}

.pos{display:flex;flex-direction:column;height:100vh;background:var(--bg)}

/* ── Topbar ── */
.topbar{background:var(--topbar);color:var(--tb-text);height:44px;display:flex;align-items:center;gap:12px;padding:0 14px;flex-shrink:0;border-bottom:1px solid var(--tb-border)}
.tb-brand{font-weight:700;font-size:12px;color:var(--accent);letter-spacing:.06em;text-transform:uppercase}
.tb-sep{color:var(--tb-border)}
.tb-title{font-size:12px;font-weight:600;color:var(--tb-text);text-decoration:none;display:inline-flex;align-items:center;gap:4px;border:1px solid var(--tb-border);border-radius:20px;padding:3px 10px;transition:opacity .15s,background .15s}
.tb-title:hover{opacity:.85;background:rgba(255,255,255,.08)}
.tb-space{flex:1}
.tb-btn{padding:4px 10px;border-radius:5px;border:1px solid var(--tb-border);background:rgba(255,255,255,.06);color:var(--tb-text);font-size:12px;font-weight:500;display:flex;align-items:center;gap:4px;transition:all .15s;white-space:nowrap}
.tb-btn:hover{background:rgba(255,255,255,.12)}
.tb-btn.active{border-color:var(--ab);color:var(--accent)}
.tema-wrap{position:relative}
.tema-dd{position:absolute;right:0;top:calc(100% + 6px);width:148px;background:var(--topbar);border:1px solid var(--tb-border);border-radius:8px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.45);z-index:200}
.tema-item{display:flex;align-items:center;gap:7px;padding:7px 11px;font-size:12px;color:var(--tb-text);background:none;border:none;width:100%;text-align:left;cursor:pointer;transition:background .12s}
.tema-item:hover{background:rgba(255,255,255,.08)}
.tema-item.active{color:var(--accent);font-weight:600}
.tema-swatch{width:14px;height:14px;border-radius:3px;flex-shrink:0}
.tb-clock{font-size:12px;color:var(--tt3)}
/* ── Historial panel ── */
.hist-panel{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--bg);overflow:hidden;border-right:1px solid var(--border)}
.hist-head{padding:8px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0;border-bottom:1px solid var(--border)}
.hist-title{font-size:14px;font-weight:600;color:var(--text)}
.hist-search{flex:1;padding:5px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text);outline:none;transition:border-color .15s}
.hist-search:focus{border-color:var(--accent)}
.hist-search::placeholder{color:var(--t3)}
.hist-table{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--border) transparent}
.hist-table table{width:100%;border-collapse:collapse;font-size:12px}
.hist-table th{padding:6px 10px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--t3);background:var(--bbg);border-bottom:1px solid var(--border);white-space:nowrap;position:sticky;top:0}
.hist-table td{padding:7px 10px;border-bottom:1px solid var(--bborder);color:var(--text);vertical-align:top}
.hist-table tr:hover td{background:rgba(0,0,0,.025)}
.hist-btn{padding:3px 8px;border-radius:5px;border:1px solid var(--border);background:var(--surface);color:var(--t2);font-size:11px;cursor:pointer;transition:all .15s;white-space:nowrap}
.hist-btn:hover{border-color:var(--ab);color:var(--accent)}
.hist-badge-ok{display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;background:#dcfce7;color:#16a34a}
.hist-badge-pend{display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;background:#fef9c3;color:#ca8a04}
.hist-badge-cxc{display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;background:#dbeafe;color:#1d4ed8}
.hist-date{padding:4px 7px;border:1.5px solid var(--border);border-radius:5px;font-size:12px;background:var(--surface);color:var(--text);outline:none;transition:border-color .15s}
.hist-date:focus{border-color:var(--accent)}
.hist-cols-wrap{position:relative}
.hist-cols-dd{position:absolute;right:0;top:calc(100% + 4px);width:160px;background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.15);z-index:200;padding:4px 0}
.hist-cols-item{display:flex;align-items:center;gap:7px;padding:6px 12px;font-size:12px;color:var(--text);cursor:pointer;transition:background .1s}
.hist-cols-item:hover{background:var(--al)}

/* ── Pedido view (tab virtual en modoAgenda) ── */
.pedido-view{display:flex;flex-direction:column;gap:0;overflow-y:auto;flex:1;min-height:0;padding:8px 12px}
.pedido-row{display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--tl)}
.pedido-row:last-child{border-bottom:none}
.pedido-nombre{flex:1;font-size:13px;font-weight:500;color:var(--tt)}
.pedido-precio{font-size:12px;color:var(--t2);white-space:nowrap}
.pedido-subtotal{font-size:13px;font-weight:700;color:var(--accent);white-space:nowrap;min-width:60px;text-align:right}
.pedido-qty{display:flex;align-items:center;gap:4px}
.pedido-qty-btn{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--tl);background:none;color:var(--tt);font-size:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-weight:700;flex-shrink:0}
.pedido-qty-btn:hover{border-color:var(--ab);color:var(--accent)}
.pedido-qty-num{font-size:13px;font-weight:700;min-width:18px;text-align:center}
.pedido-empty{padding:32px 0;text-align:center;color:var(--t3);font-size:12px}
.cat-pill.pedido-pill{background:var(--al);color:var(--accent);border-color:var(--accent);font-weight:700}
.cat-pill.pedido-pill.active{background:var(--accent);color:#1c1c1e}

/* ── Body split ── */
.pos-body{flex:1;display:flex;min-height:0;overflow:hidden}

/* ── LEFT PANEL ── */
.left-panel{flex:1;min-width:360px;display:flex;flex-direction:column;background:var(--bg);overflow:hidden;border-right:1px solid var(--border)}

/* Catalog top */
.cat-head{padding:8px 14px 0;display:flex;flex-direction:column;gap:6px;flex-shrink:0}
.search-wrap{position:relative}
.s-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--t3);font-size:13px;pointer-events:none}
.search-input{width:100%;padding:7px 10px 7px 28px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;background:var(--surface);color:var(--text);outline:none;transition:border-color .15s}
.search-input:focus{border-color:var(--accent)}
.search-input::placeholder{color:var(--t3)}
.cats{display:flex;gap:5px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}
.cats::-webkit-scrollbar{display:none}
.cat-pill{flex-shrink:0;padding:4px 11px;border-radius:20px;font-size:12px;font-weight:500;border:1.5px solid var(--border);background:var(--surface);color:var(--t2);transition:all .15s;white-space:nowrap}
.cat-pill.active{background:var(--catbg);color:var(--cattext);border-color:var(--catbg)}

/* Product grid */
.product-grid{flex:1;overflow-y:auto;padding:6px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;align-content:start;scrollbar-width:thin;scrollbar-color:var(--border) transparent}
.p-card{background:var(--surface);border:1.5px solid var(--border);border-radius:9px;overflow:hidden;cursor:pointer;transition:border-color .15s,box-shadow .15s;user-select:none;position:relative}
.p-card:hover{border-color:var(--ab);box-shadow:0 2px 8px rgba(0,0,0,.08)}
.p-card.in-cart{border-color:var(--ab)}
.p-card.expanded{border-color:var(--ab);box-shadow:0 3px 12px rgba(0,0,0,.12)}
.p-thumb{width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--bg) 0%,var(--border) 100%);position:relative;font-size:12px;font-weight:700;color:var(--t2);letter-spacing:.03em;text-align:center;padding:4px}
.p-badge{position:absolute;top:4px;right:4px;background:var(--accent);color:#fff;font-size:10px;font-weight:700;width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.p-info{padding:6px 8px}
.p-name{font-size:12px;font-weight:500;color:var(--text);line-height:1.25;margin-bottom:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.p-row{display:flex;align-items:center;justify-content:space-between;gap:4px}
.p-price{font-size:13px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
.p-opts-tag{font-size:10px;color:var(--accent);font-weight:600}
.p-extras-overlay{position:absolute;inset:0;z-index:20;background:var(--dk);border:1.5px solid var(--ab);border-radius:9px;padding:7px 8px 8px;display:flex;flex-direction:column;gap:5px}
.p-extras-label{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--t3)}
.p-extras-wrap{display:flex;flex-wrap:wrap;gap:4px;flex:1;align-content:flex-start}
.p-extra-btn{padding:3px 8px;border-radius:5px;border:1.5px solid var(--border);background:var(--surface);color:var(--t2);font-size:11px;font-weight:500;transition:all .15s}
.p-extra-btn:hover{border-color:var(--ab);color:var(--accent);background:var(--al)}
.p-extra-sin{padding:3px 8px;border-radius:5px;border:1.5px dashed var(--border);background:none;color:var(--t3);font-size:11px;transition:all .15s}
.p-extra-sin:hover{border-color:var(--t3);color:var(--t2)}
.p-extra-close{position:absolute;top:4px;right:5px;background:none;border:none;color:var(--t3);font-size:12px;cursor:pointer;padding:0;line-height:1}
.p-extra-close:hover{color:var(--text)}
.pg-btn{padding:3px 10px;border-radius:6px;border:1.5px solid var(--border);background:var(--surface);color:var(--t2);font-size:13px;font-weight:700;cursor:pointer;transition:all .15s}
.pg-btn:disabled{opacity:.3;cursor:default}
.pg-btn:not(:disabled):hover{border-color:var(--ab);color:var(--accent)}

/* ── BOTTOM BAR (left panel) ── */
.bottom-bar{flex-shrink:0;background:var(--bbg);border-top:2px solid var(--bborder);display:flex;gap:0;overflow:hidden}
.bb-col{flex:1;padding:8px 12px;display:flex;flex-direction:column;gap:5px;min-width:0}
.bb-col+.bb-col{border-left:1px solid var(--bborder)}
.bb-label{font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--t2);margin-bottom:1px}
.toggle-row{display:flex;gap:5px}
.tog-opt{flex:1;padding:5px 6px;border-radius:6px;border:1.5px solid var(--border);background:var(--surface);color:var(--t2);font-size:12px;font-weight:500;transition:all .15s;text-align:center}
.tog-opt.active{border-color:var(--ab);color:var(--accent);background:var(--al)}
.f-label{font-size:11px;color:var(--t2);margin-bottom:1px}
.f-input{width:100%;padding:5px 8px;border:1.5px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font-size:12px;outline:none;transition:border-color .15s}
.f-input:focus{border-color:var(--accent)}
.f-input::placeholder{color:var(--t3)}
.hora-row{display:flex;gap:5px}
.hora-row .f-input{flex:1}
.moto-wrap{display:flex;gap:4px;flex-wrap:wrap}
.moto-btn{padding:3px 8px;border-radius:4px;border:1px solid var(--border);background:var(--surface);color:var(--t2);font-size:11px;transition:all .15s}
.moto-btn.active{border-color:var(--ab);color:var(--accent);background:var(--al)}

/* ── RIGHT PANEL (ticket) ── */
.ticket{width:380px;flex-shrink:0;background:var(--dk);display:flex;flex-direction:column;overflow:hidden}
.t-head{padding:9px 14px;border-bottom:1px solid var(--tl);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.t-num-lbl{font-size:11px;color:var(--tt2);font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.t-num{font-size:16px;font-weight:700;color:var(--tt);font-variant-numeric:tabular-nums}
.t-clear{font-size:12px;color:var(--tt2);padding:3px 8px;border-radius:5px;border:1px solid var(--tl);background:none;transition:all .15s}
.t-clear:hover{color:#e57373;border-color:#e57373}
.t-scroll{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(128,128,128,.2) transparent;min-height:0}
.t-bottom{flex-shrink:0;border-top:2px solid var(--tl);background:var(--dk2);display:flex;flex-direction:column}

/* Items */
.t-empty{padding:24px 14px;text-align:center;color:var(--tt2);font-size:13px;display:flex;flex-direction:column;align-items:center;gap:8px}
.t-empty-icon{font-size:28px;opacity:.35}
.line{display:flex;align-items:flex-start;gap:8px;padding:7px 14px;border-bottom:1px solid var(--tl)}
.line:hover{background:rgba(128,128,128,.04)}
.li{flex:1;min-width:0}
.li-name{font-size:13px;font-weight:500;color:var(--tt);line-height:1.2}
.li-nota{font-size:11px;color:var(--accent);margin-top:1px}
.li-unit{font-size:11px;color:var(--tt2);margin-top:1px;font-variant-numeric:tabular-nums}
.qty{display:flex;align-items:center;background:var(--dk);border-radius:5px;overflow:hidden;flex-shrink:0;border:1px solid var(--tl)}
.q-btn{width:22px;height:22px;background:none;border:none;color:var(--tt2);font-size:13px;display:flex;align-items:center;justify-content:center;transition:color .1s}
.q-btn:hover{color:var(--tt)}
.q-btn.rm:hover{color:#e57373}
.q-val{font-size:12px;font-weight:700;color:var(--tt);width:18px;text-align:center;font-variant-numeric:tabular-nums}
.li-total{font-size:13px;font-weight:600;color:var(--tt);font-variant-numeric:tabular-nums;min-width:44px;text-align:right;flex-shrink:0;margin-top:2px}
.raciones-blk{padding:4px 14px 8px;border-top:1px solid var(--dk3)}
.raciones-hd{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:700;color:var(--tt3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
.raciones-badge{background:var(--accent);color:#1c1c1e;font-size:9px;font-weight:800;padding:1px 5px;border-radius:20px}
.racion-row{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.racion-num{width:16px;height:16px;border-radius:50%;background:var(--dk3);color:var(--tt3);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.racion-num.ok{background:var(--accent);color:#1c1c1e}
.racion-sel{flex:1;padding:4px 7px;border-radius:5px;border:1px solid var(--dk3);background:var(--dk2);color:var(--tt);font-size:11px;font-family:inherit;outline:none;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23888880'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 6px center;padding-right:18px}
.racion-sel:focus{border-color:var(--accent)}
.racion-sel.ok{border-color:var(--accent);color:var(--accent)}
.raciones-hint{margin-top:3px;padding:4px 7px;border-radius:4px;font-size:10px;font-weight:500;display:flex;align-items:center;gap:4px}
.raciones-hint.warn{background:rgba(220,38,38,.12);color:#f87171;border:1px solid rgba(220,38,38,.2)}
.raciones-hint.ok{background:rgba(22,163,74,.12);color:#4ade80;border:1px solid rgba(22,163,74,.2)}

/* Fixed bottom */
.iva-row{display:flex;align-items:center;gap:8px;padding:6px 13px;border-bottom:1px solid var(--tl)}
.iva-lbl{font-size:12px;color:var(--tt2);flex:1}
.iva-badge{font-size:11px;padding:2px 6px;border-radius:4px}
.iva-on{background:rgba(39,174,96,.15);color:#4ade80}
.iva-off{background:rgba(128,128,128,.1);color:var(--tt3)}
.switch{position:relative;width:34px;height:18px}
.switch input{opacity:0;width:0;height:0}
.slider{position:absolute;inset:0;background:var(--dk3);border-radius:18px;cursor:pointer;transition:background .2s}
.slider::before{content:'';position:absolute;height:12px;width:12px;left:3px;bottom:3px;background:#888;border-radius:50%;transition:all .2s}
.switch input:checked+.slider{background:var(--accent)}
.switch input:checked+.slider::before{transform:translateX(16px);background:#fff}

.totals-row{display:flex;align-items:center;padding:5px 13px;gap:10px;border-bottom:1px solid var(--tl)}
.tot-lines{flex:1;display:flex;flex-direction:column;gap:1px}
.tot-item{display:flex;justify-content:space-between;font-size:11px;color:var(--tt2);font-variant-numeric:tabular-nums}
.tot-grand{font-size:16px;font-weight:700;color:var(--tt);font-variant-numeric:tabular-nums;text-align:right}
.tot-bs{font-size:11px;color:var(--bs);font-variant-numeric:tabular-nums;text-align:right}

.bcv-conv{display:flex;align-items:center;gap:6px;padding:5px 13px;border-bottom:1px solid var(--tl)}
.bcv-lbl{font-size:11px;color:var(--tt2);white-space:nowrap}
.bcv-inp{width:68px;padding:3px 5px;border:1px solid var(--tl);border-radius:5px;background:var(--dk);color:var(--tt);font-size:12px;text-align:right;outline:none;font-variant-numeric:tabular-nums}
.bcv-inp:focus{border-color:var(--ab)}
.vdiv{width:1px;height:20px;background:var(--tl)}
.c-sym{font-size:12px;color:var(--tt2);font-weight:600}
.c-inp{flex:1;padding:3px 5px;border:1px solid var(--tl);border-radius:5px;background:var(--dk);color:var(--tt);font-size:12px;outline:none;font-variant-numeric:tabular-nums;min-width:0}
.c-inp:focus{border-color:var(--ab)}
.c-arr{font-size:13px;color:var(--tt2)}

.pay-sec{padding:6px 13px 4px}
.pay-lbl{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tt2);margin-bottom:4px}
.pay-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.pay-btn{padding:5px 3px;border:1.5px solid var(--tl);border-radius:6px;background:none;color:var(--tt2);font-size:11px;font-weight:500;display:flex;flex-direction:column;align-items:center;gap:2px;transition:all .15s}
.pay-btn.active{border-color:var(--ab);color:var(--accent);background:var(--al)}
.pay-btn:hover:not(.active){border-color:var(--tt3);color:var(--tt)}
.pay-ico{font-size:13px}
.cxp-note{margin:0 10px 4px;padding:5px 8px;border-radius:6px;background:rgba(41,128,185,.12);border:1px solid rgba(41,128,185,.3);color:#7ec8e3;font-size:11px;line-height:1.35}
.cxc-wrap{padding:2px 13px 4px;display:flex;flex-direction:column;gap:1px}
.cxc-lbl{font-size:10px;color:var(--tt2)}
.t-inp-dark{width:100%;padding:4px 7px;border:1.5px solid var(--tl);border-radius:5px;background:var(--dk);color:var(--tt);font-size:12px;outline:none;transition:border-color .15s}
.t-inp-dark:focus{border-color:var(--ab)}
.cobro-entregar-btn{width:100%;margin-top:6px;padding:7px 10px;border:1.5px solid var(--tl);border-radius:6px;background:none;color:var(--tt2);font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:5px;transition:all .15s;cursor:pointer}
.cobro-entregar-btn.active{border-color:#f59e0b;color:#92400e;background:#fef3c7}
.cobro-entregar-btn:hover:not(.active){border-color:var(--tt3);color:var(--tt)}
.cobrar-wrap{padding:7px 12px 10px}
.cobrar-btn{width:100%;padding:11px;background:var(--accent);color:#1c1c1e;border:none;border-radius:9px;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity .15s,transform .1s;font-variant-numeric:tabular-nums}
.cobrar-btn:hover:not(:disabled){opacity:.9}
.cobrar-btn:active:not(:disabled){transform:scale(.98)}
.cobrar-btn:disabled{background:var(--dk3);color:var(--tt2);cursor:not-allowed;border:1px solid var(--tl)}

/* ── Agenda ── */
.agenda-panel{padding:12px;display:flex;flex-direction:column;gap:8px;height:100%;overflow-y:auto}
.agenda-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--tl)}
.agenda-card{background:var(--surface);border:1.5px solid var(--tl);border-radius:9px;padding:9px 11px;display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;cursor:pointer;transition:border-color .15s}
.agenda-card:hover{border-color:var(--ab)}
.agenda-card.ag-urgent{border-color:#ef4444;background:rgba(239,68,68,.06)}
.agenda-card.ag-today{border-color:var(--ab);background:var(--al)}
.ag-time{display:flex;flex-direction:column;align-items:center;background:var(--dk3);border-radius:6px;padding:5px 8px;min-width:56px;gap:1px}
.ag-date{font-size:8px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.06em}
.ag-hour{font-size:14px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
.ag-info{display:flex;flex-direction:column;gap:2px}
.ag-name{font-size:13px;font-weight:600}
.ag-detail{font-size:11px;color:var(--t2);display:flex;gap:6px;flex-wrap:wrap}
.ag-tag{display:inline-flex;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700}
.ag-actions{display:flex;flex-direction:column;gap:4px}
.ag-btn{padding:3px 8px;border-radius:5px;border:none;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap}
.ag-btn.cobrar{background:var(--green,#22c55e);color:#000}
.ag-btn.ver{background:none;border:1.5px solid var(--tl);color:var(--t2);cursor:pointer}
/* Alert overlay */
.ag-alert-overlay{position:absolute;inset:0;background:rgba(0,0,0,.65);z-index:200;display:flex;align-items:center;justify-content:center;border-radius:inherit}
.ag-alert-box{background:var(--surface);border:1.5px solid var(--tl);border-radius:14px;padding:20px 24px;display:flex;flex-direction:column;align-items:center;gap:10px;max-width:300px;text-align:center}
.ag-alert-emoji{font-size:46px;animation:agRing 1.2s ease-in-out infinite}
@keyframes agRing{0%,100%{transform:rotate(-8deg) scale(1.05)}15%{transform:rotate(8deg) scale(1.1)}40%{transform:rotate(-5deg) scale(1.05)}55%{transform:rotate(5deg) scale(1.07)}70%,90%{transform:rotate(0) scale(1)}}
.ag-alert-title{font-size:14px;font-weight:700;color:var(--accent)}
.ag-alert-body{font-size:11px;color:var(--t2);line-height:1.5}
.ag-alert-btns{display:flex;gap:7px;width:100%}
.ag-alert-btns button{flex:1;padding:8px;border-radius:7px;border:none;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit}
/* ── Borradores ── */
.borrador-panel{padding:12px;display:flex;flex-direction:column;gap:8px;height:100%;overflow-y:auto}
.borrador-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding-bottom:8px;border-bottom:1px solid var(--tl)}
.borrador-card{background:var(--surface);border:1.5px solid var(--tl);border-radius:9px;padding:10px 12px;display:grid;grid-template-columns:1fr auto;gap:6px;align-items:start}
.borrador-card:hover{border-color:var(--ab)}
.borrador-nombre{font-size:13px;font-weight:600;color:var(--tt)}
.borrador-detail{font-size:11px;color:var(--t2);line-height:1.5}
.borrador-total{font-size:14px;font-weight:700;color:var(--accent)}
.borrador-actions{display:flex;flex-direction:column;gap:4px;align-items:flex-end}
.borrador-btn-rec{padding:5px 12px;border-radius:6px;border:none;background:var(--accent);color:#1c1c1e;font-size:11px;font-weight:700;cursor:pointer}
.borrador-btn-del{padding:4px 10px;border-radius:6px;border:1.5px solid var(--tl);background:none;color:var(--t2);font-size:11px;cursor:pointer}
.borrador-btn-del:hover{border-color:#ef4444;color:#ef4444}
/* Mesa Abierta ── */
.mesa-chips{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;align-items:center}
.mesa-chips::-webkit-scrollbar{display:none}
.mesa-chip{flex-shrink:0;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;border:1.5px solid var(--tb-border);background:rgba(255,255,255,.07);color:var(--tb-text);cursor:pointer;transition:all .15s;white-space:nowrap}
.mesa-chip:hover{background:rgba(255,255,255,.15)}
.mesa-chip.active{border-color:var(--ab);color:var(--accent);background:rgba(255,255,255,.1)}
.mesa-chip-new{flex-shrink:0;padding:3px 9px;border-radius:20px;font-size:12px;font-weight:700;border:1.5px dashed var(--tb-border);background:none;color:var(--tb-text);cursor:pointer;transition:all .15s;opacity:.7}
.mesa-chip-new:hover{opacity:1;border-color:var(--ab);color:var(--accent)}

/* Confirm overlay */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;display:flex;align-items:center;justify-content:center}
.ov-card{background:var(--dk);border:1px solid var(--tl);border-radius:14px;padding:20px;min-width:260px;max-width:340px;width:90%;display:flex;flex-direction:column;gap:10px;text-align:center}
.cf-icon{font-size:44px}
.cf-title{font-size:17px;font-weight:700;color:var(--tt)}
.cf-detail{font-size:13px;color:var(--tt2);line-height:1.6}
.cf-detail strong{color:var(--tt)}
.cf-ok{padding:10px;background:var(--accent);color:#1c1c1e;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
.cf-ok:hover{opacity:.9}
.cf-cancel{padding:10px;background:none;color:var(--tt2);border:1.5px solid var(--tl);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
.cf-cancel:hover{border-color:var(--tt3);color:var(--tt)}

@media(max-width:700px){.pos-body{flex-direction:column}.ticket{width:100%;border-left:none;border-top:1px solid var(--tl)}.left-panel{min-width:unset}.bottom-bar{flex-direction:column}}
`;

export default function CajaClient() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { const t = localStorage.getItem("caja_theme"); if (t === "dark" || t === "light" || t === "azul" || t === "beige") return t; } catch { /* ignore */ }
    return "dark";
  });

  function changeTheme(t: Theme) { setTheme(t); try { localStorage.setItem("caja_theme", t); } catch { /* ignore */ } }
  const [productos, setProductos] = useState<Producto[]>([]);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [bcvRate, setBcvRate] = useState(1);
  const [bcvInput, setBcvInput] = useState("1.00");

  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [catActiva, setCatActiva] = useState("Tradicional");
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [pagos, setPagos] = useState<{ metodo: string; monto: string }[]>([{ metodo: "EFECTIVO_BS", monto: "0" }]);
  const [cobroAlEntregar, setCobroAlEntregar] = useState(false);
  const [entrega, setEntrega] = useState<"LOCAL" | "DELIVERY" | "PICKUP">("LOCAL");
  const [direccion, setDireccion] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [horaPreparacion, setHoraPreparacion] = useState("");
  const [horaRetiro, setHoraRetiro] = useState("");
  const [motorizadoId, setMotorizadoId] = useState<number | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteApellido, setClienteApellido] = useState("");
  const [clienteCi, setClienteCi] = useState("");
  const [clienteTel, setClienteTel] = useState("");
  const [costoDelivery, setCostoDelivery] = useState("0");
  const [clienteSugerencias, setClienteSugerencias] = useState<{ id: number; nombre: string; cedula: string | null; telefono: string | null; direccion: string | null }[]>([]);
  const [clienteCampoActivo, setClienteCampoActivo] = useState<"nombre" | "ci" | null>(null);
  const [minutosPrep, setMinutosPrep] = useState("15");
  const [minutosRetiro, setMinutosRetiro] = useState("10");
  const [casheaPorcentajes, setCasheaPorcentajes] = useState<string[]>(["40", "50"]);
  const [casheaDiasOpciones, setCasheaDiasOpciones] = useState<string[]>(["15", "30"]);
  const [casheaPct, setCasheaPct] = useState("40");
  const [casheaDiasSelec, setCasheaDiasSelec] = useState("15");
  const [casheaMetodoInicial, setCasheaMetodoInicial] = useState("");
  const [ivaActivo, setIvaActivo] = useState(false);
  const [convUsd, setConvUsd] = useState("");
  const [convBs, setConvBs] = useState("");
  const [fechaCxC, setFechaCxC] = useState("");
  const [confirmOverlay, setConfirmOverlay] = useState<{ icon: string; titulo: string; detalle: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [bcvFechaMsg, setBcvFechaMsg] = useState<string | null>(null);
  const [bcvFechaErr, setBcvFechaErr] = useState<string | null>(null);
  const [mostrarHistBcv, setMostrarHistBcv] = useState(false);
  const [consultandoBcv, setConsultandoBcv] = useState(false);

  const ticketRef = useRef(47);
  const [ticketNum, setTicketNum] = useState(47);
  const clockRef = useRef<HTMLSpanElement>(null);
  const [vistaHistorial, setVistaHistorial] = useState(false);
  const [vistaAgenda, setVistaAgenda] = useState(false);
  const [agendaHabilitada, setAgendaHabilitada] = useState(false);
  const [agendaAlertasPantalla, setAgendaAlertasPantalla] = useState(true);
  const [agendaAlertasSonido, setAgendaAlertasSonido] = useState(true);
  const [agendaPedidos, setAgendaPedidos] = useState<AgendaPedido[]>([]);
  const [agendaCargando, setAgendaCargando] = useState(false);
  const [modoAgenda, setModoAgenda] = useState(false);
  const [agendaRecordatorioFecha, setAgendaRecordatorioFecha] = useState("");
  const [agendaRecordatorioHora, setAgendaRecordatorioHora] = useState("09:00");
  const [agendaEntregaFecha, setAgendaEntregaFecha] = useState("");
  const [agendaEntregaHora, setAgendaEntregaHora] = useState("12:00");
  const [agendaMinsPrepa, setAgendaMinsPrepa] = useState("45");
  const [agendaMinsRetiro, setAgendaMinsRetiro] = useState("15");
  const [agendaGuardando, setAgendaGuardando] = useState(false);
  const [agendaAlertaActual, setAgendaAlertaActual] = useState<AgendaPedido | null>(null);
  const agendaAlertasDismissedRef = useRef<Set<number>>(new Set());
  const [agendaEditandoId, setAgendaEditandoId] = useState<number | null>(null);
  const [agendaSinClienteModal, setAgendaSinClienteModal] = useState(false);
  const clienteNombreRef = useRef<HTMLInputElement>(null);
  const catPreviaRef = useRef<string>("Tradicional");
  const LS_KEY = "caja_borradores_v1";
  const [borradores, setBorradores] = useState<Borrador[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as Borrador[]; } catch { return []; }
  });
  const [vistaBorradores, setVistaBorradores] = useState(false);
  const [borradorNombreModal, setBorradorNombreModal] = useState(false);
  const [borradorNombreInput, setBorradorNombreInput] = useState("");
  const [temaOpen, setTemaOpen] = useState(false);
  const temaRef = useRef<HTMLDivElement>(null);
  const [fechaEntrega, setFechaEntrega] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" }));
  const [mesasAbiertas, setMesasAbiertas] = useState<{ id: number; mesa: string; itemCount: number }[]>([]);
  const [mesaActual, setMesaActual] = useState<{ id: number; mesa: string } | null>(null);
  const [mesaModalOpen, setMesaModalOpen] = useState(false);
  const [mesaNombreInput, setMesaNombreInput] = useState("");
  const [mesaGuardando, setMesaGuardando] = useState(false);
  const [histVentas, setHistVentas] = useState<HistVenta[]>([]);
  const [histCargando, setHistCargando] = useState(false);
  const [histBusqueda, setHistBusqueda] = useState("");
  const [histDesde, setHistDesde] = useState(() => today());
  const [histHasta, setHistHasta] = useState(() => today());
  const [histColsOpen, setHistColsOpen] = useState(false);
  const histColsRef = useRef<HTMLDivElement>(null);
  const [histColsVisibles, setHistColsVisibles] = useState<Set<HistCol>>(() => {
    try {
      const s = localStorage.getItem("caja-hist-cols");
      if (s) return new Set(JSON.parse(s) as HistCol[]);
    } catch { /* ignore */ }
    return new Set(ALL_HIST_COLS);
  });

  const LS_PROD_KEY = "caja_productos_v1";
  useEffect(() => {
    // Show cached data immediately (stale-while-revalidate)
    try {
      const cached = localStorage.getItem(LS_PROD_KEY);
      if (cached) setProductos(JSON.parse(cached) as Producto[]);
    } catch { /* ignore */ }
    // Fetch fresh in background
    fetch("/api/productos/caja")
      .then((r) => r.json())
      .then((data: Producto[]) => {
        setProductos(data);
        try { localStorage.setItem(LS_PROD_KEY, JSON.stringify(data)); } catch { /* cuota */ }
      }).catch(() => { /* keep cache */ });

    fetch("/api/motorizados")
      .then((r) => r.json())
      .then((data: Record<string, unknown>[]) => {
        setMotorizados(data.filter((m) => m.activo !== false) as unknown as Motorizado[]);
      }).catch(() => {});

    cargarMesasAbiertas();

    fetch("/api/tasa-bcv")
      .then((r) => r.json())
      .then((d) => { if (d.tasa) { setBcvRate(Number(d.tasa)); setBcvInput(Number(d.tasa).toFixed(2)); } })
      .catch(() => {});

    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((cfg: Record<string, string>) => {
        setIvaActivo(cfg.iva_activo === "true");
        if (cfg.cashea_porcentajes) { const opts = cfg.cashea_porcentajes.split(",").map((s: string) => s.trim()).filter(Boolean); setCasheaPorcentajes(opts); setCasheaPct(cfg.cashea_porcentaje_default ?? opts[0] ?? "40"); }
        if (cfg.cashea_dias) { const opts = cfg.cashea_dias.split(",").map((s: string) => s.trim()).filter(Boolean); setCasheaDiasOpciones(opts); setCasheaDiasSelec(cfg.cashea_dias_default ?? opts[0] ?? "15"); }
        const hab = cfg.agenda_habilitada === "true";
        setAgendaHabilitada(hab);
        setAgendaAlertasPantalla(cfg.agenda_alertas_pantalla !== "false");
        setAgendaAlertasSonido(cfg.agenda_alertas_sonido !== "false");
        setAgendaMinsPrepa(cfg.agenda_mins_preparacion ?? "45");
        setAgendaMinsRetiro(cfg.agenda_mins_retiro ?? "15");
      })
      .catch(() => {});

    const temaHandler = (e: MouseEvent) => {
      if (temaRef.current && !temaRef.current.contains(e.target as Node)) setTemaOpen(false);
      if (histColsRef.current && !histColsRef.current.contains(e.target as Node)) setHistColsOpen(false);
    };
    document.addEventListener("mousedown", temaHandler);

    const tick = () => {
      if (clockRef.current) {
        clockRef.current.textContent = new Date().toLocaleString("es-VE", {
          timeZone: "America/Caracas", day: "2-digit", month: "2-digit",
          year: "numeric", hour: "2-digit", minute: "2-digit",
        });
      }
    };
    tick();
    const iv = setInterval(tick, 30000);
    return () => { clearInterval(iv); document.removeEventListener("mousedown", temaHandler); };
  }, []);

  useEffect(() => {
    if (!vistaHistorial) return;
    cargarHistorial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaHistorial]);

  useEffect(() => {
    if (!agendaHabilitada) return;
    void cargarAgenda().then(() => {
      setAgendaPedidos((prev) => { verificarAlertasAgenda(prev); return prev; });
    });
    const iv = setInterval(() => {
      void fetch("/api/agenda-pedidos")
        .then((r) => r.ok ? r.json() : { items: [] })
        .then((d: { items: AgendaPedido[] }) => {
          setAgendaPedidos(d.items ?? []);
          verificarAlertasAgenda(d.items ?? []);
        });
    }, 60000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaHabilitada]);

  function cargarHistorial() {
    setHistCargando(true);
    const qs = new URLSearchParams({ desde: histDesde, hasta: histHasta, limit: "200" });
    fetch(`/api/ventas?${qs}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: Record<string, unknown>[]) => {
        setHistVentas(data.map((v) => ({
          id: v.id as number,
          fecha: (v.fecha as string) ?? "",
          cliente: (v.cliente as string) ?? "Consumidor Final",
          items: ((v.items as Record<string, unknown>[]) ?? []).map((i) => ({
            nombreProducto: (i.nombreProducto as string) ?? "?",
            cantidad: Number(i.cantidad ?? 1),
            precioUnit: Number(i.precioUnit ?? 0),
            extraNombre: (i.extraNombre as string | null) ?? null,
            extraPrecio: Number(i.extraPrecio ?? 0),
          })),
          pagos: ((v.pagos as Record<string, unknown>[]) ?? []).map((p) => ({
            metodo: (p.metodo as string) ?? "",
            monto: Number(p.monto ?? 0),
          })),
          modoEntrega: (v.modoEntrega as string) ?? "LOCAL",
          pedidoEntregado: Boolean(v.pedidoEntregado),
          cuentaPorCobrar: Boolean(v.cuentaPorCobrar),
          cuentaCobrada: Boolean(v.cuentaCobrada),
          tasaDelDia: Number(v.tasaDelDia ?? 1),
        })));
      })
      .catch(() => {})
      .finally(() => setHistCargando(false));
  }

  const subtotal = carrito.reduce((s, c) => s + (c.precio + c.extraPrecio) * c.qty, 0);
  const ivaAmt = ivaActivo ? subtotal * 0.16 : 0;
  const costoDeliveryNum = entrega === "DELIVERY" ? (Number(costoDelivery) || 0) : 0;
  const total = subtotal + ivaAmt + costoDeliveryNum;
  const isCashea = pagos.some((p) => p.metodo === "CASHEA");
  const isCxP = pagos.some((p) => CXP_METHODS.includes(p.metodo));
  const totalPagado = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);

  // Auto-rellenar primer método con total cuando hay solo uno
  useEffect(() => {
    setPagos((prev) => {
      if (prev.length === 1) return [{ ...prev[0], monto: total.toFixed(2) }];
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);
  const FILTROS = [
    { key: "Todos",      label: "Todos" },
    { key: "Premium",    label: "Premium" },
    { key: "Especiales", label: "Especiales" },
    { key: "Tradicional",label: "Tradicional" },
    { key: "Masas",      label: "Masas Intervenidas" },
    { key: "Bandejas",   label: "Bandejas y Experiencias" },
    { key: "Combos",     label: "Combos y Pack" },
    { key: "Raciones",   label: "Raciones" },
    { key: "Bebidas",    label: "Bebidas" },
  ] as const;
  type FiltroKey = typeof FILTROS[number]["key"];

  function matchFiltro(p: Producto, key: FiltroKey): boolean {
    if (key === "Todos") return true;
    const linea = (p.lineaNombre ?? "").toLowerCase();
    const cat = (p.categoriaNombre ?? "").toLowerCase();
    if (key === "Premium")    return linea.includes("premium");
    if (key === "Especiales") return linea.includes("especial");
    if (key === "Tradicional") return linea.includes("tradicional");
    if (key === "Masas")      return linea.includes("masas intervenidas") || cat.includes("masas intervenidas");
    if (key === "Bandejas")   return cat.includes("bandeja") || cat.includes("experiencia");
    if (key === "Combos")     return cat.includes("combo") || cat.includes("pack");
    if (key === "Raciones")   return cat.includes("racion") || cat.includes("ración") || cat.includes("ravion") || cat.includes("ravión");
    if (key === "Bebidas")    return cat.includes("bebida");
    return false;
  }

  const cats = FILTROS.filter((f) => f.key === "Todos" || productos.some((p) => matchFiltro(p, f.key as FiltroKey)));
  const filtrados = productos.filter((p) => {
    const mc = matchFiltro(p, catActiva as FiltroKey);
    const mq = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return mc && mq;
  });
  const POR_PAGINA = 24;
  const totalPags = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const filtradosPag = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const cartMap: Record<number, number> = {};
  carrito.forEach((c) => { cartMap[c.productoId] = (cartMap[c.productoId] ?? 0) + c.qty; });

  function addToCart(prod: Producto, extra: Extra | null) {
    const extraId = extra?.id ?? null;
    const esVariada = prod.tipoProducto === "VARIADA";
    setCarrito((prev) => {
      // Variada siempre agrega línea nueva (cada una tiene sus propias raciones)
      if (esVariada) {
        return [...prev, { uid: uid(), productoId: prod.id, nombre: prod.nombre, precio: prod.precioVenta, qty: 1, extraId: null, extraNombre: null, extraPrecio: 0, variadaSelecciones: Array.from({ length: prod.variadaRaciones }, () => "") }];
      }
      const ex = prev.find((c) => c.productoId === prod.id && c.extraId === extraId);
      if (ex) return prev.map((c) => c.uid === ex.uid ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { uid: uid(), productoId: prod.id, nombre: prod.nombre, precio: prod.precioVenta, qty: 1, extraId, extraNombre: extra?.nombre ?? null, extraPrecio: extra?.precioAdicional ?? 0, variadaSelecciones: [] }];
    });
    setExpandedId(null);
  }
  function setQty(u: string, delta: number) {
    setCarrito((prev) => prev.map((c) => c.uid === u ? { ...c, qty: c.qty + delta } : c).filter((c) => c.qty > 0));
  }
  function setRacion(uid: string, idx: number, val: string) {
    setCarrito((prev) => prev.map((c) => {
      if (c.uid !== uid) return c;
      const sel = [...c.variadaSelecciones];
      sel[idx] = val;
      return { ...c, variadaSelecciones: sel };
    }));
  }
  function clearCart() {
    setCarrito([]);
    ticketRef.current += 1;
    setTicketNum(ticketRef.current);
  }

  async function cargarAgenda() {
    setAgendaCargando(true);
    try {
      const r = await fetch("/api/agenda-pedidos");
      if (r.ok) { const d = await r.json(); setAgendaPedidos(d.items ?? []); }
    } finally { setAgendaCargando(false); }
  }

  function playBeep() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8);
    } catch { /* Web Audio not available */ }
  }

  function verificarAlertasAgenda(pedidos: AgendaPedido[]) {
    if (!agendaAlertasPantalla) return;
    const ahora = new Date();
    const candidato = pedidos.find(
      (p) =>
        p.estado === "pendiente" &&
        !p.alertaCobroDisparada &&
        !agendaAlertasDismissedRef.current.has(p.id) &&
        new Date(p.recordatorioAt) <= ahora
    );
    if (candidato) {
      setAgendaAlertaActual(candidato);
      if (agendaAlertasSonido) playBeep();
      void fetch(`/api/agenda-pedidos/${candidato.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertaCobroDisparada: true }),
      });
      setAgendaPedidos((prev) =>
        prev.map((p) => p.id === candidato.id ? { ...p, alertaCobroDisparada: true } : p)
      );
    }
  }

  async function guardarEnAgenda(forzarSinCliente = false) {
    if (carrito.length === 0 || !agendaRecordatorioFecha) return;
    if (!forzarSinCliente && !clienteNombre.trim()) {
      setAgendaSinClienteModal(true);
      return;
    }
    setAgendaGuardando(true);
    try {
      const body = {
        cliente: clienteNombre ? `${clienteNombre} ${clienteApellido}`.trim() : null,
        clienteTelefono: clienteTel || null,
        items: carrito.map((c) => ({ productoId: c.productoId, cantidad: c.qty, extraId: c.extraId ?? null, nombre: c.nombre, precio: c.precio })),
        totalUsd: total,
        recordatorioAt: `${agendaRecordatorioFecha}T${agendaRecordatorioHora || "09:00"}:00`,
        entregaAt: agendaEntregaFecha ? `${agendaEntregaFecha}T${agendaEntregaHora || "12:00"}:00` : null,
        minsPreparacion: Number(agendaMinsPrepa) || 45,
        minsRetiro: Number(agendaMinsRetiro) || 15,
      };
      let r: Response;
      if (agendaEditandoId !== null) {
        r = await fetch(`/api/agenda-pedidos/${agendaEditandoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        r = await fetch("/api/agenda-pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      if (!r.ok) { const e = await r.json().catch(() => ({})); alert((e as { error?: string }).error ?? "Error al guardar agenda"); return; }
      const tituloConfirm = agendaEditandoId !== null ? "Agenda actualizada" : "Pedido agendado";
      setConfirmOverlay({ icon: "📅", titulo: tituloConfirm, detalle: `Recordatorio: <strong>${agendaRecordatorioFecha} ${agendaRecordatorioHora}</strong><br>El pedido no descuenta inventario hasta ser cobrado.` });
      clearCart();
      setClienteNombre(""); setClienteApellido(""); setClienteCi(""); setClienteTel(""); setDireccion("");
      setAgendaRecordatorioFecha(""); setAgendaEntregaFecha("");
      setModoAgenda(false);
      setAgendaEditandoId(null);
      setCatActiva(catPreviaRef.current);
      void cargarAgenda();
    } finally { setAgendaGuardando(false); }
  }

  function editarAgenda(pedido: AgendaPedido) {
    const nuevas = pedido.items.map((it) => {
      const prod = productos.find((p) => p.id === it.productoId);
      const extra = prod?.extras.find((e) => e.id === it.extraId);
      return {
        uid: `edit-${it.productoId}-${it.extraId ?? 0}-${Date.now()}`,
        productoId: it.productoId,
        nombre: it.nombre,
        precio: it.precio,
        qty: it.cantidad,
        extraId: it.extraId ?? null,
        extraNombre: extra?.nombre ?? null,
        extraPrecio: extra?.precioAdicional ?? 0,
        variadaSelecciones: [] as string[],
      };
    });
    setCarrito(nuevas);
    setClienteNombre(pedido.cliente ?? "");
    setClienteTel(pedido.clienteTelefono ?? "");
    const rec = new Date(pedido.recordatorioAt);
    setAgendaRecordatorioFecha(rec.toISOString().slice(0, 10));
    setAgendaRecordatorioHora(rec.toTimeString().slice(0, 5));
    if (pedido.entregaAt) {
      const ent = new Date(pedido.entregaAt);
      setAgendaEntregaFecha(ent.toISOString().slice(0, 10));
      setAgendaEntregaHora(ent.toTimeString().slice(0, 5));
    } else {
      setAgendaEntregaFecha(""); setAgendaEntregaHora("");
    }
    setAgendaMinsPrepa(String(pedido.minsPreparacion));
    setAgendaMinsRetiro(String(pedido.minsRetiro));
    setAgendaEditandoId(pedido.id);
    setModoAgenda(true);
    catPreviaRef.current = catActiva;
    setCatActiva("PEDIDO");
    setVistaAgenda(false);
  }

  function cobrarDesdeAgenda(pedido: AgendaPedido) {
    const nuevas = pedido.items.map((it) => {
      const prod = productos.find((p) => p.id === it.productoId);
      return {
        uid: `ag-${it.productoId}-${it.extraId ?? 0}-${Date.now()}`,
        productoId: it.productoId,
        nombre: it.nombre || prod?.nombre || `Producto #${it.productoId}`,
        precio: it.precio || prod?.precioVenta || 0,
        qty: it.cantidad,
        extraId: it.extraId ?? null,
        extraNombre: null,
        extraPrecio: 0,
        variadaSelecciones: [],
      };
    });
    setCarrito(nuevas);
    if (pedido.cliente) {
      const partes = pedido.cliente.split(" ");
      setClienteNombre(partes[0] ?? "");
      setClienteApellido(partes.slice(1).join(" ") ?? "");
    }
    if (pedido.clienteTelefono) setClienteTel(pedido.clienteTelefono);
    if (pedido.entregaAt) {
      const dt = new Date(pedido.entregaAt);
      setFechaEntrega(dt.toLocaleDateString("en-CA", { timeZone: "America/Caracas" }));
      setHoraEntrega(dt.toLocaleTimeString("es-VE", { timeZone: "America/Caracas", hour: "2-digit", minute: "2-digit", hour12: false }));
      setEntrega("DELIVERY");
    }
    setModoAgenda(false);
    setVistaAgenda(false);
    setAgendaAlertaActual(null);
  }

  function buscarCliente(q: string) {
    if (q.length < 4) { setClienteSugerencias([]); return; }
    fetch(`/api/clientes?q=${encodeURIComponent(q)}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setClienteSugerencias)
      .catch(() => {});
  }

  function seleccionarCliente(c: { nombre: string; cedula: string | null; telefono: string | null; direccion: string | null }) {
    const partes = c.nombre.trim().split(" ");
    setClienteNombre(partes[0] ?? "");
    setClienteApellido(partes.slice(1).join(" ") ?? "");
    setClienteCi(c.cedula ?? "");
    setClienteTel(c.telefono ?? "");
    if (c.direccion) setDireccion(c.direccion);
    setClienteSugerencias([]);
    setClienteCampoActivo(null);
  }
  function clickProducto(prod: Producto) {
    if (prod.tipoProducto === "VARIADA") {
      addToCart(prod, null);
      return;
    }
    if (prod.extras.length > 0) {
      setExpandedId(expandedId === prod.id ? null : prod.id);
    } else if (prod.extrasCount > 0) {
      // Extras aún no cargados — fetch lazy y luego abrir overlay
      fetch(`/api/productos/${prod.id}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!d) return;
          const extras: Extra[] = (d.extras ?? []).map((e: Record<string, unknown>) => ({
            id: e.id as number,
            nombre: e.nombre as string,
            precioAdicional: Number(e.precioAdicional ?? 0),
          }));
          setProductos((prev) => prev.map((p) => p.id === prod.id ? { ...p, extras } : p));
          setExpandedId(prod.id);
        })
        .catch(() => addToCart(prod, null));
    } else {
      addToCart(prod, null);
    }
  }

  function fromUsd(v: string) { setConvUsd(v); const n = parseFloat(v) || 0; setConvBs(n > 0 ? (n * bcvRate).toFixed(2) : ""); }
  function fromBs(v: string) { setConvBs(v); const n = parseFloat(v) || 0; setConvUsd(n > 0 ? (n / bcvRate).toFixed(2) : ""); }
  function onBcv(v: string) { setBcvInput(v); setBcvRate(parseFloat(v) || 1); }

  function pad(n: number) { return String(n).padStart(2, "0"); }
  function addDays(dateStr: string, days: number) {
    const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  const fechaHoy = today();
  // Alarmas calculadas desde hora de entrega
  function calcAlarma(horaHHMM: string, minutosAntes: number): string | null {
    if (!horaHHMM) return null;
    const [h, m] = horaHHMM.split(":").map(Number);
    const total = h * 60 + m - minutosAntes;
    if (total < 0) return null;
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  }
  const alarmaPrepTime = calcAlarma(horaEntrega, Number(minutosPrep) || 0);
  const alarmaRetiroTime = calcAlarma(horaEntrega, Number(minutosRetiro) || 0);
  // Cashea cálculos
  const casheaTotal = total;
  const casheaInicial = casheaTotal * (Number(casheaPct) || 0) / 100;
  const casheaFinanciado = casheaTotal - casheaInicial;
  const casheaVence = addDays(fechaHoy, Number(casheaDiasSelec) || 15);

  async function actualizarBcv() {
    setConsultandoBcv(true);
    try {
      const d = await fetch("/api/tasa-bcv").then((r) => r.json());
      if (d.tasa) { setBcvRate(Number(d.tasa)); setBcvInput(Number(d.tasa).toFixed(2)); setBcvFechaMsg(null); setBcvFechaErr(null); }
    } catch { /* ignore */ } finally { setConsultandoBcv(false); }
  }
  async function buscarBcvFecha(f: string) {
    if (!f) return;
    setConsultandoBcv(true); setBcvFechaErr(null); setBcvFechaMsg(null);
    try {
      const d = await fetch(`/api/tasa-bcv?fecha=${f}`).then((r) => r.json());
      if (d.tasa) { setBcvRate(Number(d.tasa)); setBcvInput(Number(d.tasa).toFixed(2)); setBcvFechaMsg(`✓ Tasa del ${f}: ${Number(d.tasa).toFixed(4)}`); }
      else setBcvFechaErr("Sin datos para esa fecha");
    } catch { setBcvFechaErr("Error al buscar"); } finally { setConsultandoBcv(false); }
  }

  async function cancelarMesa(ventaId: number, nombreMesa: string) {
    if (!confirm(`¿Cancelar "${nombreMesa}"? Se eliminará el pedido y se revertirá el inventario.`)) return;
    try {
      const res = await fetch(`/api/ventas/${ventaId}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); alert(d.error ?? "Error al cancelar la mesa"); return; }
      if (mesaActual?.id === ventaId) { setMesaActual(null); setCarrito([]); }
      await cargarMesasAbiertas();
    } catch { alert("Error al cancelar la mesa"); }
  }

  async function cargarMesasAbiertas() {
    try {
      const res = await fetch("/api/ventas?es_mesa_abierta=true&limit=50");
      if (!res.ok) return;
      const data = (await res.json()) as { id: number; mesa: string | null; items: unknown[] }[];
      setMesasAbiertas(data.filter((v) => v.mesa).map((v) => ({ id: v.id, mesa: v.mesa!, itemCount: v.items?.length ?? 0 })));
    } catch { /* ignorar */ }
  }

  async function abrirMesa(ventaId: number) {
    try {
      const res = await fetch(`/api/ventas/${ventaId}`);
      if (!res.ok) return;
      const data = await res.json() as {
        venta: { id: number; cliente: string; mesa: string; modoEntrega: string; direccion: string | null };
        items: { productoId: number; producto: string; extraId: number | null; extraNombre: string | null; extraPrecio: number; cantidad: number; precioUnit: number }[];
      };
      const nuevasLineas = data.items.map((item) => ({
        uid: `mesa-${ventaId}-${item.productoId}-${item.extraId ?? 0}-${Math.random()}`,
        productoId: item.productoId,
        nombre: item.producto,
        precio: item.precioUnit - item.extraPrecio,
        qty: item.cantidad,
        extraId: item.extraId,
        extraNombre: item.extraNombre,
        extraPrecio: item.extraPrecio,
        variadaSelecciones: [],
      }));
      setCarrito(nuevasLineas);
      setMesaActual({ id: data.venta.id, mesa: data.venta.mesa });
      setEntrega("LOCAL");
      if (data.venta.cliente && data.venta.cliente !== "Consumidor Final") {
        setClienteNombre(data.venta.cliente);
      }
    } catch { /* ignorar */ }
  }

  async function guardarMesaAbierta(nombreMesa: string) {
    if (carrito.length === 0 || !nombreMesa.trim()) return;
    setMesaGuardando(true);
    try {
      const nombreCompleto = [clienteNombre.trim(), clienteApellido.trim()].filter(Boolean).join(" ") || "Consumidor Final";
      const body = {
        fecha: fechaHoy,
        tasaDelDia: bcvRate,
        cliente: nombreCompleto,
        clienteTelefono: clienteTel || null,
        modoEntrega: "LOCAL",
        costoDelivery: 0,
        despachoPendiente: false,
        mesa: nombreMesa.trim(),
        esMesaAbierta: true,
        items: carrito.map((c) => ({ productoId: c.productoId, cantidad: c.qty, extraId: c.extraId ?? undefined, variadaSelecciones: c.variadaSelecciones.map(Number).filter(Boolean) })),
        pagos: [],
      };
      const url = mesaActual ? `/api/ventas/${mesaActual.id}` : "/api/ventas";
      const method = mesaActual ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error"); }
      const saved = await res.json();
      const id = mesaActual ? mesaActual.id : saved.id;
      setMesaActual({ id, mesa: nombreMesa.trim() });
      await cargarMesasAbiertas();
      clearCart();
      setClienteNombre(""); setClienteApellido(""); setClienteCi(""); setClienteTel("");
      setConfirmOverlay({ icon: "🍽️", titulo: `Mesa guardada`, detalle: `Mesa <strong>${nombreMesa.trim()}</strong> guardada con ${body.items.length} ítem(s).` });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar mesa");
    } finally {
      setMesaGuardando(false);
      setMesaModalOpen(false);
    }
  }

  async function cobrar() {
    if (carrito.length === 0) return;
    if ((entrega === "DELIVERY" || entrega === "PICKUP") && !horaEntrega) {
      alert(`Indica la hora de ${entrega === "PICKUP" ? "Pick-Up" : "entrega"}.`);
      return;
    }
    // Validar raciones completas
    for (const c of carrito) {
      if (c.variadaSelecciones.length > 0) {
        const prod = productos.find((p) => p.id === c.productoId);
        const faltantes = c.variadaSelecciones.filter((s) => !s).length;
        if (faltantes > 0) {
          alert(`Selecciona las ${c.variadaSelecciones.length} raciones de "${prod?.nombre ?? c.nombre}"`);
          return;
        }
      }
    }
    setGuardando(true);
    try {
      const nombreCompleto = [clienteNombre.trim(), clienteApellido.trim()].filter(Boolean).join(" ") || "Consumidor Final";
      const toISO = (hhmm: string | null, fecha?: string) => {
        if (!hhmm) return null;
        const [h, m] = hhmm.split(":").map(Number);
        const d = fecha ? new Date(`${fecha}T00:00:00`) : new Date();
        d.setHours(h, m, 0, 0);
        return d.toISOString();
      };
      const esConHora = entrega === "DELIVERY" || entrega === "PICKUP";
      const horaEntregaISO = esConHora ? toISO(horaEntrega, fechaEntrega) : null;
      const horaPrepaISO = esConHora ? toISO(alarmaPrepTime, fechaEntrega) : null;
      const horaRetiroISO = entrega === "DELIVERY" ? toISO(alarmaRetiroTime, fechaEntrega) : null;
      const body = {
        fecha: fechaHoy,
        mesa: mesaActual ? mesaActual.mesa : null,
        esMesaAbierta: false,
        tasaDelDia: bcvRate,
        cliente: nombreCompleto,
        clienteTelefono: clienteTel || null,
        clienteCedula: clienteCi || null,
        direccion: entrega === "DELIVERY" ? direccion || null : null,
        modoEntrega: entrega,
        tipoDelivery: entrega === "DELIVERY" ? "MOTORIZADO" : null,
        motorizadoId: entrega === "DELIVERY" ? motorizadoId : null,
        costoDelivery: costoDeliveryNum,
        despachoPendiente: entrega === "DELIVERY",
        horaEntrega: horaEntregaISO,
        horaPreparacion: horaPrepaISO,
        horaRetiro: horaRetiroISO,
        items: carrito.map((c) => ({ productoId: c.productoId, cantidad: c.qty, extraId: c.extraId ?? undefined, variadaSelecciones: c.variadaSelecciones.length > 0 ? c.variadaSelecciones.filter(Boolean).map(Number) : undefined })),
        pagos: cobroAlEntregar ? [] : isCxP ? [] : isCashea ? [] : pagos.filter((p) => p.metodo && Number(p.monto) > 0).map((p) => ({ metodo: p.metodo, monto: Number(p.monto) })),
        fechaLimitePago: isCxP || isCashea ? (fechaCxC || casheaVence || null) : null,
        cobroAlEntregar: cobroAlEntregar || undefined,
        casheaDatos: isCashea ? { porcentaje: Number(casheaPct) || 40, montoInicial: casheaInicial, montoFinanciado: casheaFinanciado, dias: Number(casheaDiasSelec) || 15, fechaVencimiento: casheaVence, metodoInicial: casheaMetodoInicial || null } : undefined,
      };
      const url = mesaActual ? `/api/ventas/${mesaActual.id}` : "/api/ventas";
      const method = mesaActual ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); alert(err.error ?? "Error al registrar la venta"); return; }
      const payLabel = cobroAlEntregar ? "Cobro al Entregar" : isCxP || isCashea ? (isCashea ? "Cashea" : "CxC") : pagos.filter((p) => p.metodo && Number(p.monto) > 0).map((p) => PAY_OPTS.find((o) => o.key === p.metodo)?.label ?? p.metodo).join(" + ");
      const det = [
        `Total: <strong>${fmt(total)}</strong> (${fmtBs(total, bcvRate)})`,
        `Método: <strong>${payLabel}</strong>`,
        clienteNombre ? `Cliente: <strong>${clienteNombre}</strong>` : "",
        entrega === "DELIVERY" && horaEntrega ? `Entrega: <strong>${horaEntrega}</strong>` : "",
        entrega === "DELIVERY" && motorizadoId
          ? `Motorizado: <strong>${motorizados.find((m) => m.id === motorizadoId)?.nombre ?? ""}</strong>`
          : "",
      ].filter(Boolean).join("<br>");
      setConfirmOverlay({ icon: cobroAlEntregar ? "🛵" : isCxP ? "📋" : "✅", titulo: cobroAlEntregar ? "Pedido registrado" : isCxP ? "CxC generada" : "Cobro registrado", detalle: det });
      if (mesaActual) { setMesaActual(null); void cargarMesasAbiertas(); }
      clearCart();
      setClienteNombre(""); setClienteApellido(""); setClienteCi(""); setClienteTel(""); setDireccion("");
      setHoraEntrega(""); setMotorizadoId(null); setFechaCxC(""); setPagos([{ metodo: "EFECTIVO_BS", monto: "0" }]); setCobroAlEntregar(false);
      setCasheaMetodoInicial(""); setCostoDelivery("0"); setClienteSugerencias([]);
    } finally { setGuardando(false); }
  }

  function saveBorradores(list: Borrador[]) {
    setBorradores(list);
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* cuota */ }
  }

  function confirmarGuardarBorrador() {
    if (carrito.length === 0) return;
    setBorradorNombreInput(clienteNombre.trim() || "");
    setBorradorNombreModal(true);
  }

  function ejecutarGuardarBorrador() {
    const nombre = borradorNombreInput.trim() || `Borrador ${new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
    const nuevo: Borrador = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nombre,
      savedAt: new Date().toISOString(),
      carrito: [...carrito],
      pagos: [...pagos],
      entrega,
      direccion,
      horaEntrega,
      fechaEntrega,
      clienteNombre,
      clienteApellido,
      clienteCi,
      clienteTel,
      costoDelivery,
      total: subtotal + (ivaActivo ? subtotal * 0.16 : 0) + (entrega === "DELIVERY" ? (Number(costoDelivery) || 0) : 0),
    };
    saveBorradores([nuevo, ...borradores]);
    clearCart();
    setClienteNombre(""); setClienteApellido(""); setClienteCi(""); setClienteTel("");
    setDireccion(""); setHoraEntrega(""); setCostoDelivery("0");
    setPagos([{ metodo: "EFECTIVO_BS", monto: "0" }]);
    setEntrega("LOCAL");
    setBorradorNombreModal(false);
  }

  function recuperarBorrador(b: Borrador) {
    setCarrito(b.carrito);
    setPagos(b.pagos);
    setEntrega(b.entrega);
    setDireccion(b.direccion);
    setHoraEntrega(b.horaEntrega);
    setFechaEntrega(b.fechaEntrega);
    setClienteNombre(b.clienteNombre);
    setClienteApellido(b.clienteApellido);
    setClienteCi(b.clienteCi);
    setClienteTel(b.clienteTel);
    setCostoDelivery(b.costoDelivery);
    saveBorradores(borradores.filter((x) => x.id !== b.id));
    catPreviaRef.current = catActiva;
    setCatActiva("PEDIDO");
    setVistaBorradores(false);
  }

  function descartarBorrador(id: string) {
    if (confirm("¿Descartar este pedido guardado? Se perderá el pedido guardado.")) {
      saveBorradores(borradores.filter((b) => b.id !== id));
    }
  }

  const ticketLabel = `#${String(ticketNum).padStart(4, "0")}`;
  const racionesCompletas = carrito.every((c) => c.variadaSelecciones.length === 0 || c.variadaSelecciones.every(Boolean));
  const canCobrar = carrito.length > 0 && !guardando && racionesCompletas && (modoAgenda || entrega === "LOCAL" || !!horaEntrega);
  const canAgenda = modoAgenda && carrito.length > 0 && !agendaGuardando && !!agendaRecordatorioFecha && !!agendaRecordatorioHora;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `:root{${THEME_VARS[theme]}}${CSS}` }} />

      <div className="pos">
        {/* Topbar */}
        <div className="topbar">
          <span className="tb-brand">VentasHG</span>
          <span className="tb-sep">›</span>
          <a className="tb-title" href="/caja">🏠 Caja Rápida</a>
          {/* Chips de mesas abiertas */}
          {mesasAbiertas.length > 0 && (
            <div className="mesa-chips">
              {mesasAbiertas.map((m) => (
                <span key={m.id} style={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <button
                    className={`mesa-chip${mesaActual?.id === m.id ? " active" : ""}`}
                    style={{ borderRadius: "20px 0 0 20px", borderRight: "none", paddingRight: 6 }}
                    onClick={() => {
                      if (mesaActual?.id === m.id) { setMesaActual(null); setCarrito([]); }
                      else { void abrirMesa(m.id); }
                    }}
                    title={mesaActual?.id === m.id ? "Click para deseleccionar" : `Cargar ${m.mesa}`}
                  >
                    🍽️ {m.mesa} ({m.itemCount})
                  </button>
                  <button
                    className="mesa-chip"
                    style={{ borderRadius: "0 20px 20px 0", paddingLeft: 6, paddingRight: 8, opacity: .7 }}
                    onClick={() => void cancelarMesa(m.id, m.mesa)}
                    title={`Cancelar ${m.mesa}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <button
            className="mesa-chip-new"
            title="Guardar carrito como mesa abierta"
            onClick={() => { setMesaNombreInput(mesaActual?.mesa ?? ""); setMesaModalOpen(true); }}
            disabled={carrito.length === 0}
          >
            + Mesa
          </button>
          <button
            className="mesa-chip-new"
            title="Guardar pedido en espera"
            disabled={carrito.length === 0}
            onClick={confirmarGuardarBorrador}
          >
            💾 Guardar
          </button>
          <div className="tb-space" />
          {borradores.length > 0 && (
            <button
              className={`tb-btn${vistaBorradores ? " active" : ""}`}
              style={{ position: "relative" }}
              onClick={() => {
                setVistaBorradores((v) => !v);
                setVistaHistorial(false);
                setVistaAgenda(false);
              }}
            >
              {vistaBorradores ? "← Catálogo" : "📂 Pedidos Guardados"}
              {!vistaBorradores && (
                <span style={{ position: "absolute", top: -3, right: -3, background: "#f59e0b", color: "#1c1c1e", borderRadius: "50%", width: 14, height: 14, fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  {borradores.length}
                </span>
              )}
            </button>
          )}
          <button
            className={`tb-btn${vistaHistorial ? " active" : ""}`}
            onClick={() => { setVistaHistorial((v) => { if (!v) setVistaAgenda(false); return !v; }); }}
          >
            {vistaHistorial ? "← Catálogo" : "📋 Historial de ventas"}
          </button>
          {agendaHabilitada && (
            <button
              className={`tb-btn${vistaAgenda || modoAgenda ? " active" : ""}`}
              style={{ position: "relative" }}
              onClick={() => {
                if (vistaAgenda || modoAgenda) {
                  // salir: limpiar todo estado de agenda
                  setVistaAgenda(false);
                  setModoAgenda(false);
                  setAgendaEditandoId(null);
                  setAgendaRecordatorioFecha(""); setAgendaRecordatorioHora("");
                  setAgendaEntregaFecha(""); setAgendaEntregaHora("");
                  clearCart();
                  setClienteNombre(""); setClienteApellido(""); setClienteCi(""); setClienteTel("");
                  setCatActiva(catPreviaRef.current);
                } else {
                  setVistaHistorial(false);
                  void cargarAgenda();
                  setVistaAgenda(true);
                }
              }}
            >
              {vistaAgenda || modoAgenda ? "← Catálogo" : "📅 Agenda"}
              {agendaPedidos.filter((p) => p.estado === "pendiente").length > 0 && (
                <span style={{ position: "absolute", top: -3, right: -3, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 14, height: 14, fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  {agendaPedidos.filter((p) => p.estado === "pendiente").length}
                </span>
              )}
            </button>
          )}
          <div className="tema-wrap" ref={temaRef}>
            <button className="tb-btn" onClick={() => setTemaOpen((o) => !o)}>
              🎨 Tema ▾
            </button>
            {temaOpen && (
              <div className="tema-dd">
                {THEMES.map((t) => (
                  <button
                    key={t.key}
                    className={`tema-item${theme === t.key ? " active" : ""}`}
                    onClick={() => { changeTheme(t.key); setTemaOpen(false); }}
                  >
                    <span className="tema-swatch" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }} />
                    {t.icon} {t.label}
                    {theme === t.key && <span style={{ marginLeft: "auto" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="tb-clock" ref={clockRef} />
        </div>

        <div className="pos-body">
          {/* ══ BORRADORES PANEL ══ */}
          {vistaBorradores && (
            <div className="hist-panel">
              <div className="borrador-panel">
                <div className="borrador-toolbar">
                  <span style={{ fontSize: 13, fontWeight: 700 }}>📂 Pedidos Guardados</span>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: "var(--t2)" }}>{borradores.length} guardado(s)</span>
                </div>
                {borradores.length === 0 && (
                  <div style={{ textAlign: "center", padding: 32, fontSize: 12, color: "var(--t3)" }}>Sin borradores guardados</div>
                )}
                {borradores.map((b) => {
                  const dt = new Date(b.savedAt);
                  const hora = dt.toLocaleTimeString("es-VE", { timeZone: "America/Caracas", hour: "2-digit", minute: "2-digit", hour12: false });
                  const fecha = dt.toLocaleDateString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "short" });
                  return (
                    <div key={b.id} className="borrador-card">
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div className="borrador-nombre">{b.nombre}</div>
                        <div className="borrador-detail">
                          {b.carrito.map((c) => `${c.nombre} ×${c.qty}`).join(" · ")}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                          <span className="borrador-total">${b.total.toFixed(2)}</span>
                          <span style={{ fontSize: 10, color: "var(--t3)" }}>
                            {b.entrega === "DELIVERY" ? "🛵 Delivery" : b.entrega === "PICKUP" ? "📦 Pick-Up" : "🏠 Local"}
                          </span>
                          <span style={{ fontSize: 10, color: "var(--t3)" }}>⏱ {fecha} {hora}</span>
                        </div>
                      </div>
                      <div className="borrador-actions">
                        <button className="borrador-btn-rec" onClick={() => recuperarBorrador(b)}>↩ Recuperar</button>
                        <button className="borrador-btn-del" onClick={() => descartarBorrador(b.id)}>✕ Descartar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ HISTORIAL PANEL ══ */}
          {vistaAgenda && (
            <div className="hist-panel">
              <div className="agenda-panel">
                <div className="agenda-toolbar">
                  <span style={{ fontSize: 13, fontWeight: 700 }}>📅 Agenda de Pedidos</span>
                  <button className="hist-btn" onClick={cargarAgenda}>↺ Actualizar</button>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: "var(--t2)" }}>
                    {agendaPedidos.filter((p) => p.estado === "pendiente").length} pendientes
                  </span>
                </div>
                {agendaCargando && <div style={{ fontSize: 11, color: "var(--t2)", textAlign: "center", padding: 20 }}>Cargando…</div>}
                {!agendaCargando && agendaPedidos.length === 0 && (
                  <div style={{ fontSize: 11, color: "var(--t2)", textAlign: "center", padding: 20 }}>Sin pedidos agendados</div>
                )}
                {agendaPedidos.map((p) => {
                  const rec = new Date(p.recordatorioAt);
                  const ahora = new Date();
                  const vencido = rec < ahora;
                  const hoyStr = ahora.toLocaleDateString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "2-digit" });
                  const recStr = rec.toLocaleDateString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "2-digit" });
                  const esHoy = hoyStr === recStr;
                  return (
                    <div key={p.id} className={`agenda-card${vencido ? " ag-urgent" : esHoy ? " ag-today" : ""}`}>
                      <div className="ag-time">
                        <div className="ag-date">{esHoy ? "HOY" : recStr}</div>
                        <div className="ag-hour" style={vencido ? { color: "#ef4444" } : {}}>
                          {rec.toLocaleTimeString("es-VE", { timeZone: "America/Caracas", hour: "2-digit", minute: "2-digit", hour12: false })}
                        </div>
                        <div style={{ fontSize: 7, fontWeight: 700, color: vencido ? "#f87171" : "var(--t3)" }}>
                          {vencido ? "🔴 Cobrar" : "🟡 Pendiente"}
                        </div>
                      </div>
                      <div className="ag-info">
                        <div className="ag-name">{p.cliente ?? "Sin nombre"}</div>
                        <div className="ag-detail">
                          <span>{p.items.map((i) => `${i.nombre} ×${i.cantidad}`).join(" · ")}</span>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>${p.totalUsd.toFixed(2)}</span>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                          <span className="ag-tag" style={{ background: "var(--al)", color: "var(--accent)" }}>🔔 {rec.toLocaleDateString("es-VE", { timeZone: "America/Caracas", day: "2-digit", month: "short" })}</span>
                          {p.entregaAt && (
                            <span className="ag-tag" style={{ background: "rgba(34,197,94,.12)", color: "#4ade80" }}>
                              📦 {new Date(p.entregaAt).toLocaleTimeString("es-VE", { timeZone: "America/Caracas", hour: "2-digit", minute: "2-digit", hour12: false })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ag-actions">
                        <button className="ag-btn cobrar" onClick={() => cobrarDesdeAgenda(p)}>💰 Cobrar</button>
                        <button className="ag-btn ver" style={{ borderColor: "#7c3aed", color: "#7c3aed" }} onClick={() => editarAgenda(p)}>✏️ Editar</button>
                        <button className="ag-btn ver" onClick={async () => {
                          if (confirm(`¿Cancelar agenda de ${p.cliente ?? "este pedido"}?`)) {
                            await fetch(`/api/agenda-pedidos/${p.id}`, { method: "DELETE" });
                            void cargarAgenda();
                          }
                        }}>✕ Cancelar</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {vistaHistorial && (
            <div className="hist-panel">
              {/* Toolbar */}
              <div className="hist-head" style={{ flexWrap: "wrap", gap: 6 }}>
                <span className="hist-title">Historial</span>
                <input
                  className="hist-search"
                  type="text"
                  placeholder="Buscar # pedido, cliente…"
                  value={histBusqueda}
                  onChange={(e) => setHistBusqueda(e.target.value)}
                />
                <span style={{ fontSize: 10, color: "var(--t3)", whiteSpace: "nowrap" }}>Desde</span>
                <input className="hist-date" type="date" value={histDesde} onChange={(e) => setHistDesde(e.target.value)} />
                <span style={{ fontSize: 10, color: "var(--t3)", whiteSpace: "nowrap" }}>Hasta</span>
                <input className="hist-date" type="date" value={histHasta} onChange={(e) => setHistHasta(e.target.value)} />
                <button className="hist-btn" onClick={cargarHistorial} style={{ whiteSpace: "nowrap" }}>
                  {histCargando ? "…" : "↺ Buscar"}
                </button>
                {/* Selector de columnas */}
                <div className="hist-cols-wrap" ref={histColsRef}>
                  <button className="hist-btn" onClick={() => setHistColsOpen((o) => !o)}>
                    Columnas ▾
                  </button>
                  {histColsOpen && (
                    <div className="hist-cols-dd">
                      {HIST_COLS.map((col) => (
                        <label key={col.key} className="hist-cols-item">
                          <input
                            type="checkbox"
                            checked={histColsVisibles.has(col.key)}
                            onChange={() => {
                              setHistColsVisibles((prev) => {
                                const next = new Set(prev);
                                if (next.has(col.key)) next.delete(col.key);
                                else next.add(col.key);
                                try { localStorage.setItem("caja-hist-cols", JSON.stringify([...next])); } catch { /* ignore */ }
                                return next;
                              });
                            }}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabla */}
              <div className="hist-table">
                {histCargando ? (
                  <div style={{ padding: "32px 0", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>Cargando…</div>
                ) : (() => {
                  const cv = histColsVisibles;
                  const filtradas = histVentas.filter((v) => {
                    if (!histBusqueda) return true;
                    const q = histBusqueda.toLowerCase();
                    return (
                      String(v.id).includes(q) ||
                      v.cliente.toLowerCase().includes(q) ||
                      v.items.some((i) => i.nombreProducto.toLowerCase().includes(q))
                    );
                  });
                  return (
                    <table>
                      <thead>
                        <tr>
                          {cv.has("pedido")    && <th>Pedido #</th>}
                          {cv.has("fecha")     && <th>Fecha</th>}
                          {cv.has("cliente")   && <th>Cliente</th>}
                          {cv.has("productos") && <th>Productos</th>}
                          {cv.has("total")     && <th>Total</th>}
                          {cv.has("entrega")   && <th>Entrega</th>}
                          {cv.has("cobro")     && <th>Cobro</th>}
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtradas.map((v) => {
                          const fechaStr = v.fecha ? v.fecha.slice(0, 10).split("-").reverse().join("/") : "—";
                          const totalUsd = v.items.reduce((s, i) => s + (i.precioUnit + i.extraPrecio) * i.cantidad, 0);
                          const metodosStr = v.pagos.map((p) => METODO_LABEL[p.metodo] ?? p.metodo).join(" + ") || "—";
                          return (
                            <tr key={v.id}>
                              {cv.has("pedido") && (
                                <td style={{ fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap" }}>
                                  #{String(v.id).padStart(4, "0")}
                                </td>
                              )}
                              {cv.has("fecha") && (
                                <td style={{ color: "var(--t2)", whiteSpace: "nowrap" }}>{fechaStr}</td>
                              )}
                              {cv.has("cliente") && (
                                <td style={{ whiteSpace: "nowrap" }}>{v.cliente}</td>
                              )}
                              {cv.has("productos") && (
                                <td style={{ maxWidth: 200 }}>
                                  {v.items.map((i, idx) => (
                                    <div key={idx}>
                                      {i.nombreProducto}{i.extraNombre ? ` (${i.extraNombre})` : ""} x{i.cantidad}
                                    </div>
                                  ))}
                                </td>
                              )}
                              {cv.has("total") && (
                                <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                  <div>${totalUsd.toFixed(2)}</div>
                                  <div style={{ fontSize: 9, color: "var(--t3)" }}>{metodosStr}</div>
                                </td>
                              )}
                              {cv.has("entrega") && (
                                <td>
                                  <span className={v.modoEntrega === "DELIVERY" ? "hist-badge-cxc" : "hist-badge-pend"}>
                                    {v.modoEntrega === "DELIVERY" ? "Delivery" : "Local"}
                                  </span>
                                  {v.pedidoEntregado && (
                                    <div><span className="hist-badge-ok" style={{ marginTop: 2 }}>Entregado</span></div>
                                  )}
                                </td>
                              )}
                              {cv.has("cobro") && (
                                <td>
                                  {v.cuentaPorCobrar ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                      <span className={v.cuentaCobrada ? "hist-badge-ok" : "hist-badge-pend"}>
                                        {v.cuentaCobrada ? "Cobrada" : "Pendiente"}
                                      </span>
                                      {!v.cuentaCobrada && (
                                        <button
                                          className="hist-btn"
                                          onClick={async () => {
                                            const res = await fetch(`/api/reportes/cuentas-por-cobrar/${v.id}`, {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ cuentaCobrada: true }),
                                            });
                                            if (res.ok) cargarHistorial();
                                          }}
                                        >
                                          Marcar pagada
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: "var(--t3)", fontSize: 10 }}>—</span>
                                  )}
                                </td>
                              )}
                              <td>
                                <button
                                  className="hist-btn"
                                  onClick={() => window.open(`/ventas?pedido=${v.id}`, "_blank")}
                                >
                                  Modificar ▾
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {filtradas.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ textAlign: "center", padding: "24px 0", color: "var(--t3)" }}>
                              Sin ventas para el período seleccionado
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ══ LEFT PANEL ══ */}
          {!vistaHistorial && !vistaAgenda && !vistaBorradores && <div className="left-panel">
            <div className="cat-head">
              <div className="search-wrap">
                <span className="s-icon">⌕</span>
                <input className="search-input" type="text" placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </div>
              <div className="cats">
                {modoAgenda && (
                  <button className={`cat-pill pedido-pill${catActiva === "PEDIDO" ? " active" : ""}`}
                    onClick={() => { setCatActiva("PEDIDO"); setPagina(1); }}>
                    📋 Pedido {carrito.length > 0 && `(${carrito.reduce((s, c) => s + c.qty, 0)})`}
                  </button>
                )}
                {cats.map((f) => (
                  <button key={f.key} className={`cat-pill${catActiva === f.key ? " active" : ""}`} onClick={() => { setCatActiva(f.key); setPagina(1); }}>{f.label}</button>
                ))}
              </div>
            </div>

            {catActiva === "PEDIDO" ? (
              <div className="pedido-view">
                {carrito.length === 0 ? (
                  <div className="pedido-empty">
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🛒</div>
                    Sin productos — selecciona una categoría para agregar
                  </div>
                ) : (
                  <>
                    {carrito.map((c) => (
                      <div key={c.uid} className="pedido-row">
                        <div className="pedido-qty">
                          <button className="pedido-qty-btn" onClick={() => {
                            setCarrito((prev) => {
                              const idx = prev.findIndex((x) => x.uid === c.uid);
                              if (idx === -1) return prev;
                              if (prev[idx].qty <= 1) return prev.filter((x) => x.uid !== c.uid);
                              return prev.map((x, i) => i === idx ? { ...x, qty: x.qty - 1 } : x);
                            });
                          }}>−</button>
                          <span className="pedido-qty-num">{c.qty}</span>
                          <button className="pedido-qty-btn" onClick={() => {
                            setCarrito((prev) => prev.map((x) => x.uid === c.uid ? { ...x, qty: x.qty + 1 } : x));
                          }}>+</button>
                        </div>
                        <div className="pedido-nombre">
                          {c.nombre}{c.extraNombre ? <span style={{ fontSize: 11, color: "var(--t2)" }}> · {c.extraNombre}</span> : null}
                        </div>
                        <div className="pedido-precio">{fmt(c.precio + c.extraPrecio)}</div>
                        <div className="pedido-subtotal">{fmt((c.precio + c.extraPrecio) * c.qty)}</div>
                        <button style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 13, padding: "0 2px" }}
                          onClick={() => setCarrito((prev) => prev.filter((x) => x.uid !== c.uid))}>✕</button>
                      </div>
                    ))}
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "2px solid var(--tl)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--t2)" }}>{carrito.reduce((s, c) => s + c.qty, 0)} ítem(s)</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{fmt(subtotal)}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
            <div className="product-grid">
              {filtrados.length === 0 && (
                <div style={{ gridColumn: "1/-1", padding: "32px 0", textAlign: "center", color: "var(--t3)", fontSize: 12 }}>
                  {productos.length === 0 ? "Cargando productos…" : "Sin resultados"}
                </div>
              )}
              {filtradosPag.map((prod) => {
                const qty = cartMap[prod.id] ?? 0;
                const isExp = expandedId === prod.id;
                return (
                  <div key={prod.id} className={`p-card${qty > 0 ? " in-cart" : ""}`} style={{ position: "relative" }}>
                    <div onClick={() => clickProducto(prod)}>
                      <div className="p-thumb">
                        {prod.imagenUrl
                          ? <img src={prod.imagenUrl} alt={prod.nombre} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ wordBreak: "break-word", overflow: "hidden" }}>{prod.nombre}</span>
                        }
                        {qty > 0 && <span className="p-badge">{qty}</span>}
                      </div>
                      <div className="p-info">
                        <div className="p-name">{prod.nombre}</div>
                        <div className="p-row">
                          <span className="p-price">{fmt(prod.precioVenta)}</span>
                          {prod.extras.length > 0 && <span className="p-opts-tag">opciones ▾</span>}
                        </div>
                      </div>
                    </div>
                    {isExp && (
                      <div className="p-extras-overlay" onClick={(e) => e.stopPropagation()}>
                        <div className="p-extras-label">{fmt(prod.precioVenta)} · Preparación</div>
                        <div className="p-extras-wrap">
                          {prod.extras.map((ex) => (
                            <button key={ex.id} className="p-extra-btn" onClick={() => addToCart(prod, ex)}>
                              {ex.nombre}{ex.precioAdicional > 0 ? ` +${fmt(ex.precioAdicional)}` : ""}
                            </button>
                          ))}
                          <button className="p-extra-sin" onClick={() => addToCart(prod, null)}>Sin preferencia</button>
                        </div>
                        <button className="p-extra-close" onClick={() => setExpandedId(null)}>✕</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {totalPags > 1 && (
                <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0" }}>
                  <button className="pg-btn" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>‹</button>
                  <span style={{ fontSize: 11, color: "var(--t2)" }}>{pagina} / {totalPags}</span>
                  <button className="pg-btn" disabled={pagina === totalPags} onClick={() => setPagina((p) => p + 1)}>›</button>
                </div>
              )}
            </div>
            )}

            {/* ── Bottom bar: Entrega | Cliente ── */}
            <div className="bottom-bar">
              {/* Entrega */}
              <div className="bb-col">
                <div className="bb-label">Entrega</div>
                <div className="toggle-row">
                  <button className={`tog-opt${entrega === "LOCAL" && !modoAgenda ? " active" : ""}`} onClick={() => { setEntrega("LOCAL"); setModoAgenda(false); }}>🏠 Local</button>
                  <button className={`tog-opt${entrega === "DELIVERY" && !modoAgenda ? " active" : ""}`} onClick={() => { setEntrega("DELIVERY"); setModoAgenda(false); }}>🛵 Delivery</button>
                  <button className={`tog-opt${entrega === "PICKUP" && !modoAgenda ? " active" : ""}`} onClick={() => { setEntrega("PICKUP"); setModoAgenda(false); }}>📦 Pick-Up</button>
                  {agendaHabilitada && (
                    <button className={`tog-opt${modoAgenda ? " active" : ""}`} onClick={() => {
                      setModoAgenda((v) => {
                        if (!v) { catPreviaRef.current = catActiva; setCatActiva("PEDIDO"); }
                        else { setCatActiva(catPreviaRef.current); }
                        return !v;
                      });
                    }}>📅 Agenda</button>
                  )}
                </div>
                {modoAgenda && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".07em" }}>📅 Agenda — sin cobro ni inventario</div>
                    <div className="hora-row">
                      <div style={{ flex: 1 }}>
                        <div className="f-label">🔔 Recordatorio de Cobro — Fecha</div>
                        <input className="f-input" type="date" value={agendaRecordatorioFecha} onChange={(e) => setAgendaRecordatorioFecha(e.target.value)} />
                      </div>
                      <div style={{ flex: "0 0 100px" }}>
                        <div className="f-label">Hora</div>
                        <input className="f-input" type="time" value={agendaRecordatorioHora} onChange={(e) => setAgendaRecordatorioHora(e.target.value)} />
                      </div>
                    </div>
                    <div className="hora-row">
                      <div style={{ flex: 1 }}>
                        <div className="f-label">📦 Entrega del Pedido — Fecha</div>
                        <input className="f-input" type="date" value={agendaEntregaFecha} onChange={(e) => setAgendaEntregaFecha(e.target.value)} />
                      </div>
                      <div style={{ flex: "0 0 100px" }}>
                        <div className="f-label">Hora</div>
                        <input className="f-input" type="time" value={agendaEntregaHora} onChange={(e) => setAgendaEntregaHora(e.target.value)} />
                      </div>
                    </div>
                    <div className="hora-row">
                      <div style={{ flex: 1 }}>
                        <div className="f-label">🍳 Avisar preparar (mins antes)</div>
                        <select className="f-input" value={agendaMinsPrepa} onChange={(e) => setAgendaMinsPrepa(e.target.value)}>
                          <option value="30">30 min</option>
                          <option value="45">45 min</option>
                          <option value="60">60 min</option>
                          <option value="90">90 min</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="f-label">🛵 Avisar retiro (mins antes)</div>
                        <select className="f-input" value={agendaMinsRetiro} onChange={(e) => setAgendaMinsRetiro(e.target.value)}>
                          <option value="10">10 min</option>
                          <option value="15">15 min</option>
                          <option value="20">20 min</option>
                          <option value="30">30 min</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                {!modoAgenda && entrega === "DELIVERY" && (
                  <>
                    <div>
                      <div className="f-label">Dirección</div>
                      <input className="f-input" type="text" placeholder="Av. Principal…" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                    </div>
                    <div className="hora-row">
                      <div style={{ flex: "0 0 90px" }}>
                        <div className="f-label">Costo delivery ($)</div>
                        <input className="f-input" type="number" min="0" step="0.5" value={costoDelivery}
                          onChange={(e) => setCostoDelivery(e.target.value)} />
                      </div>
                      <div style={{ flex: "0 0 110px" }}>
                        <div className="f-label">Fecha entrega</div>
                        <input className="f-input" type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="f-label">Hora entrega *</div>
                        <input className="f-input" type="time" value={horaEntrega} onChange={(e) => setHoraEntrega(e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="f-label">Avisar preparar</div>
                        <select className="f-input" value={minutosPrep} onChange={(e) => setMinutosPrep(e.target.value)}>
                          <option value="5">5 min antes</option>
                          <option value="15">15 min antes</option>
                          <option value="30">30 min antes</option>
                          <option value="45">45 min antes</option>
                          <option value="60">60 min antes</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="f-label">Avisar retiro</div>
                        <select className="f-input" value={minutosRetiro} onChange={(e) => setMinutosRetiro(e.target.value)}>
                          <option value="5">5 min antes</option>
                          <option value="10">10 min antes</option>
                          <option value="15">15 min antes</option>
                          <option value="30">30 min antes</option>
                        </select>
                      </div>
                    </div>
                    {(alarmaPrepTime || alarmaRetiroTime) && (
                      <div style={{ display: "flex", gap: 10, fontSize: 10, color: "var(--t2)" }}>
                        {alarmaPrepTime && <span>⏰ Preparar: <strong>{alarmaPrepTime}</strong></span>}
                        {alarmaRetiroTime && <span>🏍 Retiro: <strong>{alarmaRetiroTime}</strong></span>}
                      </div>
                    )}
                    {motorizados.length > 0 && (
                      <div>
                        <div className="f-label">Motorizado</div>
                        <div className="moto-wrap">
                          {motorizados.map((m) => (
                            <button key={m.id} className={`moto-btn${motorizadoId === m.id ? " active" : ""}`}
                              onClick={() => setMotorizadoId(motorizadoId === m.id ? null : m.id)}>
                              {m.nombre}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {!modoAgenda && entrega === "PICKUP" && (
                  <div className="hora-row" style={{ marginTop: 6 }}>
                    <div style={{ flex: "0 0 110px" }}>
                      <div className="f-label">Fecha Pick-Up</div>
                      <input className="f-input" type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="f-label">Hora Pick-Up *</div>
                      <input className="f-input" type="time" value={horaEntrega} onChange={(e) => setHoraEntrega(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="f-label">Avisar preparar</div>
                      <select className="f-input" value={minutosPrep} onChange={(e) => setMinutosPrep(e.target.value)}>
                        <option value="5">5 min antes</option>
                        <option value="15">15 min antes</option>
                        <option value="30">30 min antes</option>
                        <option value="45">45 min antes</option>
                        <option value="60">60 min antes</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Cliente */}
              <div className="bb-col">
                <div className="bb-label">Cliente</div>
                <div className="hora-row">
                  <div style={{ flex: 1, position: "relative" }}>
                    <div className="f-label">Nombre</div>
                    <input ref={clienteNombreRef} className="f-input" type="text" placeholder="Consumidor Final" value={clienteNombre}
                      onChange={(e) => { setClienteNombre(e.target.value); setClienteCampoActivo("nombre"); buscarCliente(e.target.value); }}
                      onBlur={() => setTimeout(() => { setClienteSugerencias([]); setClienteCampoActivo(null); }, 150)}
                    />
                    {clienteCampoActivo === "nombre" && clienteSugerencias.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                        background: "var(--surface)", border: "1px solid var(--border,#ccc)",
                        borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.15)", maxHeight: 180, overflowY: "auto" }}>
                        {clienteSugerencias.map((s) => (
                          <div key={s.id} onMouseDown={() => seleccionarCliente(s)}
                            style={{ padding: "7px 10px", cursor: "pointer", fontSize: 12,
                              borderBottom: "1px solid var(--border,#eee)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--al,#f0f9ff)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                            <strong>{s.nombre}</strong>
                            {s.cedula && <span style={{ color: "var(--t3,#888)", marginLeft: 6 }}>{s.cedula}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="f-label">Apellido</div>
                    <input className="f-input" type="text" placeholder="Apellido" value={clienteApellido} onChange={(e) => setClienteApellido(e.target.value)} />
                  </div>
                </div>
                <div className="hora-row">
                  <div style={{ flex: 1, position: "relative" }}>
                    <div className="f-label">C.I / RIF</div>
                    <input className="f-input" type="text" placeholder="V-00000000" value={clienteCi}
                      onChange={(e) => { setClienteCi(e.target.value); setClienteCampoActivo("ci"); buscarCliente(e.target.value); }}
                      onBlur={() => setTimeout(() => { setClienteSugerencias([]); setClienteCampoActivo(null); }, 150)}
                    />
                    {clienteCampoActivo === "ci" && clienteSugerencias.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                        background: "var(--surface)", border: "1px solid var(--border,#ccc)",
                        borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,.15)", maxHeight: 180, overflowY: "auto" }}>
                        {clienteSugerencias.map((s) => (
                          <div key={s.id} onMouseDown={() => seleccionarCliente(s)}
                            style={{ padding: "7px 10px", cursor: "pointer", fontSize: 12,
                              borderBottom: "1px solid var(--border,#eee)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--al,#f0f9ff)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                            <strong>{s.cedula ?? s.nombre}</strong>
                            <span style={{ color: "var(--t3,#888)", marginLeft: 6 }}>{s.nombre}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="f-label">Teléfono</div>
                    <input className="f-input" type="tel" placeholder="0414-000-0000" value={clienteTel} onChange={(e) => setClienteTel(e.target.value)} />
                  </div>
                </div>
                {entrega === "LOCAL" && (
                  <div>
                    <div className="f-label">Dirección</div>
                    <input className="f-input" type="text" placeholder="Opcional" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          </div>}

          {/* ══ RIGHT PANEL (ticket) ══ */}
          <div className="ticket">
            <div className="t-head">
              <div>
                <div className="t-num-lbl">Ticket</div>
                <div className="t-num">{ticketLabel}</div>
              </div>
              <button className="t-clear" onClick={clearCart}>Limpiar</button>
            </div>

            <div className="t-scroll">
              {carrito.length === 0 ? (
                <div className="t-empty">
                  <span className="t-empty-icon">🛒</span>
                  <span>Toca un producto para agregar</span>
                </div>
              ) : carrito.map((c) => {
                const esVariada = c.variadaSelecciones.length > 0;
                const racionesOk = esVariada && c.variadaSelecciones.every(Boolean);
                const normalProds = productos.filter((p) => p.tipoProducto === "NORMAL" && p.tipoEmpaqueNombre?.toLowerCase().includes("ración"));
                return (
                  <div key={c.uid} className="line" style={{ flexDirection: "column", alignItems: "stretch", gap: 0, padding: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 14px" }}>
                      <div className="li">
                        <div className="li-name">{c.nombre}</div>
                        {c.extraNombre && <div className="li-nota">· {c.extraNombre}</div>}
                        <div className="li-unit">{fmt(c.precio + c.extraPrecio)} c/u</div>
                      </div>
                      <div className="qty">
                        <button className="q-btn rm" onClick={() => setQty(c.uid, -1)}>−</button>
                        <span className="q-val">{c.qty}</span>
                        <button className="q-btn" onClick={() => setQty(c.uid, +1)}>+</button>
                      </div>
                      <div className="li-total">{fmt((c.precio + c.extraPrecio) * c.qty)}</div>
                    </div>
                    {esVariada && (
                      <div className="raciones-blk">
                        <div className="raciones-hd">Raciones <span className="raciones-badge">{c.variadaSelecciones.length}</span></div>
                        {c.variadaSelecciones.map((sel, idx) => (
                          <div key={idx} className="racion-row">
                            <div className={`racion-num${sel ? " ok" : ""}`}>{idx + 1}</div>
                            <select className={`racion-sel${sel ? " ok" : ""}`} value={sel}
                              onChange={(e) => setRacion(c.uid, idx, e.target.value)}>
                              <option value="">Ración {idx + 1} — elige</option>
                              {normalProds.map((p) => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
                            </select>
                          </div>
                        ))}
                        <div className={`raciones-hint${racionesOk ? " ok" : " warn"}`}>
                          {racionesOk ? "✓ Raciones completas" : `⚠ Selecciona ${c.variadaSelecciones.filter((s) => !s).length} más`}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="t-bottom">
              {/* IVA */}
              <div className="iva-row">
                <span className="iva-lbl">IVA (16%)</span>
                <span className={`iva-badge ${ivaActivo ? "iva-on" : "iva-off"}`}>{ivaActivo ? "Activado" : "Desactivado"}</span>
                <label className="switch">
                  <input type="checkbox" checked={ivaActivo} onChange={(e) => setIvaActivo(e.target.checked)} />
                  <span className="slider" />
                </label>
              </div>

              {/* Totals */}
              <div className="tot-lines" style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 0" }}>
                <div className="tot-item"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {ivaActivo && <div className="tot-item"><span>IVA 16%</span><span>{fmt(ivaAmt)}</span></div>}
                {costoDeliveryNum > 0 && <div className="tot-item"><span>Delivery</span><span>{fmt(costoDeliveryNum)} / {fmtBs(costoDeliveryNum, bcvRate)}</span></div>}
                <div className="tot-item" style={{ fontWeight: 700, fontSize: 14, borderTop: "1px solid var(--tl)", paddingTop: 4, marginTop: 2 }}><span>Total a pagar</span><span>{fmt(total)}</span></div>
                <div className="tot-item" style={{ fontSize: 11, color: "var(--tt2)" }}><span></span><span>{fmtBs(total, bcvRate)}</span></div>
                {totalPagado > 0 && <div className="tot-item" style={{ fontSize: 11, color: totalPagado >= total ? "#16a34a" : "var(--accent)" }}><span>Total pagado</span><span>{fmt(totalPagado)} / {fmtBs(totalPagado, bcvRate)}</span></div>}
              </div>

              {/* BCV + Converter */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div className="bcv-conv">
                  <span className="bcv-lbl">Bs/$</span>
                  <input className="bcv-inp" type="number" step="0.01" min="1" value={bcvInput} onChange={(e) => onBcv(e.target.value)} />
                  <button title="Actualizar tasa BCV" disabled={consultandoBcv} onClick={actualizarBcv} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--tt2)", padding: "0 2px", opacity: consultandoBcv ? 0.5 : 1 }}>↻</button>
                  <button onClick={() => setMostrarHistBcv((v) => !v)} style={{ background: "none", border: "1px solid var(--border,#ccc)", borderRadius: 4, cursor: "pointer", fontSize: 9, color: "var(--tt2)", padding: "1px 5px" }}>{mostrarHistBcv ? "✕ hist." : "hist."}</button>
                  <div className="vdiv" />
                  <span className="c-sym">$</span>
                  <input className="c-inp" type="number" placeholder="0.00" value={convUsd} onChange={(e) => fromUsd(e.target.value)} />
                  <span className="c-arr">⇄</span>
                  <span className="c-sym">Bs</span>
                  <input className="c-inp" type="number" placeholder="0,00" value={convBs} onChange={(e) => fromBs(e.target.value)} />
                </div>
                {mostrarHistBcv && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", background: "var(--surface)", border: "1px solid var(--border,#ccc)", borderRadius: 6, padding: "6px 8px" }}>
                    <input type="date" style={{ border: "1px solid var(--border,#ccc)", borderRadius: 4, padding: "2px 6px", fontSize: 11, background: "var(--surface)", color: "var(--tt)" }}
                      onChange={(e) => buscarBcvFecha(e.target.value)} />
                    {bcvFechaMsg && <span style={{ fontSize: 10, color: "#15803d" }}>{bcvFechaMsg}</span>}
                    {bcvFechaErr && <span style={{ fontSize: 10, color: "#dc2626" }}>{bcvFechaErr}</span>}
                  </div>
                )}
              </div>

              {/* Pay methods */}
              <div className="pay-sec">
                <div className="pay-lbl">Formas de Pago</div>
                {pagos.map((pago, idx) => {
                  const montoUsd = Number(pago.monto) || 0;
                  const montoBs = montoUsd * bcvRate;
                  return (
                    <div key={idx} style={{ marginBottom: 8 }}>
                      <div className="pay-grid">
                        {PAY_OPTS.map((opt) => (
                          <button key={opt.key} className={`pay-btn${pago.metodo === opt.key ? " active" : ""}`}
                            onClick={() => { setCobroAlEntregar(false); setPagos((prev) => prev.map((p, i) => i === idx ? { ...p, metodo: p.metodo === opt.key ? "" : opt.key } : p)); }}>
                            <span className="pay-ico">{opt.icon}</span>{opt.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 5, marginTop: 5, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "var(--tt2)", whiteSpace: "nowrap" }}>Bs</span>
                        <input type="number" min="0" step="0.01" placeholder="0,00"
                          value={montoBs > 0 ? montoBs.toFixed(2) : ""}
                          onChange={(e) => {
                            const bs = Number(e.target.value) || 0;
                            setPagos((prev) => prev.map((p, i) => i === idx ? { ...p, monto: bcvRate > 0 ? (bs / bcvRate).toFixed(6) : "0" } : p));
                          }}
                          style={{ flex: 1, border: "1px solid var(--tl)", borderRadius: 6, padding: "4px 8px", fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
                        <span style={{ fontSize: 10, color: "var(--tt2)" }}>$</span>
                        <input type="number" min="0" step="0.01" placeholder="0.00"
                          value={montoUsd > 0 ? montoUsd.toFixed(2) : ""}
                          onChange={(e) => setPagos((prev) => prev.map((p, i) => i === idx ? { ...p, monto: e.target.value } : p))}
                          style={{ width: 68, border: "1px solid var(--tl)", borderRadius: 6, padding: "4px 6px", fontSize: 12, background: "var(--surface)", color: "var(--text)" }} />
                        {pagos.length > 1 && (
                          <button onClick={() => setPagos((prev) => prev.filter((_, i) => i !== idx))}
                            style={{ padding: "3px 7px", border: "1px solid #dc2626", borderRadius: 5, background: "none", color: "#dc2626", fontSize: 10, cursor: "pointer", flexShrink: 0 }}>✕</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => {
                  const pagado = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
                  const restante = Math.max(0, total - pagado);
                  setPagos((prev) => [...prev, { metodo: "EFECTIVO_BS", monto: restante.toFixed(2) }]);
                }}
                  style={{ width: "100%", marginTop: 2, padding: "5px", border: "1.5px dashed var(--tl)", borderRadius: 6, background: "none", color: "var(--tt2)", fontSize: 11, cursor: "pointer" }}>
                  + Agregar método de pago
                </button>
                <button className={`cobro-entregar-btn${cobroAlEntregar ? " active" : ""}`}
                  onClick={() => { setCobroAlEntregar((v) => !v); if (!cobroAlEntregar) setPagos([{ metodo: "", monto: "0" }]); else setPagos([{ metodo: "EFECTIVO_BS", monto: "0" }]); }}>
                  🛵 Cobro al Entregar
                </button>
                {cobroAlEntregar && (
                  <div style={{ marginTop: 5, padding: "5px 8px", borderRadius: 6, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", color: "#92400e", fontSize: 10, lineHeight: 1.4 }}>
                    ℹ️ Sin pago anticipado — el motorizado cobra al entregar. Se registra en Pedidos Pendientes.
                  </div>
                )}
              </div>

              {isCashea && (
                <div style={{ background: "#FFFDE7", border: "1px solid #F9E04A", borderRadius: 7, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#7A6A00", textTransform: "uppercase", marginBottom: 2 }}>% Cuota inicial</div>
                      <select style={{ border: "1px solid #E0D080", borderRadius: 5, padding: "3px 6px", fontSize: 11, background: "#fff" }} value={casheaPct} onChange={(e) => setCasheaPct(e.target.value)}>
                        {casheaPorcentajes.map((p) => <option key={p} value={p}>{p}%</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#7A6A00", textTransform: "uppercase", marginBottom: 2 }}>Días</div>
                      <select style={{ border: "1px solid #E0D080", borderRadius: 5, padding: "3px 6px", fontSize: 11, background: "#fff" }} value={casheaDiasSelec} onChange={(e) => setCasheaDiasSelec(e.target.value)}>
                        {casheaDiasOpciones.map((d) => <option key={d} value={d}>{d} días</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#7A6A00", textTransform: "uppercase", marginBottom: 2 }}>Forma de pago inicial</div>
                      <select style={{ width: "100%", border: "1px solid #E0D080", borderRadius: 5, padding: "3px 6px", fontSize: 11, background: "#fff" }} value={casheaMetodoInicial} onChange={(e) => setCasheaMetodoInicial(e.target.value)}>
                        <option value="">Seleccionar</option>
                        {PAY_OPTS.filter((p) => p.key !== "CASHEA" && p.key !== "CXC_DIRECTA").map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 10, color: "#5A4A00" }}>
                    <span>Inicial: <strong>${casheaInicial.toFixed(2)}</strong></span>
                    <span>Financiado: <strong style={{ color: "#B8860B" }}>${casheaFinanciado.toFixed(2)}</strong></span>
                    <span>Vence: <strong>{casheaVence}</strong></span>
                  </div>
                </div>
              )}
              {!isCashea && isCxP && (
                <>
                  <div className="cxp-note">ℹ️ Genera <strong>Cuenta por Cobrar</strong> pendiente.</div>
                  <div className="cxc-wrap">
                    <div className="cxc-lbl">Fecha límite de pago</div>
                    <input className="t-inp-dark" type="date" value={fechaCxC} onChange={(e) => setFechaCxC(e.target.value)} style={{ fontSize: 11 }} />
                  </div>
                </>
              )}

              <div className="cobrar-wrap">
                {modoAgenda ? (
                  <button className="cobrar-btn" disabled={!canAgenda}
                    style={canAgenda ? { background: "#7c3aed" } : undefined}
                    onClick={() => void guardarEnAgenda()}>
                    <span>📅</span>
                    <span>
                      {carrito.length === 0 ? "Sin productos"
                        : agendaGuardando ? "Guardando…"
                        : !agendaRecordatorioFecha || !agendaRecordatorioHora ? "Elige fecha de recordatorio"
                        : agendaEditandoId !== null ? `Actualizar Agenda · ${fmt(total)}` : `Guardar en Agenda · ${fmt(total)}`}
                    </span>
                  </button>
                ) : (
                  <button className="cobrar-btn" disabled={!canCobrar} onClick={cobrar}>
                    <span>⚡</span>
                    <span>
                      {carrito.length === 0 ? "Sin productos"
                        : guardando ? "Registrando…"
                        : cobroAlEntregar ? `Registrar Pedido · ${fmt(total)}`
                        : isCashea ? `Generar Cashea · ${fmt(total)}`
                        : isCxP ? `Generar CxC · ${fmt(total)}`
                        : `Cobrar ${fmt(total)}`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: nombre del borrador */}
      {borradorNombreModal && (
        <div className="overlay">
          <div className="ov-card" style={{ textAlign: "left", gap: 10, maxWidth: 320 }}>
            <div style={{ fontSize: 26 }}>💾</div>
            <div className="cf-title" style={{ textAlign: "left" }}>Guardar pedido en espera</div>
            <div className="cf-detail" style={{ textAlign: "left" }}>
              El carrito se guardará y podrás recuperarlo desde <strong>📂 Pedidos Guardados</strong>. Opcionalmente ponle un nombre para identificarlo.
            </div>
            <input
              className="f-input"
              type="text"
              placeholder="Ej: Cliente Juan, Mesa 2…"
              value={borradorNombreInput}
              onChange={(e) => setBorradorNombreInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ejecutarGuardarBorrador(); if (e.key === "Escape") setBorradorNombreModal(false); }}
              autoFocus
              style={{ width: "100%", marginTop: 4 }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="cf-ok" style={{ flex: 1 }} onClick={ejecutarGuardarBorrador}>💾 Guardar</button>
              <button className="cf-cancel" style={{ flex: 1 }} onClick={() => setBorradorNombreModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: sin cliente en agenda */}
      {agendaSinClienteModal && (
        <div className="overlay">
          <div className="ov-card" style={{ textAlign: "left", gap: 10, maxWidth: 340 }}>
            <div style={{ fontSize: 26 }}>👤</div>
            <div className="cf-title" style={{ textAlign: "left" }}>Sin cliente seleccionado</div>
            <div className="cf-detail" style={{ textAlign: "left", lineHeight: 1.5 }}>
              No ha seleccionado ningún cliente para la agenda del pedido. ¿Desea continuar sin cliente o agregar uno?
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <button className="cf-ok" style={{ flex: 1, background: "#7c3aed" }}
                onClick={() => { setAgendaSinClienteModal(false); setTimeout(() => clienteNombreRef.current?.focus(), 50); }}>
                ✏️ Agregar cliente
              </button>
              <button className="cf-cancel" style={{ flex: 1 }}
                onClick={() => { setAgendaSinClienteModal(false); void guardarEnAgenda(true); }}>
                Continuar sin cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agenda Alert Overlay */}
      {agendaAlertaActual && agendaAlertasPantalla && (
        <div className="ag-alert-overlay" style={{ position: "fixed" }}>
          <div className="ag-alert-box">
            <div className="ag-alert-emoji">🔔</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Recordatorio de Pedido</div>
            <div style={{ fontSize: 12, color: "var(--t2)" }}>
              <strong>{agendaAlertaActual.cliente ?? "Sin nombre"}</strong>
            </div>
            <div style={{ fontSize: 11, color: "var(--t2)" }}>
              {agendaAlertaActual.items.map((i) => `${i.nombre} ×${i.cantidad}`).join(", ")}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>${agendaAlertaActual.totalUsd.toFixed(2)}</div>
            <div className="ag-alert-btns">
              <button className="ag-btn cobrar" onClick={() => { cobrarDesdeAgenda(agendaAlertaActual); setAgendaAlertaActual(null); }}>💰 Cobrar ahora</button>
              <button className="ag-btn ver" onClick={() => { agendaAlertasDismissedRef.current.add(agendaAlertaActual.id); setAgendaAlertaActual(null); }}>Recordar después</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mesa Abierta */}
      {mesaModalOpen && (
        <div className="overlay">
          <div className="ov-card" style={{ textAlign: "left", gap: 8 }}>
            <div style={{ fontSize: 22 }}>🍽️</div>
            <div className="cf-title" style={{ textAlign: "left" }}>{mesaActual ? "Actualizar mesa" : "Guardar como Mesa"}</div>
            <div className="cf-detail" style={{ textAlign: "left" }}>
              {carrito.length} ítem(s) en el carrito. Ingresa el nombre o número de la mesa.
            </div>
            <input
              className="t-inp-dark"
              type="text"
              placeholder="Ej: Mesa 1, Barra, Mesa Terraza…"
              value={mesaNombreInput}
              onChange={(e) => setMesaNombreInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void guardarMesaAbierta(mesaNombreInput); }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="cf-ok"
                style={{ flex: 1 }}
                disabled={!mesaNombreInput.trim() || mesaGuardando}
                onClick={() => void guardarMesaAbierta(mesaNombreInput)}
              >
                {mesaGuardando ? "Guardando…" : "Guardar mesa"}
              </button>
              <button
                className="t-clear"
                onClick={() => setMesaModalOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOverlay && (
        <div className="overlay">
          <div className="ov-card">
            <div className="cf-icon">{confirmOverlay.icon}</div>
            <div className="cf-title">{confirmOverlay.titulo}</div>
            <div className="cf-detail" dangerouslySetInnerHTML={{ __html: confirmOverlay.detalle }} />
            <button className="cf-ok" onClick={() => setConfirmOverlay(null)}>Nueva venta</button>
          </div>
        </div>
      )}
    </>
  );
}
