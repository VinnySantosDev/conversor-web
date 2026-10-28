import type { WorkerRequest, WorkerResponse } from "./protocol";

export interface ConversionResult {
  blob: Blob;
  extension: string;
  ms: number;
}

/**
 * Embrulha o Web Worker numa API de Promise:
 *   const result = await client.convert(file, "webp", 0.9)
 *
 * Usa um único worker e processa os jobs um de cada vez (fila implícita do
 * worker). Para paralelizar, crie um pool com navigator.hardwareConcurrency
 * workers, mas cuidado com memória: cada imagem grande decodificada ocupa
 * largura × altura × 4 bytes.
 */
export class ConverterClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: ConversionResult) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const job = this.pending.get(msg.jobId);
      if (!job) return;
      this.pending.delete(msg.jobId);

      if (msg.ok) job.resolve({ blob: msg.blob, extension: msg.extension, ms: msg.ms });
      else job.reject(new Error(msg.error));
    };

    // Erro fatal no worker (ex.: falha ao carregar o script): rejeita tudo.
    this.worker.onerror = (event) => {
      const error = new Error(`Falha no worker: ${event.message}`);
      for (const job of this.pending.values()) job.reject(error);
      this.pending.clear();
    };
  }

  convert(file: File, outputId: string, quality: number): Promise<ConversionResult> {
    const jobId = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(jobId, { resolve, reject });
      const request: WorkerRequest = { jobId, file, outputId, quality };
      this.worker.postMessage(request);
    });
  }
}
