// === Config ===
const DEFAULTS = {
  volumen: 500000,
  oficial: 1455, // se puede sobrescribir por remoto o localStorage
};

// === Helpers DOM ===
const $ = (s) => document.querySelector(s);
const elVolumen = $("#volumen");
const elOficial = $("#oficial");
const elGuardar = $("#guardarOficial");
const elStatus = $("#status");
const elPrints = $("#prints");
const elRefresh = $("#refresh");

const idMap = {
  "belo_usdc_ars": ["belo","USDC","ARS","totalBid"],
  "belo_usdt_ars": ["belo","USDT","ARS","totalBid"],
  "belo_usdt_usd": ["belo","USDT","USD","totalAsk"],
  "buenbit_usdc_ars": ["buenbit","USDC","ARS","totalBid"],
  "buenbit_usdt_ars": ["buenbit","USDT","ARS","totalBid"],
  "buenbit_usdt_usd": ["buenbit","USDT","USD","totalAsk"],
  "fiwind_usdc_ars": ["fiwind","USDC","ARS","totalBid"],
  "fiwind_usdt_ars": ["fiwind","USDT","ARS","totalBid"],
  "fiwind_usdt_usd": ["fiwind","USDT","USD","totalAsk"],
  "fiwind_usdc_usd": ["fiwind","USDC","USD","totalAsk"],
  "cocos_usdc_ars": ["cocoscrypto","USDC","ARS","totalBid"],
  "cocos_usdt_ars": ["cocoscrypto","USDT","ARS","totalBid"],
};

// === Estado ===
const coins = ["USDT","USDC"];
const exchanges = ["belo","cocoscrypto","buenbit","fiwind"];
const actions = ["totalAsk","totalBid"];
const fiats = ["USD","ARS"];
let prices = initPrices();

function initPrices() {
  const p = {};
  for (const ex of exchanges) {
    p[ex] = {};
    for (const coin of coins) {
      p[ex][coin] = { USD: { totalAsk: null, totalBid: null }, ARS: { totalAsk: null, totalBid: null } };
    }
  }
  return p;
}

// === Utils ===
const roundTo = (x, d) => {
  const k = 10 ** d;
  return Math.round((x + Number.EPSILON) * k) / k;
};
const nowHHMMSS = () => new Date().toLocaleTimeString([], { hour12:false });

const setStatus = (t) => elStatus.textContent = t;

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

// === Persistencia de 'oficial' ===
function loadOficialLocal() {
  const raw = localStorage.getItem("oficial");
  return raw ? Number(raw) : null;
}
function saveOficialLocal(v) {
  localStorage.setItem("oficial", String(v));
}

// === Carga inicial de inputs ===
async function initInputs() {
  let oficial = loadOficialLocal();

  elVolumen.value = DEFAULTS.volumen;
  elOficial.value = oficial != null ? oficial : DEFAULTS.oficial;
}

elGuardar.addEventListener("click", async () => {
  const v = Number(elOficial.value);
  if (!isFinite(v) || v <= 0) { alert("Valor inválido para 'oficial'."); return; }
  // Guardar local
  saveOficialLocal(v);
  setStatus("💾 Guardado local en este navegador");
});

// === Lectura de precios ===
async function readAll() {
  const urls = [];
  for (const coin of coins) for (const fiat of fiats) urls.push({ coin, fiat, url: `https://criptoya.com/api/${coin}/${fiat}/0.1` });
  const out = initPrices();
  const chunks = await Promise.all(urls.map(({url}) => fetchJSON(url)));
  let idx = 0;
  for (const { coin, fiat } of urls) {
    const d = chunks[idx++];
    for (const ex of exchanges) {
      if (d[ex]) {
        out[ex][coin][fiat].totalAsk = d[ex].totalAsk ?? out[ex][coin][fiat].totalAsk;
        out[ex][coin][fiat].totalBid = d[ex].totalBid ?? out[ex][coin][fiat].totalBid;
      }
    }
  }
  prices = out;
  return out;
}

// === Lógicas auxiliares como en Python ===
function best_ER_in_exchange(prices, exchange, coinsList, fiat, actionRequested) {
  let best = null;
  let best_coin = coinsList[0];
  for (const coin of coinsList) {
    const v = prices[exchange][coin][fiat][actionRequested];
    if (v == null) continue;
    if (best == null) {
      best = v; best_coin = coin;
    } else {
      if (actionRequested === "totalAsk") {
        if (v < best) { best = v; best_coin = coin; }
      } else {
        if (v > best) { best = v; best_coin = coin; }
      }
    }
  }
  return { best_value: best, best_coin };
}

function comision(exchange_in, exchange_out) {
  const comision_rates = {
    "belo": 1,
    "buenbit": 0.02,
    "cocoscrypto": 0,
    "fiwind": 0.5,
  };
  if (exchange_in === exchange_out) {
    return 0;
  } else {
    // fallback seguro: si no existe la exchange, devuelve 0
    return comision_rates.hasOwnProperty(exchange_in) ? comision_rates[exchange_in] : 0;
  }
}


function best_ratio(prices, oficial, volumen) {
  let max_ratio = -Infinity, coin_max = null, exc_in = null, exc_out = null;
  let pct = 0;  
  let top3_ratios = [];

  for (const coin of coins) {
    for (const ex_in of exchanges) {
      for (const ex_out of exchanges) {
        const ask = prices[exchangeCheck(ex_in)] ? prices[ex_in][coin]?.USD?.totalAsk : null;
        const bid = prices[ex_out]?.[coin]?.ARS?.totalBid;
        if (ask == null || bid == null) continue;
        const USDtoCoin = roundTo(1/ask, 4);
        const formula = ( (volumen / oficial - comision(ex_in, ex_out)) * USDtoCoin * bid / volumen );
        if (formula > max_ratio) {
          max_ratio = formula; coin_max = coin; exc_in = ex_in; exc_out = ex_out;
          pct = ((max_ratio - 1) * 100).toFixed(3);
          if (top3_ratios.length === 0) {

            top3_ratios = [[pct, `oficial -> ${exc_in}${coin_max} -> ${exc_out}ARS`],
                           [pct, `oficial -> ${exc_in}${coin_max} -> ${exc_out}ARS`],
                           [pct, `oficial -> ${exc_in}${coin_max} -> ${exc_out}ARS`]];

          } else if (top3_ratios[0][0] < pct){
            top3_ratios.unshift([pct, `oficial -> ${exc_in}${coin_max} -> ${exc_out}ARS`]);
            top3_ratios.sort((a, b) => a[0] < b[0]);
            top3_ratios.pop();
          }
        } 
      }
    }
  }
  return top3_ratios;
}
// helper to avoid reference error in case exchange name was accidentally mistyped
function exchangeCheck(name){
  return exchanges.includes(name) ? name : exchanges[0];
}

// === Render ===
function renderWidgets(prices) {
  for (const id in idMap) {
    const [ex, coin, fiat, action] = idMap[id];
    const v = prices?.[ex]?.[coin]?.[fiat]?.[action];
    const el = document.getElementById(id);
    if (el) el.textContent = v != null ? (fiat === "USD" ? Number(v).toFixed(4) : Number(v).toFixed(2)) : "—";
  }
}

/* ===========================
   renderPrints actualizado:
   escribe cada línea en su span correspondiente
   y colorea según signo del primer número encontrado
   =========================== */

// extrae el primer número (puede tener signo y decimales) en un string
function extractFirstNumber(text) {
  if (!text) return null;
  const m = text.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function extractFirstFourCharacters(str) {
  const slicedStr = str.slice(0, 5);
  if (/^-/.test(slicedStr)) {
    // The first character is a '-'
    return -1;
  } else if (/^\d+\.\d+$/.test(slicedStr)) {
    // The first four characters are numbers with a '.' separator
    return parseFloat(slicedStr);
  } else {
    // Invalid input
    return null;
  }
}

// aplica color directo al span según signo del número extraído
function applyColorToSpan(span, text, i) {
  // resetear estilo
  span.style.color = "";
  const num = extractFirstFourCharacters(text);
  if (num == null || Number.isNaN(num)) return;
  if (i === 0) return;

  if (num < 0) {
    span.style.color = "red";
  } else if (num < 0.2) {    
    span.style.color = "orange";
  } else if (num < 0.8) {
    span.style.color = "seagreen";
  } else {
    span.style.color = "GreenYellow"; 
  }
}

function renderPrints(prices) {
  const volumen = Number(elVolumen.value);
  const oficial = Number(elOficial.value);

  const line1 = `${nowHHMMSS()} dolar oficial: ${oficial}`;
  const line2 = " ";

  const ask_belo_usdt = prices.belo.USDT.USD.totalAsk;
  const bid_belo_usdt_ars = prices.belo.USDT.ARS.totalBid;
  const bid_cocos_usdt_ars = prices.cocoscrypto.USDT.ARS.totalBid;

  const usdt_per_usd_belo = roundTo(1/Number(ask_belo_usdt), 4);
  const pct_a = ((volumen / oficial * usdt_per_usd_belo * bid_belo_usdt_ars / volumen - 1) * 100).toFixed(3);
  const pct_b = ((((volumen / oficial * usdt_per_usd_belo) - 1) * bid_cocos_usdt_ars / volumen - 1) * 100).toFixed(3);

  const { best_value: best_buenbit_ask, best_coin: best_buenbit_coin } = best_ER_in_exchange(prices, "buenbit", ["USDC","USDT"], "USD", "totalAsk");
  const pct_c = ((((volumen / oficial * roundTo(1/Number(best_buenbit_ask),4)) - 0.01) * bid_cocos_usdt_ars / volumen - 1) * 100).toFixed(3);

  const { best_value: best_fiwind_ask, best_coin: best_fiwind_coin } = best_ER_in_exchange(prices, "fiwind", ["USDC","USDT"], "USD", "totalAsk");
  const bid_cocos_best = prices.cocoscrypto?.[best_fiwind_coin]?.ARS?.totalBid;
  const pct_d = (((volumen / oficial * roundTo(1/Number(best_fiwind_ask),4)) * bid_cocos_best / volumen - 1) * 100).toFixed(3);

  const top3_ratios = best_ratio(prices, oficial, volumen)

  const lines_ratios = [[pct_a, `oficial -> beloUSDT -> beloARS`],
                        [pct_b, `oficial -> beloUSDT -> cocoscryptoARS`],
                        [pct_c, `oficial -> buenbit${best_buenbit_coin} -> cocoscryptoARS`],
                        [pct_d, `oficial -> fiwind${best_fiwind_coin} -> cocoscryptoARS`],
                        [top3_ratios[0][0], top3_ratios[0][1]],
                        [top3_ratios[1][0], top3_ratios[1][1]],
                        [top3_ratios[2][0], top3_ratios[2][1]]];
                        
  let distinctList = lines_ratios.filter((item, index, arr) =>
    index === 0 || item[1].trim() !== arr[index - 1][1].trim());

  distinctList = distinctList.sort((a, b) => {
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    return 0;
  });


  const lines = [line1, line2, ...distinctList.map(line => `${line[0]}%: ${line[1]}`)];
  
  // Actualiza cada línea en su span correspondiente; si falta la línea la crea.
  for (let i = 0; i < lines.length; i++) {
    const lineId = `prints_line${i+1}`;
    let el = document.getElementById(lineId);
    if (!el) {
      // crear línea si no existe
      el = document.createElement('div');
      el.className = 'line';
      el.id = lineId;
      const span = document.createElement('span');
      span.className = 'line-text';
      el.appendChild(span);
      elPrints.appendChild(el);
    }
    const span = el.querySelector('.line-text') || el;
    const text = lines[i] || '';
    span.textContent = text;

    // Aplicar color según el primer número del texto (si corresponde)
    applyColorToSpan(span, text, i);
  }
}

/* =========================== */

 // === Ciclo ===
async function tick() {
  try {
    setStatus("🔄 Actualizando…");
    const data = await readAll();
    renderWidgets(data);
    renderPrints(data);
    setStatus(`✅ Última actualización: ${new Date().toLocaleString()}`);
  } catch (e) {
    console.error(e);
    setStatus(`❌ Error: ${String(e)}`);
  }
}

[elVolumen, elOficial].forEach((el) => el.addEventListener("input", () => renderPrints(prices)));
elRefresh.addEventListener("click", () => tick());

window.addEventListener("load", async () => {
  await initInputs();
  await tick();
  setInterval(tick, 25000);
});
