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

**Modo SEM ADS rápido (padrão, botão no player):** o player oficial do YouTube
insere comerciais antes de algumas músicas. Então a 1ª faixa da rádio entra
na hora pelo YouTube, e **enquanto ela toca a próxima já é preparada** na
fonte sem comercial — da segunda faixa em diante é instantâneo e sem ads:

1. **Backend yt-dlp** (se configurado em ⚙ Ferramentas)
2. **Fonte alternativa pública** (arquivo de áudio do mesmo vídeo, sem comercial)
3. **YouTube oculto** (player de 4×4px invisível, só áudio — pode ter comercial)
4. **Outra versão da mesma música** (busca automática)
5. **Próxima faixa** — e a que falhou é lembrada por 24h e pulada sozinha

Desligando o **SEM ADS**, a ordem inverte: YouTube primeiro (começa na hora,
com comercial ocasional) e o resto vira fallback de falha.

As **duas próximas** faixas ficam sempre preparadas — pular de faixa (uma ou
duas vezes seguidas) começa em ~1s. A **vinheta** (a cada 3 músicas, ajustável)
entra nos últimos 6s da faixa atual com fade-out da música, e a próxima já
carregada durante a vinheta.

As vinhetas das 4 rádios são **áudio gerado por IA**: voz neural de locutor
(pt-BR, Edge TTS) mixada sobre jingle sintetizado com ducking — arquivos em
`assets/vinhetas/`, gerados por `tools/gerar-vinhetas.py` (rode de novo pra
trocar os textos). Rádios suas sem vinheta própria usam a cama de jingle com
a voz do navegador por cima, ou um mp3 seu (campo no formulário da rádio).
No terminal, `radio` baixa e toca essas mesmas vinhetas entre as músicas.

## Importar playlist do YouTube

- **No site:** botão **⇓ importar playlist do YouTube** (ou em + nova rádio)
  → cole o link da playlist pública/não-listada → **carregar** → salvar.
  Até 300 faixas viram a rádio. Também vale colar o link direto e salvar.
- **No terminal:** `radio playlist <link-da-playlist>` toca em shuffle.

Ferramentas: ♥ favoritas (vira uma rádio), histórico, ⏲ sleep timer,
⊘ bloquear faixa na rádio, ↻ tentar de novo, compartilhar rádio por link
(quem abre importa a rádio), botões de mídia do teclado/fone, estatísticas
de plays e tempo ouvido. Atalhos: `espaço` `n` `p` `f` `m` `/` `←` `→`.

## No terminal do Omarchy

Instala o comando `radio` (toca sem navegador, com mpv + yt-dlp; a próxima
faixa é resolvida em segundo plano enquanto a atual toca):

```bash
curl -fsSL -H "Accept: application/vnd.github.raw" https://api.github.com/repos/FabioSilverio/omarchy-radio/contents/cli/install.sh | bash

radio jonas     # Jonas Brothers Radio
radio tiktok    # Hits no TikTok Hoje
radio 2010      # Hits 2010
radio tops      # Mais Ouvidas de Todos os Tempos
radio sucker    # busca e toca a música (e segue na rádio dela)
radio status    # o que está tocando
radio prox      # próxima (já preparada, começa na hora)
radio pausa     # pausa/continua
radio vol 70    # volume
radio stop      # desliga
radio site      # abre o site no navegador
radio atualizar # atualiza o comando
```

Sem argumento, `radio` abre um menu (fzf). As faixas são as mesmas do site
(baixa `tracks-data.js` da URL pública a cada início e cacheia localmente).

## Controlar o site pelo terminal (ponte local)

O `radio` do terminal e o site no navegador são players diferentes. A **ponte
local** junta os dois: os comandos do terminal passam a controlar o que está
tocando no site.

1. Abra o site no navegador.
2. Rode qualquer comando `radio` (ex.: `radio status`). Ele sobe a ponte
   sozinho em `127.0.0.1:8766` e o site conecta em ~2s (aparece **ponte ✓**
   na barra do topo).
3. Daí `radio status`, `prox`, `pausa`, `vol <n>`, `stop`, `jonas` e
   `playlist <link>` controlam o player do navegador.

Sem o site aberto (ou sem a ponte), o `radio` toca sozinho via mpv/yt-dlp, como
antes. Pra subir a ponte manualmente: `radio bridge`. Porta alternativa:
`RADIO_BRIDGE_PORT=9000 radio bridge`.

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
