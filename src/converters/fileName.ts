/** Extensão do nome do arquivo, em minúsculas e sem ponto ("" se não houver). */
export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}
