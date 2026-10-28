/** Mensagens trocadas entre a página e o Web Worker. */

export interface WorkerRequest {
  jobId: number;
  file: File;
  outputId: string;
  quality: number;
}

export type WorkerResponse =
  | { jobId: number; ok: true; blob: Blob; extension: string; ms: number }
  | { jobId: number; ok: false; error: string };
