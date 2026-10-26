# Textbook Whisperer

**Big textbook. Small lightbulb moment.** A local study app that answers questions about textbooks and lecture slides with inspectable PDF page citations. Switch to **“I skipped class”** for plain-language explanations, analogies, and key takeaways.

## Run

Install Node.js 22+ and [Ollama](https://ollama.com/download), then:

```sh
npm install
ollama pull qwen3:4b
npm start
```

Open http://127.0.0.1:3210. Keep Ollama running. Add a searchable PDF, select your documents, turn off **Source preview**, and ask a question. Export PowerPoint or Google Slides to PDF first. Use **Try the biology sample** to explore without uploading material.

**Source preview works without Ollama**, but only retrieves verbatim excerpts; it is explicitly labeled and does not simulate an AI answer. Explanation modes apply to Local AI answers only.

## Why open-weight AI is central

[Qwen3 4B](https://ollama.com/library/qwen3:4b) generates the explanations using [Ollama's chat API](https://docs.ollama.com/api/chat). There is no proprietary model fallback or paid API requirement. Retrieval supplies evidence; the model synthesizes that evidence and changes its teaching style. The model weights are distributed separately; see the [Qwen3 model card and license](https://huggingface.co/Qwen/Qwen3-4B). This application's source code is MIT licensed.

## Features

- Searchable textbook and slide PDFs, up to 25 MB / 1,000 pages each.
- Multiple selected documents per question, with persistent local storage.
- Overlapping, page-bound chunks and lexical BM25-style retrieval.
- Structured model answers with source-ID validation on every paragraph.
- Click citations to see the exact passage or open the original PDF page.
- Standard and “sophomore who skipped class” explanation modes.
- Copy answers with references, delete documents, responsive keyboard-accessible UI.
- Original biology sample notes, no copyrighted textbook bundled.

## Architecture

Browser → loopback Node HTTP server → PDF.js text extraction → page-aware retrieval → local Ollama/Qwen3 → validated paragraph citations.

The UI uses plain HTML, CSS, and JavaScript. The server uses Node built-ins plus Mozilla PDF.js. PDF originals and extracted text live in `data/`, excluded from Git. Only retrieved passages and the current question go to the configured model server. Each question is independent; the visible conversation is a session transcript, not multi-turn model memory.

Configuration via environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3210` | Loopback web server port |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Model server; a remote value sends excerpts to that server |
| `OLLAMA_MODEL` | `qwen3:4b` | Installed Ollama model supporting structured output |

## Grounding and limitations

Page citations refer to **physical PDF page indexes**, not printed page labels. Citations are checked against retrieved source IDs; this does not prove every generated claim is entailed by its passage. Inspect the original evidence. Retrieval is lexical and may miss synonyms or complex cross-document connections. There is no OCR, diagram interpretation, equation-aware parsing, or native PPTX ingestion. Blank pages preserve page numbering. Scanned files need OCR before upload. The app reports missing models and malformed responses instead of fabricating a successful answer.

The server binds only to loopback and rejects foreign origins/hosts. It is a single-user local application, not a multi-user hosted service. Do not expose it publicly without authentication, isolation, rate limiting, and file-processing controls. Deletion removes the local original and extracted text; backups or OneDrive may retain copies. Store the project outside a synchronized folder if you want to avoid cloud file synchronization.

## Verification

```sh
npm test
```

Tests cover page preservation, chunk boundaries, irrelevant queries, invented citations, PDF upload and deletion, origin restrictions, and the model request/response flow with a simulated Ollama server. To verify the full AI path, install Ollama and the model, disable preview, ask “How do light reactions and the Calvin cycle connect?”, compare both modes, and inspect every cited page.

## Publish to public GitHub

From this directory, with GitHub CLI authenticated:

```sh
git init
git add .
git commit -m "Build Textbook Whisperer local AI study app"
gh repo create textbook-whisperer --public --source=. --remote=origin --push
```

Publish only this app directory, never its parent course workspace. `data/` and `node_modules/` are ignored. Add the public repository URL to your submission. A local repository alone does not satisfy the public-GitHub requirement.

## License

MIT; see [LICENSE](LICENSE). Third-party packages and separately downloaded model weights retain their own licenses.
