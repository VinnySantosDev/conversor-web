/**
 * Monta um PDF de uma página contendo um JPEG, sem biblioteca.
 *
 * O PDF aceita JPEG embutido como está (filtro DCTDecode), então basta
 * escrever os objetos e a tabela xref com os offsets em bytes.
 * A página tem o tamanho da imagem a 96 DPI (1 px = 0,75 pt).
 */
export async function jpegToPdf(jpeg: Blob, width: number, height: number): Promise<Blob> {
  const image = new Uint8Array(await jpeg.arrayBuffer());
  const pageW = (width * 0.75).toFixed(2);
  const pageH = (height * 0.75).toFixed(2);
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;

  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (body: string) => {
    offsets.push(length);
    write(`${offsets.length} 0 obj\n${body}\nendobj\n`);
  };

  write("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  object("<< /Type /Catalog /Pages 2 0 R >>");
  object("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
      "/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
  );

  // Objeto 4: a imagem. O stream é binário, então é escrito em partes.
  offsets.push(length);
  write(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`,
  );
  write(image);
  write("\nendstream\nendobj\n");

  object(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  const xrefStart = length;
  write(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) write(`${String(offset).padStart(10, "0")} 00000 n \n`);
  write(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}
