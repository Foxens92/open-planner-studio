#!/usr/bin/env bash
# Een macOS-update van deze fork publiceren op de eigen GitHub-repository.
#
# Bouwt de app universeel (Apple Silicon + Intel), ondertekent het updatepakket met de eigen sleutel
# (scripts/mac-update-key.sh), schrijft latest.json en zet alles als release op GitHub. De in-app
# updater leest https://github.com/<repo>/releases/latest/download/latest.json.
#
# Bewust NIET de officiële releaseketen (.github/workflows/release.yml): die vraagt Apple- en
# Microsoft-certificaten en alle platformen. De tag heet daarom `mac-v<versie>` en niet `v<versie>`,
# zodat release.yml (die op `v*` start) niet meeloopt.
#
# Vooraf: versie verhoogd (npm run bump), gecommit en gepusht. De app is niet door Apple
# genotariseerd: de eerste installatie vraagt rechtsklik > Openen; updates via de app werken daarna.
#
# Gebruik:  bash scripts/publish-mac-update.sh ["Tekst voor het updatevenster"]
set -euo pipefail

cd "$(dirname "$0")/.."
REPO="${OPS_UPDATE_REPO:-Foxens92/open-planner-studio}"
KEY="${OPS_UPDATE_KEY:-$HOME/.tauri/open-planner-studio.key}"
CONF="src-tauri/tauri.conf.json"
TARGET="universal-apple-darwin"
NOTES="${1:-}"

die() { echo "Erreur : $*" >&2; exit 1; }
[ "$(uname -s)" = "Darwin" ] || die "ce script se lance sur un Mac."
for cmd in node npm cargo rustup gh git; do
  command -v "$cmd" >/dev/null || die "commande '$cmd' introuvable."
done
gh auth status >/dev/null 2>&1 || die "GitHub CLI non connecté : lance 'gh auth login'."
[ -f "$KEY" ] && [ -f "$KEY.pub" ] || die "clé absente ($KEY) : lance d'abord scripts/mac-update-key.sh."

VERSION="$(node -p "require('./$CONF').version")"
TAG="mac-v$VERSION"
[ -n "$NOTES" ] || NOTES="Open Planner Studio $VERSION"

# De clé de l'app doit être la tienne, et l'adresse doit être ton dépôt : sinon l'app installée
# refuserait la mise à jour ou irait la chercher ailleurs.
CONF_PUB="$(node -p "require('./$CONF').plugins.updater.pubkey")"
[ "$CONF_PUB" = "$(tr -d '\r\n' < "$KEY.pub")" ] \
  || die "la clé publique de $CONF n'est pas celle de $KEY.pub. Lance scripts/mac-update-key.sh puis committe."
node -p "require('./$CONF').plugins.updater.endpoints.join(' ')" | grep -q "github.com/$REPO/" \
  || die "l'adresse de mise à jour de $CONF ne pointe pas vers $REPO."

# Ce qui est publié doit correspondre exactement à un commit présent sur GitHub.
[ -z "$(git status --porcelain)" ] || die "modifications non commitées : committe ou annule-les d'abord."
git fetch --quiet origin
[ -n "$(git branch -r --contains HEAD)" ] || die "le commit courant n'est pas sur GitHub : fais 'git push' d'abord."
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  die "la version $VERSION est déjà publiée ($TAG). Augmente la version (npm run bump), committe, pousse."
fi

echo "Compilation de $VERSION ($TARGET)..."
rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null
npm ci
TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY")"
export TAURI_SIGNING_PRIVATE_KEY
if [ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD+x}" ]; then
  read -r -s -p "Mot de passe de la clé de signature : " TAURI_SIGNING_PRIVATE_KEY_PASSWORD; echo
fi
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD
npm run tauri:build -- --target "$TARGET" --bundles app,dmg

BUNDLE="src-tauri/target/$TARGET/release/bundle"
TGZ="$(ls "$BUNDLE"/macos/*.app.tar.gz 2>/dev/null | head -n 1 || true)"
DMG="$(ls "$BUNDLE"/dmg/*.dmg 2>/dev/null | head -n 1 || true)"
[ -n "$TGZ" ] && [ -f "$TGZ.sig" ] || die "paquet de mise à jour signé introuvable dans $BUNDLE/macos."
[ -n "$DMG" ] || die "dmg introuvable dans $BUNDLE/dmg."

# Noms sans espaces : GitHub remplace les espaces des fichiers joints, l'URL ne correspondrait plus.
OUT="build/mac-update/$VERSION"
rm -rf "$OUT" && mkdir -p "$OUT"
APP_ASSET="Open-Planner-Studio_${VERSION}_universal.app.tar.gz"
DMG_ASSET="Open-Planner-Studio_${VERSION}_universal.dmg"
cp "$TGZ" "$OUT/$APP_ASSET"
cp "$TGZ.sig" "$OUT/$APP_ASSET.sig"
cp "$DMG" "$OUT/$DMG_ASSET"

OPS_VERSION="$VERSION" OPS_NOTES="$NOTES" OPS_SIG="$(cat "$TGZ.sig")" \
OPS_URL="https://github.com/$REPO/releases/download/$TAG/$APP_ASSET" \
node -e '
  const e = process.env;
  const entry = { signature: e.OPS_SIG, url: e.OPS_URL };
  // Universeel pakket: dezelfde entry voor Apple Silicon en Intel, met en zonder installersuffix.
  const platforms = {};
  for (const arch of ["aarch64", "x86_64"]) {
    platforms[`darwin-${arch}`] = entry;
    platforms[`darwin-${arch}-app`] = entry;
  }
  const latest = { version: e.OPS_VERSION, notes: e.OPS_NOTES, pub_date: new Date().toISOString(), platforms };
  require("fs").writeFileSync(process.argv[1], JSON.stringify(latest, null, 2) + "\n");
' "$OUT/latest.json"

# Eerst als concept met alle bestanden, pas daarna publiceren: een afgebroken upload laat nooit een
# "nieuwste" release zonder latest.json achter.
echo "Publication de $TAG sur $REPO..."
gh release create "$TAG" --repo "$REPO" --target "$(git rev-parse HEAD)" --draft \
  --title "Open Planner Studio $VERSION (macOS)" --notes "$NOTES" \
  "$OUT/$APP_ASSET" "$OUT/$APP_ASSET.sig" "$OUT/$DMG_ASSET" "$OUT/latest.json"
gh release edit "$TAG" --repo "$REPO" --draft=false --latest

echo
echo "Publié : https://github.com/$REPO/releases/tag/$TAG"
echo "Les apps installées (version plus ancienne, même clé) proposeront cette mise à jour au démarrage."
