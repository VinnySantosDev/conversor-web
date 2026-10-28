/**
 * Contrato que todo conversor precisa seguir.
 *
 * Para adicionar um novo tipo de arquivo (áudio, vídeo, PDF...), crie um
 * arquivo nesta pasta que exporte um Converter e registre em registry.ts.
 * O resto do app (UI, worker) não precisa mudar.
 */

export interface OutputFormat {
  /** Identificador interno, ex.: "webp" */
  id: string;
  /** Nome exibido na interface, ex.: "WebP" */
  label: string;
  /** MIME type gerado, ex.: "image/webp" */
  mime: string;
  /** Extensão do arquivo final, sem ponto */
  extension: string;
  /** Se o formato aceita ajuste de qualidade (formatos com perda) */
  lossy: boolean;
}

export interface ConvertOptions {
  /** Qualidade de 0 a 1, ignorada em formatos sem perda */
  quality: number;
}

export interface Converter {
  /** Nome do conversor, para logs e mensagens de erro */
  name: string;
  /** Categoria exibida na interface, ex.: "Imagens" */
  category: string;
  /** MIME types de entrada que este conversor aceita */
  inputMimes: string[];
  /**
   * Extensões de entrada, sem ponto. Usadas quando o navegador não informa o
   * MIME certo (no Windows, .csv costuma chegar como application/vnd.ms-excel).
   */
  inputExtensions: string[];
  /** Formatos de saída que ele consegue gerar */
  outputs: OutputFormat[];
  /**
   * Executa a conversão. Roda dentro do Web Worker,
   * então NÃO pode usar `document`, `window` nem DOM.
   */
  convert(input: File, output: OutputFormat, options: ConvertOptions): Promise<Blob>;
}
