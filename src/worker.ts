/// <reference lib="webworker" />
import { findConverter, findOutput } from "./converters/registry";
import type { WorkerRequest, WorkerResponse } from "./protocol";

/**
 * Toda conversão roda aqui, fora da thread principal.
 * Se rodasse na página, a interface congelaria durante conversões pesadas.
 */

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { jobId, file, outputId, quality } = event.data;

  const reply = (msg: WorkerResponse) => self.postMessage(msg);

  try {
    const converter = findConverter(file);
    if (!converter) throw new Error(`Formato de entrada não suportado: ${file.type || "desconhecido"}`);

    const output = findOutput(converter, outputId);
    if (!output) throw new Error(`O conversor "${converter.name}" não gera esse formato.`);

    const start = performance.now();
    const blob = await converter.convert(file, output, { quality });
    const ms = Math.round(performance.now() - start);

    reply({ jobId, ok: true, blob, extension: output.extension, ms });
  } catch (err) {
    reply({ jobId, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
