import "./style.css";
import { acceptAttribute, allOutputs, converters, findConverter, findOutput } from "./converters/registry";
import { ConverterClient } from "./workerClient";

/** Limite de tamanho por arquivo. Acima disso, o risco de travar a aba é alto. */
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

const client = new ConverterClient();

const $ = <T extends HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado no HTML`);
  return el as T;
};

const dropzone = $<HTMLLabelElement>("dropzone");
const fileInput = $<HTMLInputElement>("file-input");
const acceptedHint = $<HTMLSpanElement>("accepted-hint");
const targetSelect = $<HTMLSelectElement>("target-format");
const qualityInput = $<HTMLInputElement>("quality");
const qualityValue = $<HTMLOutputElement>("quality-value");
const qualityWrapper = $<HTMLLabelElement>("quality-wrapper");
const jobsList = $<HTMLUListElement>("jobs");

// ---------- Configuração inicial da UI ----------

const outputs = allOutputs();
// Um grupo por conversor, para ficar claro qual saída serve para qual arquivo.
for (const c of converters) {
  const group = document.createElement("optgroup");
  group.label = c.category;
  for (const o of c.outputs) group.append(new Option(o.label, o.id));
  targetSelect.append(group);
}
targetSelect.value = "webp";

fileInput.accept = acceptAttribute();
acceptedHint.textContent = converters
  .map((c) => `${c.category}: ${c.inputExtensions.map((e) => e.toUpperCase()).join(", ")}`)
  .join(" · ");

function updateQualityVisibility() {
  const selected = outputs.find((o) => o.id === targetSelect.value);
  qualityWrapper.hidden = !selected?.lossy;
}
targetSelect.addEventListener("change", updateQualityVisibility);
updateQualityVisibility();

qualityInput.addEventListener("input", () => {
  qualityValue.textContent = qualityInput.value;
});

// ---------- Entrada de arquivos ----------

fileInput.addEventListener("change", () => {
  if (fileInput.files) handleFiles(fileInput.files);
  fileInput.value = ""; // permite escolher o mesmo arquivo de novo
});

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragging");
});
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragging");
  if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
});

// ---------- Conversão ----------

function handleFiles(files: FileList) {
  const outputId = targetSelect.value;
  const quality = Number(qualityInput.value) / 100;
  for (const file of files) void convertFile(file, outputId, quality);
}

async function convertFile(file: File, outputId: string, quality: number) {
  const item = createJobItem(file.name);

  if (file.size > MAX_FILE_SIZE) {
    return item.fail(`Arquivo grande demais (${formatBytes(file.size)}). Limite: ${formatBytes(MAX_FILE_SIZE)}.`);
  }
  const converter = findConverter(file);
  if (!converter) {
    return item.fail(`Formato não suportado: ${file.type || "desconhecido"}`);
  }
  if (!findOutput(converter, outputId)) {
    const options = converter.outputs.map((o) => o.label).join(", ");
    return item.fail(`${converter.category} não podem virar esse formato. Escolha: ${options}.`);
  }

  try {
    const result = await client.convert(file, outputId, quality);
    const newName = replaceExtension(file.name, result.extension);
    item.succeed(result.blob, newName, file.size, result.ms);
  } catch (err) {
    item.fail(err instanceof Error ? err.message : String(err));
  }
}

// ---------- Itens da lista ----------

function createJobItem(fileName: string) {
  const li = document.createElement("li");
  li.className = "job";
  const name = document.createElement("span");
  name.className = "job-name";
  name.textContent = fileName; // textContent, nunca innerHTML: nome de arquivo é entrada do usuário
  const status = document.createElement("span");
  status.className = "job-status";
  status.textContent = "Convertendo…";
  li.append(name, status);
  jobsList.prepend(li);

  function addRemoveButton(onRemove?: () => void) {
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.title = "Remover";
    remove.className = "job-remove";
    remove.onclick = () => {
      onRemove?.();
      li.remove();
    };
    li.append(remove);
  }

  return {
    succeed(blob: Blob, newName: string, originalSize: number, ms: number) {
      li.classList.add("done");
      const diff = Math.round((1 - blob.size / originalSize) * 100);
      const diffText = diff >= 0 ? `${diff}% menor` : `${-diff}% maior`;
      status.textContent = `${formatBytes(originalSize)} → ${formatBytes(blob.size)} (${diffText}) em ${ms} ms`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = newName;
      link.textContent = "Baixar";
      link.className = "job-download";
      li.append(link);
      // Libera a memória do blob quando o item for removido.
      addRemoveButton(() => URL.revokeObjectURL(url));
    },
    fail(message: string) {
      li.classList.add("error");
      status.textContent = message;
      addRemoveButton();
    },
  };
}

// ---------- Utilitários ----------

function replaceExtension(fileName: string, ext: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return `${base}.${ext}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
