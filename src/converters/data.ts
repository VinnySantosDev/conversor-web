import { fileExtension } from "./fileName";
import type { Converter, OutputFormat } from "./types";

/**
 * Conversor de dados tabulares: CSV ↔ TSV ↔ JSON.
 *
 * - CSV: detecta vírgula ou ponto e vírgula (o Excel em português usa ";").
 * - Texto: tenta UTF-8 e, se falhar, Windows-1252 (padrão do Excel no Brasil).
 * - JSON de entrada: lista de objetos ou lista de listas (1ª linha = cabeçalho).
 * - CSV de saída leva BOM, para o Excel mostrar acentos corretamente.
 * - Os valores são mantidos como texto: converter "01234" em número perderia o zero.
 */

const OUTPUTS: OutputFormat[] = [
  { id: "csv", label: "CSV", mime: "text/csv", extension: "csv", lossy: false },
  { id: "tsv", label: "TSV", mime: "text/tab-separated-values", extension: "tsv", lossy: false },
  { id: "json", label: "JSON", mime: "application/json", extension: "json", lossy: false },
];

interface Table {
  headers: string[];
  rows: string[][];
}

export const dataConverter: Converter = {
  name: "Dados (CSV/TSV/JSON)",
  category: "Planilhas e dados",
  inputMimes: ["text/csv", "text/tab-separated-values", "application/json"],
  inputExtensions: ["csv", "tsv", "json"],
  outputs: OUTPUTS,

  async convert(input, output) {
    const text = decodeText(await input.arrayBuffer());
    const kind = inputKind(input);

    let table: Table;
    if (kind === "json") table = fromJson(text);
    else {
      const rows = parseDelimited(text, kind === "tsv" ? "\t" : detectDelimiter(text));
      if (rows.length === 0) throw new Error("O arquivo está vazio.");
      table = { headers: rows[0], rows: rows.slice(1) };
    }

    let result: string;
    if (output.id === "json") result = toJson(table);
    else {
      const delimiter = output.id === "tsv" ? "\t" : ",";
      const lines = [table.headers, ...table.rows].map((r) => r.map((v) => escapeField(v, delimiter)).join(delimiter));
      result = (output.id === "csv" ? "﻿" : "") + lines.join("\r\n") + "\r\n";
    }
    return new Blob([result], { type: `${output.mime};charset=utf-8` });
  },
};

function inputKind(file: File): "csv" | "tsv" | "json" {
  const ext = fileExtension(file.name);
  if (ext === "json" || file.type === "application/json") return "json";
  if (ext === "tsv" || file.type === "text/tab-separated-values") return "tsv";
  return "csv";
}

function decodeText(buffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  return text.replace(/^﻿/, "");
}

/** Escolhe entre "," e ";" contando qual aparece mais na primeira linha. */
function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const count = (ch: string) => firstLine.split(ch).length - 1;
  return count(";") > count(",") ? ";" : ",";
}

/** Parser de CSV no padrão RFC 4180: aspas, aspas duplicadas e quebras de linha dentro de campos. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endRow = () => {
    row.push(field);
    // Ignora linhas totalmente vazias (comum no fim do arquivo).
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
    field = "";
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else inQuotes = false;
    } else if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else field += ch;
  }
  if (inQuotes) throw new Error("CSV inválido: há aspas abertas que nunca são fechadas.");
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

function escapeField(value: string, delimiter: string): string {
  return value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function fromJson(text: string): Table {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON inválido: ${err instanceof Error ? err.message : String(err)}`);
  }
  // Um objeto solto vira uma tabela de uma linha.
  if (data && typeof data === "object" && !Array.isArray(data)) data = [data];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("O JSON precisa ser uma lista de objetos, ex.: [{\"nome\": \"Ana\"}, ...].");
  }

  if (data.every(Array.isArray)) {
    const [headers, ...rows] = (data as unknown[][]).map((r) => r.map(cellToString));
    return { headers, rows };
  }
  if (!data.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
    throw new Error("O JSON mistura tipos. Use uma lista só de objetos ou só de listas.");
  }

  // Cabeçalho = união das chaves, na ordem em que aparecem.
  const headers = [...new Set((data as Record<string, unknown>[]).flatMap((item) => Object.keys(item)))];
  const rows = (data as Record<string, unknown>[]).map((item) => headers.map((h) => cellToString(item[h])));
  return { headers, rows };
}

function toJson({ headers, rows }: Table): string {
  const objects = rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
  return JSON.stringify(objects, null, 2) + "\n";
}
