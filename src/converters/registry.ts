import { dataConverter } from "./data";
import { fileExtension } from "./fileName";
import { imageConverter } from "./image";
import type { Converter, OutputFormat } from "./types";

/**
 * Lista de conversores disponíveis. Para suportar novos formatos,
 * adicione o conversor aqui. Ex.: [imageConverter, audioConverter]
 */
export const converters: Converter[] = [imageConverter, dataConverter];

/** Procura pelo MIME primeiro e, se não achar, pela extensão do nome. */
export function findConverter(file: { type: string; name: string }): Converter | undefined {
  const ext = fileExtension(file.name);
  return (
    converters.find((c) => file.type && c.inputMimes.includes(file.type)) ??
    converters.find((c) => c.inputExtensions.includes(ext))
  );
}

export function findOutput(converter: Converter, outputId: string): OutputFormat | undefined {
  return converter.outputs.find((o) => o.id === outputId);
}

/** Valor para o atributo `accept` do input: MIME types e extensões. */
export function acceptAttribute(): string {
  return converters
    .flatMap((c) => [...c.inputMimes, ...c.inputExtensions.map((e) => `.${e}`)])
    .join(",");
}

/** Todos os formatos de saída, sem repetição, para o seletor da UI. */
export function allOutputs(): OutputFormat[] {
  const seen = new Map<string, OutputFormat>();
  for (const c of converters) for (const o of c.outputs) seen.set(o.id, o);
  return [...seen.values()];
}
