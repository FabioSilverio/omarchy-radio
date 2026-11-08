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
