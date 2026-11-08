# ~/omarchy-radio

Spotify, mas só rádio. Áudio direto do YouTube (**sem vídeo na tela**), em shuffle
infinito, com vinheta falada entre as músicas. Visual Omarchy / Catppuccin Mocha,
fonte JetBrains Mono. Site **100% estático e público**.

## Rádios incluídas (130 faixas cada, IDs reais validados)

- **Jonas Brothers Radio** — discografia, Nick Jonas, DNCE e Camp Rock
- **Hits no TikTok Hoje**
- **Hits 2010** — geração 2009–2011
- **Mais Ouvidas de Todos os Tempos**

As faixas ficam em `tracks-data.js` (gerado de buscas reais no YouTube,
todos os IDs conferidos um a um). Suas rádios criadas na interface ficam
no navegador e podem ser exportadas/importadas em ⚙ Ferramentas.

## Como o áudio nunca para (cadeia de fallback)

1. **YouTube oculto** (player de 4×4px invisível, só áudio)
2. **Backend yt-dlp** (se configurado em ⚙ Ferramentas)
3. **Fonte alternativa pública** (áudio do mesmo vídeo)
4. **Outra versão da mesma música** (busca automática)
5. **Próxima faixa** — e a que falhou é lembrada por 24h e pulada sozinha

Ferramentas: ♥ favoritas (vira uma rádio), histórico, ⏲ sleep timer,
⊘ bloquear faixa na rádio, ↻ tentar de novo, compartilhar rádio por link
(quem abre importa a rádio), botões de mídia do teclado/fone, estatísticas
de plays e tempo ouvido. Atalhos: `espaço` `n` `p` `f` `m` `/` `←` `→`.

## Publicar

- **GitHub Pages:** suba esta pasta num repo → Settings → Pages → `main`, `/ (root)`.
- **Netlify Drop / Vercel / Cloudflare Pages:** arraste a pasta inteira
  (precisa incluir `tracks-data.js`, `sw.js`, `manifest.webmanifest`, `icon.svg`).

## Fallback yt-dlp (backend opcional)

O site é estático, então o yt-dlp roda num serviço público separado:

1. Suba a pasta `backend/` num **Hugging Face Space (Docker)** ou Render/Railway.
2. No site, ⚙ Ferramentas → cole a URL pública do backend. Ou passe por link:
   `seusite.com/?backend=https://seu-backend.hf.space`
3. Teste: `GET /health` → `{"ok": true}`. Áudio: `GET /stream/{video_id}` (com Range).

## Criar suas rádios

Botão **+ nova rádio**: nome, descrição, texto da vinheta, cor e uma faixa por
linha: `Artista - Título | link do YouTube` (ou só o link). Compartilhe com
**⧉ compartilhar** na página da rádio.

## Estrutura

```
omarchy-radio/
├── index.html       ← o app inteiro
├── tracks-data.js   ← 520 faixas validadas (130 por rádio)
├── sw.js, manifest.webmanifest, icon.svg  ← PWA (instalável)
└── backend/         ← fallback yt-dlp opcional (FastAPI + Dockerfile)
```
