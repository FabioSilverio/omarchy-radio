"""
Fallback yt-dlp da omarchy-radio.

O site (../index.html) e estatico e publico. Quando o embed do YouTube
bloqueia um video, o player chama GET /stream/{video_id} aqui, e este
servico usa o yt-dlp pra extrair o audio e fazer proxy do stream
(com suporte a Range, pro seek funcionar).

Deploy publico gratuito (NAO roda no seu PC):
  - Hugging Face Spaces: crie um Space Docker, suba esta pasta, pronto.
  - Render / Railway: use o Dockerfile desta pasta.

Depois cole a URL publica em: site -> botao "ferramentas" (engrenagem).
"""
import re
import time
import urllib.request
import urllib.error

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import yt_dlp

app = FastAPI(title="omarchy-radio yt-dlp fallback")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

_cache: dict[str, tuple[float, str, str]] = {}  # id -> (expira, url, mime)
TTL = 20 * 60
FORMATS = ["bestaudio/best", "bestaudio[ext=m4a]/best", "140/251/best"]


def _extract_once(video_id: str, fmt: str, client: str) -> tuple[str, str]:
    url = f"https://www.youtube.com/watch?v={video_id}"
    opts = {
        "format": fmt,
        "quiet": True,
        "no_warnings": True,
        "retries": 2,
        "extractor_args": {"youtube": {"player_client": [client]}},
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    direct = info.get("url")
    if not direct:
        raise ValueError("sem url de audio")
    mime = "audio/mp4" if "mp4" in (info.get("ext") or "m4a") else "audio/webm"
    return direct, mime


def extract_audio(video_id: str) -> tuple[str, str]:
    now = time.time()
    hit = _cache.get(video_id)
    if hit and hit[0] > now:
        return hit[1], hit[2]
    last_err: Exception | None = None
    for client in ("android", "web", "ios"):
        for fmt in FORMATS:
            try:
                direct, mime = _extract_once(video_id, fmt, client)
                _cache[video_id] = (now + TTL, direct, mime)
                return direct, mime
            except Exception as ex:  # tenta a proxima combinacao
                last_err = ex
    raise HTTPException(502, f"yt-dlp nao conseguiu extrair o audio: {last_err}")


@app.get("/health")
def health():
    return {"ok": True, "service": "omarchy-radio yt-dlp fallback", "yt_dlp": yt_dlp.version.__version__}


@app.get("/playlist/{playlist_id}")
def playlist(playlist_id: str):
    """Lista as faixas de uma playlist publica do YouTube (via yt-dlp)."""
    if not re.fullmatch(r"[A-Za-z0-9_-]{10,80}", playlist_id):
        raise HTTPException(400, "playlist_id invalido")
    url = f"https://www.youtube.com/playlist?list={playlist_id}"
    opts = {"quiet": True, "no_warnings": True, "extract_flat": True, "playlistend": 300}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as ex:
        raise HTTPException(502, f"nao consegui ler a playlist: {ex}") from ex
    tracks = []
    seen = set()
    for e in info.get("entries") or []:
        vid = e.get("id")
        if not vid or vid in seen:
            continue
        seen.add(vid)
        raw = (e.get("title") or "").strip()
        if " - " in raw:
            artist, title = raw.split(" - ", 1)
        else:
            artist, title = (e.get("channel") or e.get("uploader") or "Artista"), raw
        tracks.append({"artist": artist.strip()[:60], "title": title.strip()[:90], "id": vid})
    return {"title": info.get("title") or "", "tracks": tracks}


@app.get("/stream/{video_id}")
def stream(video_id: str, request: Request):
    if len(video_id) != 11:
        raise HTTPException(400, "video_id invalido")
    direct, mime = extract_audio(video_id)
    headers = {"User-Agent": "Mozilla/5.0"}
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header
    req = urllib.request.Request(direct, headers=headers)
    try:
        resp = urllib.request.urlopen(req)
    except urllib.error.HTTPError as ex:
        # URL direta expirou: limpa o cache e tenta uma vez do zero
        _cache.pop(video_id, None)
        direct, mime = extract_audio(video_id)
        req = urllib.request.Request(direct, headers=headers)
        try:
            resp = urllib.request.urlopen(req)
        except Exception:
            raise HTTPException(502, "upstream recusou o stream") from ex

    out_headers = {"Accept-Ranges": "bytes", "Cache-Control": "no-store"}
    for name in ("Content-Length", "Content-Range"):
        if resp.headers.get(name):
            out_headers[name] = resp.headers[name]

    def gen():
        try:
            while True:
                chunk = resp.read(64 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            resp.close()

    return StreamingResponse(
        gen(),
        status_code=resp.status,
        media_type=mime,
        headers=out_headers,
    )
