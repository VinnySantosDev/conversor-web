import { jpegToPdf } from "./pdf";
import type { Converter, OutputFormat } from "./types";

/**
 * Conversor de imagens usando só APIs nativas do navegador:
 * createImageBitmap (decodifica) + OffscreenCanvas (codifica).
 *
 * Limitações reais, que você vai encontrar:
 * - O navegador só decodifica o que ele mesmo suporta. HEIC não funciona no
 *   Chrome, por exemplo; para isso você vai precisar de libheif em WASM.
 * - O Safari NÃO codifica WebP via canvas. Ele devolve PNG em silêncio.
 *   Por isso a função checa o tipo do resultado em vez de confiar.
 * - JPEG não tem transparência, então áreas transparentes viram branco.
 */

const OUTPUTS: OutputFormat[] = [
  { id: "png", label: "PNG", mime: "image/png", extension: "png", lossy: false },
  { id: "jpeg", label: "JPEG", mime: "image/jpeg", extension: "jpg", lossy: true },
  { id: "webp", label: "WebP", mime: "image/webp", extension: "webp", lossy: true },
  // O PDF guarda a imagem como JPEG, por isso também tem ajuste de qualidade.
  { id: "pdf", label: "PDF", mime: "application/pdf", extension: "pdf", lossy: true },
];

/** Limite de pixels para evitar estourar a memória da aba (~100 megapixels). */
const MAX_PIXELS = 100_000_000;

export const imageConverter: Converter = {
  name: "Imagem (nativo)",
  category: "Imagens",
  inputMimes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/avif"],
  inputExtensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"],
  outputs: OUTPUTS,

  async convert(input, output, options) {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(input);
    } catch {
      throw new Error("O navegador não conseguiu decodificar esta imagem. O arquivo pode estar corrompido ou o formato não é suportado aqui.");
    }

    try {
      const { width, height } = bitmap;
      if (width * height > MAX_PIXELS) {
        throw new Error(`Imagem grande demais (${width}×${height}). O limite é ${MAX_PIXELS / 1_000_000} megapixels.`);
      }

      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível criar o contexto 2D do canvas.");

      const isPdf = output.id === "pdf";
      const encodeMime = isPdf ? "image/jpeg" : output.mime;

      if (encodeMime === "image/jpeg") {
        // Sem isso, o fundo transparente vira preto em alguns navegadores.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(bitmap, 0, 0);

      const blob = await canvas.convertToBlob({
        type: encodeMime,
        quality: output.lossy ? options.quality : undefined,
      });

      if (blob.type !== encodeMime) {
        throw new Error(`Este navegador não sabe gerar ${output.label} (devolveu ${blob.type}). Tente outro formato ou outro navegador.`);
      }
      return isPdf ? jpegToPdf(blob, width, height) : blob;
    } finally {
      // Libera a memória da imagem decodificada imediatamente.
      bitmap.close();
    }
  },
};
