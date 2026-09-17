"use client";

import { useEffect, useRef, useState } from "react";

/* ── Types ─────────────────────────────────────────────── */
type Extra = { id: number; nombre: string; precioAdicional: number };
type Producto = {
  id: number;
  nombre: string;
  precioVenta: number;
  categoriaNombre: string | null;
  extras: Extra[];
};
type Motorizado = { id: number; nombre: string; apellido: string };
type LineaCarrito = {
  uid: string;
  productoId: number;
  nombre: string;
  precio: number;
  qty: number;
  extraId: number | null;
  extraNombre: string | null;
  extraPrecio: number;
};

/* ── Helpers ────────────────────────────────────────────── */
let _uid = 0;
function uid() { return `c${++_uid}`; }
function fmt(n: number) { return `$${n.toFixed(2)}`; }
function fmtBs(n: number, tasa: number) {
  return `Bs ${(n * tasa).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

const PAY_OPTS = [
  { key: "EFECTIVO_BS",  label: "Efectivo Bs",  icon: "💵" },
  { key: "PUNTO_VENTA",  label: "Punto",         icon: "💳" },
  { key: "PAGO_MOVIL",   label: "Pago Móvil",    icon: "📱" },
  { key: "EFECTIVO_USD", label: "USD Cash",       icon: "💲" },
  { key: "CASHEA",       label: "Cashea",         icon: "📋" },
  { key: "CXC_DIRECTA",  label: "CxC",            icon: "🤝" },
] as const;

const CXP_METHODS = ["CASHEA", "CXC_DIRECTA"];

/* ── Styles (inline via style tag trick via globals) ────── */
const css = `
html,body{height:100%;margin:0;padding:0;background:#1C1C1E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;font-size:13px;color:#F0EDE8}
*,*::before,*::after{box-sizing:border-box}
button{font-family:inherit;cursor:pointer}
input{font-family:inherit}
:root{
  --bg:#F5F2ED;--surface:#FFF;--topbar:#1C1C1E;
  --dk:#242426;--dk2:#2E2E30;--dk3:#383838;
  --accent:#C8960C;--accent-lite:rgba(200,150,12,.13);--accent-bd:#D4A820;
  --text:#1C1C1E;--text2:#78786E;--text3:#AEAE9E;--border:#E8E4DC;
  --tt:#F0EDE8;--tt2:#888880;--tt3:#555550;--ttline:#343434;
  --success:#27AE60;
}
.pos{display:flex;flex-direction:column;height:100vh}
.topbar{background:var(--topbar);color:#ddd;height:46px;display:flex;align-items:center;gap:14px;padding:0 16px;flex-shrink:0;border-bottom:1px solid #2e2e2e}
.tb-brand{font-weight:700;font-size:12px;color:var(--accent);letter-spacing:.05em;text-transform:uppercase}
.tb-sep{color:#444}
.tb-title{font-size:13px;font-weight:500;color:#ccc}
.tb-space{flex:1}
.tb-meta{font-size:11px;color:#666;display:flex;gap:14px;align-items:center}
.tb-dot{width:6px;height:6px;background:var(--accent);border-radius:50%;display:inline-block;margin-right:4px}
.pos-body{flex:1;display:flex;min-height:0;overflow:hidden}
.catalog{flex:1;display:flex;flex-direction:column;background:var(--bg);overflow:hidden;min-width:0}
.cat-head{padding:10px 14px 0;display:flex;flex-direction:column;gap:8px;flex-shrink:0}
.search-wrap{position:relative}
.s-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px;pointer-events:none}
.search-input{width:100%;padding:7px 10px 7px 28px;border:1.5px solid var(--border);border-radius:7px;font-size:12px;background:var(--surface);color:var(--text);outline:none;transition:border-color .15s}
.search-input:focus{border-color:var(--accent)}
.search-input::placeholder{color:var(--text3)}
.cats{display:flex;gap:5px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none}
.cats::-webkit-scrollbar{display:none}
.cat-pill{flex-shrink:0;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:500;cursor:pointer;border:1.5px solid var(--border);background:var(--surface);color:var(--text2);transition:all .15s;white-space:nowrap}
.cat-pill.active{background:var(--topbar);color:#fff;border-color:var(--topbar)}
.product-grid{flex:1;overflow-y:auto;padding:8px 14px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px;align-content:start;scrollbar-width:thin;scrollbar-color:var(--border) transparent}
.p-card{background:var(--surface);border:1.5px solid var(--border);border-radius:9px;overflow:hidden;cursor:pointer;transition:transform .1s,border-color .1s,box-shadow .1s;user-select:none;position:relative}
.p-card:hover{transform:translateY(-1px);border-color:var(--accent-bd);box-shadow:0 3px 10px rgba(200,150,12,.12)}
.p-card:active{transform:scale(.97)}
.p-card.in-cart{border-color:var(--accent-bd)}
.p-img{width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:28px;background:var(--bg);position:relative}
.p-badge{position:absolute;top:5px;right:5px;background:var(--accent);color:#fff;font-size:9px;font-weight:700;width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.p-extras-tag{position:absolute;bottom:4px;left:4px;background:rgba(28,28,30,.65);color:#fff;font-size:9px;font-weight:600;padding:2px 5px;border-radius:4px}
.p-info{padding:7px 8px}
.p-name{font-size:11px;font-weight:500;color:var(--text);line-height:1.3;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p-price{font-size:12px;font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums}
.ticket{width:338px;flex-shrink:0;background:var(--dk);display:flex;flex-direction:column;border-left:1px solid #2a2a2a;overflow:hidden}
.t-head{padding:10px 14px;border-bottom:1px solid var(--ttline);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.t-num-label{font-size:10px;color:var(--tt2);font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.t-num{font-size:15px;font-weight:700;color:var(--tt);font-variant-numeric:tabular-nums}
.t-clear-btn{font-size:11px;color:var(--tt2);padding:3px 8px;border-radius:5px;border:1px solid var(--ttline);background:none;transition:all .15s}
.t-clear-btn:hover{color:#e57373;border-color:#e57373}
.t-scroll{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#3a3a3a transparent;min-height:0}
.t-bottom{flex-shrink:0;border-top:2px solid var(--ttline);background:var(--dk2);display:flex;flex-direction:column}
.t-items-empty{padding:28px 14px;text-align:center;color:var(--tt2);font-size:12px;display:flex;flex-direction:column;align-items:center;gap:8px}
.t-items-empty-icon{font-size:28px;opacity:.35}
.line{display:flex;align-items:flex-start;gap:8px;padding:7px 14px;border-bottom:1px solid var(--ttline);transition:background .1s}
.line:hover{background:rgba(255,255,255,.03)}
.line-info{flex:1;min-width:0}
.line-name{font-size:12px;font-weight:500;color:var(--tt);line-height:1.2}
.line-nota{font-size:10px;color:var(--accent);margin-top:1px}
.line-unit{font-size:10px;color:var(--tt2);margin-top:1px;font-variant-numeric:tabular-nums}
.qty-ctrl{display:flex;align-items:center;background:var(--dk);border-radius:6px;overflow:hidden;flex-shrink:0}
.qty-btn{width:22px;height:22px;background:none;border:none;color:var(--tt2);font-size:13px;display:flex;align-items:center;justify-content:center;transition:background .1s,color .1s}
.qty-btn:hover{background:rgba(255,255,255,.08);color:var(--tt)}
.qty-btn.rm:hover{color:#e57373}
.qty-val{font-size:11px;font-weight:700;color:var(--tt);width:18px;text-align:center;font-variant-numeric:tabular-nums}
.line-total{font-size:12px;font-weight:600;color:var(--tt);font-variant-numeric:tabular-nums;min-width:44px;text-align:right;flex-shrink:0;margin-top:2px}
.t-sec{border-top:1px solid var(--ttline)}
.t-sec-hdr{padding:7px 14px;display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;transition:background .1s}
.t-sec-hdr:hover{background:rgba(255,255,255,.03)}
.t-sec-label{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tt2);flex:1}
.t-sec-badge{font-size:10px;color:var(--accent);font-weight:600}
.t-sec-arrow{font-size:10px;color:var(--tt2);transition:transform .2s}
.t-sec-arrow.open{transform:rotate(180deg)}
.t-sec-body{padding:0 14px 10px;display:flex;flex-direction:column;gap:7px}
.toggle-row{display:flex;gap:6px}
.toggle-opt{flex:1;padding:6px 8px;border-radius:7px;border:1.5px solid var(--ttline);background:none;color:var(--tt2);font-size:11px;font-weight:500;transition:all .15s;text-align:center}
.toggle-opt.active{border-color:var(--accent-bd);color:var(--accent);background:var(--accent-lite)}
.t-field-label{font-size:10px;color:var(--tt2);margin-bottom:2px}
.t-input{width:100%;padding:6px 9px;border:1.5px solid var(--ttline);border-radius:6px;background:var(--dk);color:var(--tt);font-size:12px;outline:none;transition:border-color .15s}
.t-input:focus{border-color:var(--accent-bd)}
.t-input::placeholder{color:var(--tt3)}
.moto-row{display:flex;gap:5px;flex-wrap:wrap}
.moto-btn{padding:4px 9px;border-radius:5px;border:1px solid var(--ttline);background:none;color:var(--tt2);font-size:11px;transition:all .15s}
.moto-btn.active{border-color:var(--accent-bd);color:var(--accent);background:var(--accent-lite)}
.iva-row{display:flex;align-items:center;gap:8px;padding:7px 14px;border-bottom:1px solid var(--ttline)}
.iva-label{font-size:11px;color:var(--tt2);flex:1}
.iva-badge{font-size:10px;padding:2px 6px;border-radius:4px}
.iva-on{background:rgba(39,174,96,.15);color:#4ade80}
.iva-off{background:rgba(255,255,255,.05);color:var(--tt3)}
.switch{position:relative;width:34px;height:18px}
.switch input{opacity:0;width:0;height:0}
.slider{position:absolute;inset:0;background:var(--dk3);border-radius:18px;cursor:pointer;transition:background .2s}
.slider::before{content:'';position:absolute;height:12px;width:12px;left:3px;bottom:3px;background:#888;border-radius:50%;transition:all .2s}
.switch input:checked+.slider{background:var(--accent)}
.switch input:checked+.slider::before{transform:translateX(16px);background:#fff}
.totals-compact{padding:7px 14px;border-bottom:1px solid var(--ttline);display:flex;flex-direction:column;gap:3px}
.tot-row{display:flex;justify-content:space-between;font-size:11px;color:var(--tt2);font-variant-numeric:tabular-nums}
.tot-grand{display:flex;justify-content:space-between;font-size:14px;font-weight:700;color:var(--tt);padding-top:4px;border-top:1px solid var(--ttline);margin-top:2px;font-variant-numeric:tabular-nums}
.bs-inline{font-size:10px;color:#7ec8ff;text-align:right;margin-top:1px;font-variant-numeric:tabular-nums}
.bcv-row{display:flex;align-items:center;gap:6px;padding:5px 14px;border-bottom:1px solid var(--ttline)}
.bcv-label{font-size:10px;color:var(--tt2);flex:1}
.bcv-input{width:72px;padding:3px 6px;border:1px solid var(--ttline);border-radius:5px;background:var(--dk);color:var(--tt);font-size:11px;text-align:right;outline:none;font-variant-numeric:tabular-nums}
.bcv-input:focus{border-color:var(--accent-bd)}
.converter{display:flex;align-items:center;gap:6px;padding:5px 14px;border-bottom:1px solid var(--ttline)}
.conv-field{display:flex;align-items:center;gap:4px;flex:1}
.conv-sym{font-size:11px;color:var(--tt2);font-weight:600;min-width:16px}
.conv-input{flex:1;padding:4px 7px;border:1px solid var(--ttline);border-radius:5px;background:var(--dk);color:var(--tt);font-size:12px;outline:none;font-variant-numeric:tabular-nums}
.conv-input:focus{border-color:var(--accent-bd)}
.conv-arrow{font-size:14px;color:var(--tt2);flex-shrink:0}
.pay-section{padding:6px 14px 4px}
.pay-section-label{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tt2);margin-bottom:5px}
.pay-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px}
.pay-btn{padding:6px 4px;border:1.5px solid var(--ttline);border-radius:7px;background:none;color:var(--tt2);font-size:10px;font-weight:500;display:flex;flex-direction:column;align-items:center;gap:2px;transition:all .15s}
.pay-btn.active{border-color:var(--accent-bd);color:var(--accent);background:var(--accent-lite)}
.pay-btn:hover:not(.active){border-color:#555;color:var(--tt)}
.pay-icon{font-size:14px}
.cxp-note{margin:0 14px 6px;padding:6px 9px;border-radius:7px;background:rgba(41,128,185,.12);border:1px solid rgba(41,128,185,.3);color:#7ec8e3;font-size:10px;line-height:1.4}
.cobrar-wrap{padding:8px 14px 10px}
.cobrar-btn{width:100%;padding:12px;background:var(--accent);color:#1c1c1e;border:none;border-radius:9px;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity .15s,transform .1s;font-variant-numeric:tabular-nums}
.cobrar-btn:hover:not(:disabled){opacity:.9}
.cobrar-btn:active:not(:disabled){transform:scale(.98)}
.cobrar-btn:disabled{background:var(--dk);color:var(--tt2);cursor:not-allowed;border:1px solid var(--ttline)}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s}
.overlay.show{opacity:1;pointer-events:all}
.ov-card{background:var(--dk);border:1px solid var(--ttline);border-radius:14px;padding:20px;min-width:260px;max-width:340px;width:90%;display:flex;flex-direction:column;gap:12px}
.ov-title{font-size:14px;font-weight:700;color:var(--tt)}
.ov-sub{font-size:12px;color:var(--tt2);margin-top:-6px}
.ov-opts{display:flex;flex-direction:column;gap:5px}
.ov-opt{padding:9px 12px;border:1.5px solid var(--ttline);border-radius:8px;background:none;color:var(--tt);font-size:13px;text-align:left;width:100%;transition:all .15s}
.ov-opt:hover{border-color:var(--accent-bd);color:var(--accent);background:var(--accent-lite)}
.ov-cancel{padding:8px;border:none;background:none;color:var(--tt2);font-size:12px;text-align:center;transition:color .15s;width:100%}
.ov-cancel:hover{color:var(--tt)}
.confirm-wrap{gap:10px;text-align:center}
.confirm-icon{font-size:44px}
.confirm-title{font-size:17px;font-weight:700;color:var(--tt)}
.confirm-detail{font-size:12px;color:var(--tt2);line-height:1.6}
.confirm-detail strong{color:var(--tt)}
.confirm-ok{padding:10px;background:var(--accent);color:#1c1c1e;border:none;border-radius:8px;font-size:13px;font-weight:700;width:100%}
.confirm-ok:hover{opacity:.9}
.cxc-date-row{margin:0 14px;padding:4px 0 6px}
.cxc-label{font-size:10px;color:var(--tt2);margin-bottom:3px}
@media(max-width:640px){.pos-body{flex-direction:column}.ticket{width:100%;max-height:55%;border-left:none;border-top:1px solid #2a2a2a}.product-grid{grid-template-columns:repeat(auto-fill,minmax(100px,1fr))}}
`;

export default function CajaClient() {
  /* ── State ── */
  const [productos, setProductos] = useState<Producto[]>([]);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [ivaConfig, setIvaConfig] = useState(false);
  const [bcvRate, setBcvRate] = useState(1);
  const [bcvInput, setBcvInput] = useState("1.00");

  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [catActiva, setCatActiva] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [payMethod, setPayMethod] = useState("EFECTIVO_BS");
  const [entrega, setEntrega] = useState<"LOCAL" | "DELIVERY">("LOCAL");
  const [direccion, setDireccion] = useState("");
  const [motorizadoId, setMotorizadoId] = useState<number | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTel, setClienteTel] = useState("");
  const [clienteRif, setClienteRif] = useState("");
  const [ivaActivo, setIvaActivo] = useState(false);
  const [convUsd, setConvUsd] = useState("");
  const [convBs, setConvBs] = useState("");
  const [secEntrega, setSecEntrega] = useState(true);
  const [secCliente, setSecCliente] = useState(false);
  const [fechaCxC, setFechaCxC] = useState("");

  const [extrasOverlay, setExtrasOverlay] = useState<Producto | null>(null);
  const [confirmOverlay, setConfirmOverlay] = useState<{ icon: string; titulo: string; detalle: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const ticketNumRef = useRef(47);
  const [ticketNum, setTicketNum] = useState(47);
  const clockRef = useRef<HTMLSpanElement>(null);

  /* ── Load data ── */
  useEffect(() => {
    fetch("/api/productos?grupo=PARA_LA_VENTA")
      .then((r) => r.json())
      .then((data: Record<string, unknown>[]) => {
        const prods: Producto[] = data.map((p) => ({
          id: p.id as number,
          nombre: p.nombre as string,
          precioVenta: Number(p.precioVenta ?? 0),
          categoriaNombre: (p.categoriaNombre ?? null) as string | null,
          extras: ((p.extras ?? []) as Record<string, unknown>[]).map((e) => ({
            id: e.id as number,
            nombre: e.nombre as string,
            precioAdicional: Number(e.precioAdicional ?? 0),
          })),
        }));
        setProductos(prods);
      })
      .catch(() => {});

    fetch("/api/motorizados")
      .then((r) => r.json())
      .then((data: Record<string, unknown>[]) => {
        setMotorizados(data.filter((m) => m.activo !== false) as unknown as Motorizado[]);
      })
      .catch(() => {});

    fetch("/api/tasa-bcv")
      .then((r) => r.json())
      .then((data) => {
        if (data.tasa) {
          setBcvRate(Number(data.tasa));
          setBcvInput(Number(data.tasa).toFixed(2));
        }
      })
      .catch(() => {});

    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((cfg: Record<string, string>) => {
        const activo = cfg.iva_activo === "true";
        setIvaConfig(activo);
        setIvaActivo(activo);
      })
      .catch(() => {});

    // Clock
    const tick = () => {
      if (clockRef.current) {
        clockRef.current.textContent = new Date().toLocaleString("es-VE", {
          timeZone: "America/Caracas",
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
      }
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, []);

  /* ── Computed ── */
  const subtotal = carrito.reduce((s, c) => s + (c.precio + c.extraPrecio) * c.qty, 0);
  const ivaAmt = ivaActivo ? subtotal * 0.16 : 0;
  const total = subtotal + ivaAmt;
  const isCxP = CXP_METHODS.includes(payMethod);
  const categorias = ["Todos", ...Array.from(new Set(productos.map((p) => p.categoriaNombre ?? "Sin categoría")))];
  const productosFiltrados = productos.filter((p) => {
    const mc = catActiva === "Todos" || (p.categoriaNombre ?? "Sin categoría") === catActiva;
    const mq = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return mc && mq;
  });
  const cartMap: Record<number, number> = {};
  carrito.forEach((c) => { cartMap[c.productoId] = (cartMap[c.productoId] ?? 0) + c.qty; });

  /* ── Cart ops ── */
  function addToCart(prod: Producto, extra: Extra | null) {
    const precio = prod.precioVenta;
    const extraId = extra?.id ?? null;
    const extraNombre = extra?.nombre ?? null;
    const extraPrecio = extra?.precioAdicional ?? 0;
    setCarrito((prev) => {
      const ex = prev.find((c) => c.productoId === prod.id && c.extraId === extraId);
      if (ex) return prev.map((c) => c.uid === ex.uid ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { uid: uid(), productoId: prod.id, nombre: prod.nombre, precio, qty: 1, extraId, extraNombre, extraPrecio }];
    });
  }
  function setQty(u: string, delta: number) {
    setCarrito((prev) => {
      const next = prev.map((c) => c.uid === u ? { ...c, qty: c.qty + delta } : c).filter((c) => c.qty > 0);
      return next;
    });
  }
  function clearCart() {
    setCarrito([]);
    ticketNumRef.current += 1;
    setTicketNum(ticketNumRef.current);
  }

  /* ── Product click ── */
  function clickProducto(prod: Producto) {
    if (prod.extras.length > 0) { setExtrasOverlay(prod); } else { addToCart(prod, null); }
  }

  /* ── Converter ── */
  function fromUsd(val: string) {
    setConvUsd(val);
    const n = parseFloat(val) || 0;
    setConvBs(n > 0 ? (n * bcvRate).toFixed(2) : "");
  }
  function fromBs(val: string) {
    setConvBs(val);
    const n = parseFloat(val) || 0;
    setConvUsd(n > 0 ? (n / bcvRate).toFixed(2) : "");
  }
  function handleBcvChange(val: string) {
    setBcvInput(val);
    const n = parseFloat(val) || 1;
    setBcvRate(n);
  }

  /* ── Cobrar ── */
  async function cobrar() {
    if (carrito.length === 0) return;
    setGuardando(true);
    try {
      const body = {
        fecha: today(),
        tasaDelDia: bcvRate,
        cliente: clienteNombre.trim() || "Consumidor Final",
        clienteCi: clienteRif || null,
        clienteTelefono: clienteTel || null,
        direccion: entrega === "DELIVERY" ? direccion || null : null,
        modoEntrega: entrega,
        motorizadoId: entrega === "DELIVERY" ? motorizadoId : null,
        costoDelivery: 0,
        items: carrito.map((c) => ({ productoId: c.productoId, cantidad: c.qty, extraId: c.extraId ?? undefined })),
        pagos: isCxP ? [] : [{ metodo: payMethod, monto: total }],
        fechaLimitePago: isCxP ? (fechaCxC || null) : null,
      };
      const res = await fetch("/api/ventas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Error al registrar la venta");
        return;
      }
      const payLabel = PAY_OPTS.find((p) => p.key === payMethod)?.label ?? payMethod;
      const detalle = [
        `Total: <strong>${fmt(total)}</strong> (${fmtBs(total, bcvRate)})`,
        `Método: <strong>${payLabel}</strong>`,
        clienteNombre ? `Cliente: <strong>${clienteNombre}</strong>` : "",
        entrega === "DELIVERY" && motorizadoId
          ? `Motorizado: <strong>${motorizados.find((m) => m.id === motorizadoId)?.nombre ?? ""}</strong>`
          : "",
      ].filter(Boolean).join("<br>");
      setConfirmOverlay({ icon: isCxP ? "📋" : "✅", titulo: isCxP ? "CxC generada" : "Cobro registrado", detalle });
      clearCart();
      setClienteNombre(""); setClienteTel(""); setClienteRif("");
      setDireccion(""); setMotorizadoId(null); setFechaCxC("");
      setPayMethod("EFECTIVO_BS");
    } finally {
      setGuardando(false);
    }
  }

  const ticketLabel = `#${String(ticketNum).padStart(4, "0")}`;

  /* ── Render ── */
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      <div className="pos">
        {/* Topbar */}
        <div className="topbar">
          <span className="tb-brand">VentasHG</span>
          <span className="tb-sep">›</span>
          <span className="tb-title">Caja Rápida</span>
          <div className="tb-space" />
          <div className="tb-meta">
            <span ref={clockRef} />
          </div>
        </div>

        <div className="pos-body">
          {/* ── Catálogo ── */}
          <div className="catalog">
            <div className="cat-head">
              <div className="search-wrap">
                <span className="s-icon">⌕</span>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Buscar producto…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
              <div className="cats">
                {categorias.map((cat) => (
                  <button
                    key={cat}
                    className={`cat-pill${catActiva === cat ? " active" : ""}`}
                    onClick={() => setCatActiva(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="product-grid">
              {productosFiltrados.length === 0 && (
                <div style={{ gridColumn: "1/-1", padding: "40px 14px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                  {productos.length === 0 ? "Cargando productos…" : "Sin resultados"}
                </div>
              )}
              {productosFiltrados.map((prod) => {
                const qty = cartMap[prod.id] ?? 0;
                return (
                  <div key={prod.id} className={`p-card${qty > 0 ? " in-cart" : ""}`} onClick={() => clickProducto(prod)}>
                    <div className="p-img">
                      <span>{prod.nombre.charAt(0)}</span>
                      {qty > 0 && <span className="p-badge">{qty}</span>}
                      {prod.extras.length > 0 && <span className="p-extras-tag">+ opciones</span>}
                    </div>
                    <div className="p-info">
                      <div className="p-name">{prod.nombre}</div>
                      <div className="p-price">{fmt(prod.precioVenta)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Ticket ── */}
          <div className="ticket">
            <div className="t-head">
              <div>
                <div className="t-num-label">Ticket</div>
                <div className="t-num">{ticketLabel}</div>
              </div>
              <button className="t-clear-btn" onClick={clearCart}>Limpiar</button>
            </div>

            {/* Scrollable: items + secciones */}
            <div className="t-scroll">
              {/* Items */}
              {carrito.length === 0 ? (
                <div className="t-items-empty">
                  <span className="t-items-empty-icon">🛒</span>
                  <span>Toca un producto para agregar</span>
                </div>
              ) : carrito.map((c) => (
                <div key={c.uid} className="line">
                  <div className="line-info">
                    <div className="line-name">{c.nombre}</div>
                    {c.extraNombre && <div className="line-nota">· {c.extraNombre}</div>}
                    <div className="line-unit">{fmt(c.precio + c.extraPrecio)} c/u</div>
                  </div>
                  <div className="qty-ctrl">
                    <button className="qty-btn rm" onClick={() => setQty(c.uid, -1)}>−</button>
                    <span className="qty-val">{c.qty}</span>
                    <button className="qty-btn" onClick={() => setQty(c.uid, +1)}>+</button>
                  </div>
                  <div className="line-total">{fmt((c.precio + c.extraPrecio) * c.qty)}</div>
                </div>
              ))}

              {/* Entrega */}
              <div className="t-sec">
                <div className="t-sec-hdr" onClick={() => setSecEntrega((v) => !v)}>
                  <span className="t-sec-label">Entrega</span>
                  <span className="t-sec-badge">{entrega === "DELIVERY" ? "🛵 Delivery" : "🏠 Local"}</span>
                  <span className={`t-sec-arrow${secEntrega ? " open" : ""}`}>▾</span>
                </div>
                {secEntrega && (
                  <div className="t-sec-body">
                    <div className="toggle-row">
                      <button className={`toggle-opt${entrega === "LOCAL" ? " active" : ""}`} onClick={() => setEntrega("LOCAL")}>🏠 Local</button>
                      <button className={`toggle-opt${entrega === "DELIVERY" ? " active" : ""}`} onClick={() => setEntrega("DELIVERY")}>🛵 Delivery</button>
                    </div>
                    {entrega === "DELIVERY" && (
                      <>
                        <div>
                          <div className="t-field-label">Dirección</div>
                          <input className="t-input" type="text" placeholder="Av. Principal, Local 5…" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                        </div>
                        {motorizados.length > 0 && (
                          <div>
                            <div className="t-field-label">Motorizado</div>
                            <div className="moto-row">
                              {motorizados.map((m) => (
                                <button
                                  key={m.id}
                                  className={`moto-btn${motorizadoId === m.id ? " active" : ""}`}
                                  onClick={() => setMotorizadoId(motorizadoId === m.id ? null : m.id)}
                                >
                                  {m.nombre}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Cliente */}
              <div className="t-sec">
                <div className="t-sec-hdr" onClick={() => setSecCliente((v) => !v)}>
                  <span className="t-sec-label">Cliente</span>
                  <span className="t-sec-badge">{clienteNombre ? clienteNombre.split(" ")[0] : ""}</span>
                  <span className={`t-sec-arrow${secCliente ? " open" : ""}`}>▾</span>
                </div>
                {secCliente && (
                  <div className="t-sec-body">
                    <div>
                      <div className="t-field-label">Nombre</div>
                      <input className="t-input" type="text" placeholder="Consumidor Final" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} />
                    </div>
                    <div>
                      <div className="t-field-label">Teléfono</div>
                      <input className="t-input" type="tel" placeholder="0414-000-0000" value={clienteTel} onChange={(e) => setClienteTel(e.target.value)} />
                    </div>
                    <div>
                      <div className="t-field-label">RIF / CI</div>
                      <input className="t-input" type="text" placeholder="V-12345678" value={clienteRif} onChange={(e) => setClienteRif(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fixed bottom */}
            <div className="t-bottom">
              {/* IVA */}
              <div className="iva-row">
                <span className="iva-label">IVA (16%)</span>
                <span className={`iva-badge ${ivaActivo ? "iva-on" : "iva-off"}`}>{ivaActivo ? "Activado" : "Desactivado"}</span>
                <label className="switch">
                  <input type="checkbox" checked={ivaActivo} onChange={(e) => setIvaActivo(e.target.checked)} />
                  <span className="slider" />
                </label>
              </div>

              {/* Totales */}
              <div className="totals-compact">
                <div className="tot-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {ivaActivo && <div className="tot-row"><span>IVA 16%</span><span>{fmt(ivaAmt)}</span></div>}
                <div className="tot-grand"><span>Total</span><span>{fmt(total)}</span></div>
                <div className="bs-inline">{fmtBs(total, bcvRate)}</div>
              </div>

              {/* BCV */}
              <div className="bcv-row">
                <span className="bcv-label">Tasa BCV (Bs/$)</span>
                <input className="bcv-input" type="number" step="0.01" min="1" value={bcvInput} onChange={(e) => handleBcvChange(e.target.value)} />
              </div>

              {/* Converter */}
              <div className="converter">
                <div className="conv-field">
                  <span className="conv-sym">$</span>
                  <input className="conv-input" type="number" placeholder="0.00" step="0.01" value={convUsd} onChange={(e) => fromUsd(e.target.value)} />
                </div>
                <span className="conv-arrow">⇄</span>
                <div className="conv-field">
                  <span className="conv-sym">Bs</span>
                  <input className="conv-input" type="number" placeholder="0,00" step="0.01" value={convBs} onChange={(e) => fromBs(e.target.value)} />
                </div>
              </div>

              {/* Métodos de pago */}
              <div className="pay-section">
                <div className="pay-section-label">Forma de Pago</div>
                <div className="pay-grid">
                  {PAY_OPTS.map((p) => (
                    <button key={p.key} className={`pay-btn${payMethod === p.key ? " active" : ""}`} onClick={() => setPayMethod(p.key)}>
                      <span className="pay-icon">{p.icon}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {isCxP && (
                <>
                  <div className="cxp-note">
                    ℹ️ Genera una <strong>Cuenta por Cobrar</strong> pendiente.
                  </div>
                  <div className="cxc-date-row">
                    <div className="cxc-label">Fecha límite de pago</div>
                    <input className="t-input" type="date" value={fechaCxC} onChange={(e) => setFechaCxC(e.target.value)} style={{ fontSize: 12 }} />
                  </div>
                </>
              )}

              {/* Cobrar */}
              <div className="cobrar-wrap">
                <button
                  className="cobrar-btn"
                  disabled={carrito.length === 0 || guardando || (isCxP && !fechaCxC)}
                  onClick={cobrar}
                >
                  <span>⚡</span>
                  <span>
                    {carrito.length === 0
                      ? "Sin productos"
                      : guardando
                      ? "Registrando…"
                      : isCxP
                      ? `Generar CxC · ${fmt(total)}`
                      : `Cobrar ${fmt(total)}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Extras overlay */}
      {extrasOverlay && (
        <div className="overlay show">
          <div className="ov-card">
            <div className="ov-title">{extrasOverlay.nombre}</div>
            <div className="ov-sub">Selecciona la preparación:</div>
            <div className="ov-opts">
              {extrasOverlay.extras.map((ex) => (
                <button key={ex.id} className="ov-opt" onClick={() => { addToCart(extrasOverlay, ex); setExtrasOverlay(null); }}>
                  {ex.nombre}{ex.precioAdicional > 0 ? ` (+${fmt(ex.precioAdicional)})` : ""}
                </button>
              ))}
              <button className="ov-opt" onClick={() => { addToCart(extrasOverlay, null); setExtrasOverlay(null); }}>
                Sin preferencia
              </button>
            </div>
            <button className="ov-cancel" onClick={() => setExtrasOverlay(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Confirm overlay */}
      {confirmOverlay && (
        <div className="overlay show">
          <div className="ov-card confirm-wrap">
            <div className="confirm-icon">{confirmOverlay.icon}</div>
            <div className="confirm-title">{confirmOverlay.titulo}</div>
            <div className="confirm-detail" dangerouslySetInnerHTML={{ __html: confirmOverlay.detalle }} />
            <button className="confirm-ok" onClick={() => setConfirmOverlay(null)}>Nueva venta</button>
          </div>
        </div>
      )}
    </>
  );
}
