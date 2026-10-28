import { defineConfig } from "vite";

export default defineConfig({
  worker: {
    // Workers como módulos ES: permite import dentro do worker.
    format: "es",
  },
  // Quando você adicionar ffmpeg.wasm com multithread, ele precisa de
  // SharedArrayBuffer, que só existe com estes headers. Eles quebram embeds de
  // terceiros (anúncios, iframes), então só ligue quando for necessário.
  // Lembre de configurar os mesmos headers no host de produção.
  //
  // server: {
  //   headers: {
  //     "Cross-Origin-Opener-Policy": "same-origin",
  //     "Cross-Origin-Embedder-Policy": "require-corp",
  //   },
  // },
});
