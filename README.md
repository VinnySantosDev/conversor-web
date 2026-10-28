# Conversor Web

Conversor de arquivos que roda 100% no navegador. Nenhum arquivo é enviado para servidor.

Formatos suportados:

- **Imagens:** PNG, JPEG, WebP, GIF, BMP e AVIF de entrada; PNG, JPEG, WebP e PDF de saída.
- **Planilhas e dados:** CSV (vírgula ou ponto e vírgula), TSV e JSON, convertendo entre si. Aceita arquivos em UTF-8 ou Windows-1252 (Excel); o CSV gerado tem BOM para o Excel abrir com acentos.

## Rodando

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # gera a versão de produção em dist/
```

O resultado do build é um site estático: dá para hospedar em Vercel, Cloudflare Pages, GitHub Pages ou Netlify sem backend.

## Arquitetura

```
src/
├── main.ts              # UI: seleção de arquivos, lista de jobs, download
├── workerClient.ts      # API de Promise em volta do Web Worker
├── worker.ts            # Executa as conversões fora da thread principal
├── protocol.ts          # Tipos das mensagens página ↔ worker
└── converters/
    ├── types.ts         # Interface Converter (o contrato)
    ├── registry.ts      # Lista de conversores ativos
    ├── fileName.ts      # Utilitário de extensão de arquivo
    ├── image.ts         # Conversor de imagens (APIs nativas)
    ├── pdf.ts           # Monta PDF de uma página com JPEG, sem biblioteca
    └── data.ts          # Conversor CSV ↔ TSV ↔ JSON
```

Fluxo: `main.ts` → `workerClient.ts` → (postMessage) → `worker.ts` → `registry` → conversor → Blob de volta → link de download.

## Adicionando um novo formato

1. Crie `src/converters/meuformato.ts` exportando um objeto que implemente `Converter`.
2. Adicione ao array em `src/converters/registry.ts`.

A UI e o worker se adaptam sozinhos. O código do conversor roda dentro do worker, então não pode usar `document` nem `window`.

## Limitações conhecidas

- **Safari não gera WebP via canvas.** O conversor detecta isso e mostra erro em vez de entregar um PNG renomeado.
- **HEIC (fotos de iPhone) não é decodificado no Chrome/Firefox.** Precisa de libheif em WASM.
- **AVIF de saída** não é suportado pelo canvas na maioria dos navegadores. Precisa de codec em WASM (ex.: jSquash).
- **Memória:** imagens acima de 100 megapixels ou arquivos acima de 200 MB são recusados para não derrubar a aba.
- **JPEG** não tem transparência: áreas transparentes viram branco.

## Próximos passos sugeridos

- Testes automatizados para `replaceExtension`, `formatBytes` e o registry (Vitest).
- Pool de workers para converter vários arquivos em paralelo.
- Opção de redimensionar a imagem.
- Áudio e vídeo via WebCodecs. Para multithread com ffmpeg.wasm, veja os headers COOP/COEP comentados em `vite.config.ts`.
