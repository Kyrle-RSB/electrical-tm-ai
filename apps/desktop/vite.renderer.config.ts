import { defineConfig } from 'vite';

// index.html stays strict for packaged builds. Vite transforms only the
// served development HTML, where it needs injected styles and local HMR.
const productionCsp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'";
const developmentCsp = productionCsp
  .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
  .replace("connect-src 'none'", "connect-src 'self' ws://localhost:* ws://127.0.0.1:*");

export default defineConfig({
  base: './',
  plugins: [{
    name: 'fork-b-development-csp',
    apply: 'serve',
    transformIndexHtml(html: string) {
      if (html.split(productionCsp).length !== 2) {
        throw new Error('Expected one production CSP; refusing to weaken an unknown page');
      }
      return html.replace(productionCsp, developmentCsp);
    }
  }],
  build: { sourcemap: false }
});
