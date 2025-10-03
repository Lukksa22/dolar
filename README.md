# Cotización (Frontend listo para GitHub Pages)

Este proyecto replica en el navegador lo que `cotizacion.py` imprime, con el **mismo formato** visual de la página adjunta. No requiere backend: hace `fetch` directo a la API de CriptoYa y recalcula las fórmulas en el cliente.

## Cómo publicar en GitHub Pages

1. Crea un repositorio y subí estos archivos en la raíz:
   - `index.html`
   - `assets/backend.js`
   - `assets/styles.css`
2. En GitHub, ve a **Settings → Pages** y en **Build and deployment** elegí **Deploy from a branch** y la rama (p. ej. `main`) con la carpeta `/` (root).

## Comportamiento técnico

- **Fetch a la API**: cada **25 segundos** o cuando el usuario toca **“Actualizar ahora”**.
- **Fórmulas**: se recalculan **en vivo** al modificar *Volumen*, *Oficial* o *Comisión*.
- **Fuentes de datos**: `USDT/USD`, `USDT/ARS`, `USDC/USD`, `USDC/ARS` de `https://criptoya.com/api/.../0.1`.
- **Paridad** con `cotizacion.py`:
  - Fórmula 1: `oficial -> beloUSDT -> beloARS` (sin comisión).
  - Fórmula 2: `oficial -> beloUSDT -> CocosCrypto -> CocosCryptoARS` (resta comisión en USDT).
- **UI**: igual estilo al adjunto, con tarjetas de “Precios usados” y “Otros precios”.

> Nota: GitHub Pages es un hosting estático; `cotizacion.py` no corre allí. Esta versión migra la lógica al navegador.
