#!/usr/bin/env python3
"""
Gera as vinhetas da omarchy-radio: voz neural de locutor (Edge TTS, pt-BR)
mixada sobre uma cama de jingle sintetizada, com ducking igual radio FM.

Uso:
    pip install edge-tts        # uma vez
    python3 tools/gerar-vinhetas.py

Saida: assets/vinhetas/{jonas,tiktok,hits2010,alltime,bed}.mp3
Para regerar com outro texto, edite TEXTOS abaixo e rode de novo.
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "vinhetas"
TMP = Path("/tmp/vinhetas-work")
VOICE = "pt-BR-AntonioNeural"   # locutor masculino neural
RATE, PITCH = "+6%", "-8Hz"

TEXTOS = {
    "jonas": "Omarchy Radio! Você está ouvindo... Jonas Brothers Radio! Só os brothers, sem parar!",
    "tiktok": "Omarchy Radio! Hits no TikTok Hoje! Direto do seu feed... sem o feed!",
    "hits2010": "Omarchy Radio! Hits dois mil e dez! De volta... pra época do iPod!",
    "alltime": "Omarchy Radio! As mais ouvidas de todos os tempos! Só refrão gigante!",
}


def run(*args):
    subprocess.run(args, check=True, capture_output=True, text=True)


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True)
    return float(out.stdout.strip())


def make_bed(dur, out_wav):
    """Jingle sintetizado: whoosh + notas ascendentes + pad, com eco de radio."""
    d = f"{dur:.2f}"
    fc = (
        f"[0:a]atrim=0:0.30,afade=t=in:st=0:d=0.02,afade=t=out:st=0.10:d=0.20,volume=0.55,adelay=0|0[n1];"
        f"[1:a]atrim=0:0.30,afade=t=in:st=0:d=0.02,afade=t=out:st=0.10:d=0.20,volume=0.55,adelay=210|210[n2];"
        f"[2:a]atrim=0:1.40,afade=t=in:st=0:d=0.02,afade=t=out:st=0.50:d=0.90,volume=0.60,adelay=420|420[n3];"
        f"[3:a]atrim=0:1.30,highpass=f=500,lowpass=f=7000,afade=t=in:st=0:d=0.50,afade=t=out:st=0.60:d=0.70,volume=0.16[whoosh];"
        f"[4:a]volume=0.10,tremolo=f=2:d=0.6[pad1];"
        f"[5:a]volume=0.07,tremolo=f=2:d=0.6[pad2];"
        f"[n1][n2][n3][whoosh][pad1][pad2]amix=inputs=6:normalize=0,"
        f"aecho=0.8:0.55:55:0.16,afade=t=in:st=0:d=0.06,afade=t=out:st={dur-1.0:.2f}:d=1.0,volume=0.9[bed]"
    )
    run("ffmpeg", "-y",
        "-f", "lavfi", "-i", f"sine=frequency=659.25:duration={d}",
        "-f", "lavfi", "-i", f"sine=frequency=783.99:duration={d}",
        "-f", "lavfi", "-i", f"sine=frequency=1046.50:duration={d}",
        "-f", "lavfi", "-i", f"anoisesrc=duration={d}:color=pink",
        "-f", "lavfi", "-i", f"sine=frequency=110:duration={d}",
        "-f", "lavfi", "-i", f"sine=frequency=164.81:duration={d}",
        "-filter_complex", fc, "-map", "[bed]", "-ar", "44100", "-ac", "2", str(out_wav))


def mix(voice_mp3, out_mp3):
    vdur = duration(voice_mp3)
    total = vdur + 2.0
    bed = TMP / (Path(out_mp3).stem + "-bed.wav")
    make_bed(total, bed)
    fc = (
        "[0:a]highpass=f=60,acompressor=threshold=-20dB:ratio=4:attack=5:release=140,"
        "volume=1.6,adelay=380|380,asplit=2[vmain][vsc];"
        "[1:a]volume=0.34[bedv];"
        "[bedv][vsc]sidechaincompress=threshold=0.02:ratio=10:attack=10:release=260[duck];"
        f"[vmain][duck]amix=inputs=2:normalize=0,atrim=0:{total:.2f},"
        f"afade=t=out:st={total-0.9:.2f}:d=0.9,alimiter=limit=0.95[out]"
    )
    run("ffmpeg", "-y", "-i", str(voice_mp3), "-i", str(bed),
        "-filter_complex", fc, "-map", "[out]", "-codec:a", "libmp3lame", "-b:a", "128k", str(out_mp3))
    return duration(out_mp3)


def main():
    edge = shutil.which("edge-tts")
    if not edge:
        sys.exit("edge-tts nao encontrado. Instale: pip install edge-tts")
    for cmd in ("ffmpeg", "ffprobe"):
        if not shutil.which(cmd):
            sys.exit(f"{cmd} nao encontrado.")
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    for key, text in TEXTOS.items():
        voice = TMP / f"{key}-voice.mp3"
        run(edge, "--voice", VOICE, "--rate", RATE, "--pitch", PITCH,
            "--text", text, "--write-media", str(voice))
        out = OUT / f"{key}.mp3"
        dur = mix(voice, out)
        print(f"{key}.mp3  {dur:.1f}s  {out.stat().st_size // 1024} KB")
    bed_out = OUT / "bed.mp3"
    bed_wav = TMP / "bed-solo.wav"
    make_bed(9.0, bed_wav)
    run("ffmpeg", "-y", "-i", str(bed_wav), "-codec:a", "libmp3lame", "-b:a", "128k", str(bed_out))
    print(f"bed.mp3  9.0s  {bed_out.stat().st_size // 1024} KB  (cama pras radios sem vinheta propria)")


if __name__ == "__main__":
    main()
