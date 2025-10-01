// Parámetros por defecto (desde el script original)
const DEFAULTS = {
  volumen: 500000,
  oficial: 1465,
  comision: 1 // USDT (se resta solo en la segunda fórmula)
};

// Selectores
const $ = (sel) => document.querySelector(sel);
const elVolumen = $("#volumen");
const elOficial = $("#oficial");
const elComision = $("#comision");
const elStatus = $("#status");
const elPrints = $("#prints");
const elRefresh = $("#refresh");
const elBeloUsdAsk = $("#beloUsdAsk");
const elBeloArsBid = $("#beloArsBid");
const elCocosArsBid = $("#cocosArsBid");
const elBeloUsdcAsk = $("#beloUsdcAsk");
const elBeloUsdcArsBid = $("#beloUsdcArsBid");
const elCocosUsdcArsBid = $("#cocosUsdcArsBid");

// Inicializar inputs
elVolumen.value = DEFAULTS.volumen;
elOficial.value = DEFAULTS.oficial;
elComision.value = DEFAULTS.comision;

// Utilidades
const roundTo = (x, d) => {
  const k = 10 ** d;
  return Math.round((x + Number.EPSILON) * k) / k;
};
const fmtPct = (x) => `${x.toFixed(3)}%`;
const setStatus = (msg) => (elStatus.textContent = msg);
const line = (label, valuePct) => {
  const pos = valuePct >= 0;
  return `<div class="line"><span class="label">${label}:</span> <span class="value ${pos ? 'pos' : 'neg'}">${fmtPct(valuePct)}</span></div>`;
};

// Fetch JSON con timeout
async function fetchJSON(url, { timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// Leer precios (Belo y CocosCrypto) como en tu script
async function readPrices() {
  // USDT (como antes) + USDC (nuevo), ventana 0.1
  const [usdUSDT, arsUSDT, usdUSDC, arsUSDC] = await Promise.all([
    fetchJSON("https://criptoya.com/api/USDT/USD/0.1"),
    fetchJSON("https://criptoya.com/api/USDT/ARS/0.1"),
    fetchJSON("https://criptoya.com/api/USDC/USD/0.1"),
    fetchJSON("https://criptoya.com/api/USDC/ARS/0.1"),
  ]);

  // USDT (existente)
  const beloUsdAsk  = usdUSDT?.belo?.totalAsk ?? null;
  const beloArsBid  = arsUSDT?.belo?.totalBid ?? null;
  const cocosArsBid = arsUSDT?.cocoscrypto?.totalBid ?? null;

  // USDC (nuevo)
  const beloUsdcAsk     = usdUSDC?.belo?.totalAsk ?? null;
  const beloUsdcArsBid  = arsUSDC?.belo?.totalBid ?? null;
  const cocosUsdcArsBid = arsUSDC?.cocoscrypto?.totalBid ?? null;

  return {
    // USDT
    beloUsdAsk, beloArsBid, cocosArsBid,
    // USDC
    beloUsdcAsk, beloUsdcArsBid, cocosUsdcArsBid,
  };
}


// Cálculos: comisión SOLO en la segunda fórmula (restada en USDT)
function computePrints({ volumen, oficial, comision }, { beloUsdAsk, beloArsBid, cocosArsBid }) {
  if ([beloUsdAsk, beloArsBid, cocosArsBid].some((x) => x == null)) return null;

  const invArs = Number(volumen);
  const oficialArsPorUsd = Number(oficial);
  const feeUsdt = Number(comision); // USDT

  // round(1/ask, 4)
  const usdtPorUsdRounded = roundTo(1 / Number(beloUsdAsk), 4);

  // 1) oficial -> beloUSDT -> beloARS  (sin comisión)
  const p1 = (invArs / oficialArsPorUsd) * usdtPorUsdRounded * Number(beloArsBid) / invArs - 1;
  const pct1 = p1 * 100;

  // 2) oficial -> beloUSDT -> CocosCrypto -> CocosCryptoARS  (se resta comisión en USDT)
  const p2 = ((invArs / oficialArsPorUsd) * usdtPorUsdRounded - feeUsdt) * Number(cocosArsBid) / invArs - 1;
  const pct2 = p2 * 100;

  return { pct1, pct2, usdtPorUsdRounded };
}

// Render de resultados y widgets de precios
function render({ pct1, pct2 }) {
  elPrints.innerHTML = [
    line("oficial -> beloUSDT -> beloARS", pct1),
    line("oficial -> beloUSDT -> CocosCrypto -> CocosCryptoARS", pct2),
  ].join("");
}
function renderPriceWidgets({
  // USDT
  beloUsdAsk, beloArsBid, cocosArsBid,
  // USDC
  beloUsdcAsk, beloUsdcArsBid, cocosUsdcArsBid,
}) {
  // USDT (sección “Precios usados”)
  if (elBeloUsdAsk)   elBeloUsdAsk.textContent   = beloUsdAsk   != null ? roundTo(1 / Number(beloUsdAsk), 4).toFixed(4) : "—";
  if (elBeloArsBid)   elBeloArsBid.textContent   = beloArsBid   != null ? beloArsBid.toFixed(2) : "—";
  if (elCocosArsBid)  elCocosArsBid.textContent  = cocosArsBid  != null ? cocosArsBid.toFixed(2) : "—";

  // USDC (sección “Otros precios”)
  if (elBeloUsdcAsk)     elBeloUsdcAsk.textContent     = beloUsdcAsk     != null ? beloUsdcAsk.toFixed(6) : "—";
  if (elBeloUsdcArsBid)  elBeloUsdcArsBid.textContent  = beloUsdcArsBid  != null ? beloUsdcArsBid.toFixed(2) : "—";
  if (elCocosUsdcArsBid) elCocosUsdcArsBid.textContent = cocosUsdcArsBid != null ? cocosUsdcArsBid.toFixed(2) : "—";
}

// Ciclo de actualización
async function tick() {
  try {
    setStatus("🔄 Actualizando…");
    const params = {
      volumen: Number(elVolumen.value),
      oficial: Number(elOficial.value),
      comision: Number(elComision.value),
    };

    const prices = await readPrices();
    renderPriceWidgets(prices);

    const out = computePrints(params, prices);
    if (!out) {
      setStatus("⚠️ Datos incompletos de la API");
      return;
    }
    render(out);
    setStatus(`✅ Última actualización: ${new Date().toLocaleString()}`);
  } catch (err) {
    console.error(err);
    setStatus(`❌ Error: ${String(err)}`);
  }
}

// Listeners
[elVolumen, elOficial, elComision].forEach((el) => {
  el.addEventListener("input", () => tick());
});
elRefresh.addEventListener("click", () => tick());

// Primer render y refresco periódico
window.addEventListener("load", tick);
setInterval(tick, 25000);
