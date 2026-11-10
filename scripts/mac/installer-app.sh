#!/usr/bin/env bash
# Bouwt de desktopapp op deze Mac en vervangt die in /Applications (eigenaar, 2026-11-10: lokaal werken,
# geen updatekanaal). Aangeroepen door "Mettre à jour Open Planner Studio.command"; ook los te draaien:
#   bash scripts/mac/installer-app.sh
# Bouwt alleen voor de eigen processor (sneller dan universeel). De gebruikersgegevens van de app
# (instellingen, herstelbestanden) staan buiten de app en blijven bij het vervangen staan.
set -euo pipefail

cd "$(dirname "$0")/../.."
NOM="$(node -p "require('./src-tauri/tauri.conf.json').productName")"
CIBLE="/Applications/$NOM.app"
die() { echo "Erreur : $*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "ce script se lance sur un Mac."
xcode-select -p >/dev/null 2>&1 || die "outils Xcode absents : lance 'xcode-select --install'."
command -v node >/dev/null || die "Node.js introuvable : 'brew install node@22'."
command -v cargo >/dev/null || [ -x "$HOME/.cargo/bin/cargo" ] \
  || die "Rust introuvable : curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
export PATH="$HOME/.cargo/bin:$PATH"

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "Attention : des modifications ne sont pas enregistrées comme version ; elles seront incluses."
fi
echo "Version : $(node -p "require('./package.json').version") ($(git describe --tags --always 2>/dev/null || echo 'sans git'))"

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Installation des dépendances..."
  npm ci
fi

echo "Compilation (10 à 20 minutes la première fois, quelques minutes ensuite)..."
npm run tauri:build -- --bundles app

APP="src-tauri/target/release/bundle/macos/$NOM.app"
[ -d "$APP" ] || die "application compilée introuvable : $APP"

# Draaiende app eerst netjes sluiten (de eigen vraag om niet-opgeslagen werk blijft gelden).
if pgrep -f "$CIBLE/Contents/MacOS/" >/dev/null 2>&1; then
  echo "Fermeture de l'application en cours (enregistre ton travail si elle le demande)..."
  osascript -e "quit app \"$NOM\"" >/dev/null 2>&1 || true
  for _ in $(seq 1 60); do pgrep -f "$CIBLE/Contents/MacOS/" >/dev/null 2>&1 || break; sleep 1; done
  pgrep -f "$CIBLE/Contents/MacOS/" >/dev/null 2>&1 && die "l'application est toujours ouverte ; ferme-la puis relance."
fi

rm -rf "$CIBLE"
ditto "$APP" "$CIBLE"
xattr -dr com.apple.quarantine "$CIBLE" 2>/dev/null || true
echo "Installée : $CIBLE"
open "$CIBLE"
