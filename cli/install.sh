#!/usr/bin/env bash
# Instala o comando `radio` (omarchy-radio no terminal).
# Uso: curl -fsSL https://raw.githubusercontent.com/FabioSilverio/omarchy-radio/main/cli/install.sh | bash
set -e

BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-install.sh}")" 2>/dev/null && pwd || true)"

if [ -n "${SCRIPT_DIR:-}" ] && [ -f "$SCRIPT_DIR/radio" ] && [ -f "$SCRIPT_DIR/../index.html" ]; then
  install -m755 "$SCRIPT_DIR/radio" "$BIN_DIR/radio"
else
  curl -fsSL -H "Accept: application/vnd.github.raw" "https://api.github.com/repos/FabioSilverio/omarchy-radio/contents/cli/radio" -o "$BIN_DIR/radio"
  grep -q "omarchy-radio" "$BIN_DIR/radio" || { echo "Download do comando falhou." >&2; exit 1; }
  chmod 755 "$BIN_DIR/radio"
fi
echo "✓ comando instalado: $BIN_DIR/radio"

missing=""
command -v mpv >/dev/null 2>&1 || missing="$missing mpv"
command -v yt-dlp >/dev/null 2>&1 || missing="$missing yt-dlp"
if [ -n "$missing" ]; then
  if command -v pacman >/dev/null 2>&1; then
    echo "Instalando dependencias:$missing"
    sudo pacman -S --needed --noconfirm $missing
  else
    echo "Faltam:$missing — instale com o gerenciador da sua distro." >&2
  fi
fi

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "Obs: adicione $BIN_DIR ao seu PATH (no Omarchy ele ja vem por padrao)." ;;
esac

cat <<'EOF'

Pronto! Comandos:
  radio jonas     Jonas Brothers Radio
  radio tiktok    Hits no TikTok Hoje
  radio 2010      Hits 2010
  radio tops      Mais Ouvidas de Todos os Tempos
  radio status    o que esta tocando
  radio prox      proxima musica
  radio pausa     pausa/continua
  radio stop      desliga
  radio site      abre o site no navegador
EOF
