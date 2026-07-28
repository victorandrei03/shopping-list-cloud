#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Verificare dependențe..."
if ! command -v python3 &> /dev/null; then
  echo "❌ Python3 nu e instalat!" >&2
  exit 1
fi

echo "Navigare la frontend..."
cd "${SCRIPT_DIR}"

echo "Verificare virtual environment..."
if [ ! -d ".venv" ]; then
  echo "Creez virtual environment..."
  python3 -m venv .venv
fi

echo "Activare virtual environment..."
source .venv/bin/activate

echo "Instalare dependențe..."
pip install -q -r requirements.txt 2>/dev/null || true

echo
echo "🚀 Pornesc frontend pe port 3001..."
echo "📱 Accesează: http://localhost:3001"
echo "Apasă Ctrl+C pentru a opri"
echo

python app.py
