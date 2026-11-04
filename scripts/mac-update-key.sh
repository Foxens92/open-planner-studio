#!/usr/bin/env bash
# Eigen updatesleutel voor deze fork (eenmalig, op de Mac van de eigenaar).
#
# De in-app updater installeert alleen een update waarvan de handtekening klopt met de publieke
# sleutel in src-tauri/tauri.conf.json (plugins.updater.pubkey). Dit script:
#   1. maakt een sleutelpaar in ~/.tauri/ (of hergebruikt het als het er al is), met wachtwoord;
#   2. zet de publieke sleutel in tauri.conf.json.
# De PRIVÉ-sleutel blijft buiten de repository en wordt nooit gecommit. Zonder die sleutel kan geen
# enkele geïnstalleerde app nog een update van je aannemen: maak er een back-up van.
#
# Gebruik:  bash scripts/mac-update-key.sh
# Sleutelpad wijzigen: OPS_UPDATE_KEY=/pad/naar/sleutel bash scripts/mac-update-key.sh
set -euo pipefail

cd "$(dirname "$0")/.."
KEY="${OPS_UPDATE_KEY:-$HOME/.tauri/open-planner-studio.key}"
CONF="src-tauri/tauri.conf.json"

die() { echo "Erreur : $*" >&2; exit 1; }
command -v node >/dev/null || die "Node.js est introuvable (installe Node 22)."
[ -d node_modules/@tauri-apps/cli ] || die "Dépendances absentes : lance d'abord 'npm ci'."

if [ -f "$KEY" ] && [ -f "$KEY.pub" ]; then
  echo "Clé existante réutilisée : $KEY"
else
  [ -e "$KEY" ] && die "$KEY existe sans $KEY.pub ; vérifie ce fichier avant de continuer."
  mkdir -p "$(dirname "$KEY")"
  echo "Création de la clé de signature. Choisis un mot de passe et note-le : il sera demandé à chaque publication."
  npx tauri signer generate -w "$KEY"
  chmod 600 "$KEY"
fi

PUB="$(tr -d '\r\n' < "$KEY.pub")"
[ -n "$PUB" ] || die "$KEY.pub est vide."

# Alleen de waarde van "pubkey" vervangen, zodat de rest van het bestand byte-gelijk blijft.
OPS_PUB="$PUB" node -e '
  const fs = require("fs");
  const file = process.argv[1];
  const text = fs.readFileSync(file, "utf8");
  const re = /("pubkey"\s*:\s*")[^"]*(")/;
  if (!re.test(text)) { console.error("Geen pubkey-veld in " + file); process.exit(1); }
  fs.writeFileSync(file, text.replace(re, (_, a, b) => a + process.env.OPS_PUB + b));
' "$CONF"

echo
echo "Clé publique inscrite dans $CONF."
echo "Étapes suivantes :"
echo "  1. Sauvegarde $KEY et son mot de passe (gestionnaire de mots de passe, disque externe)."
echo "     Sans eux, plus aucune app installée n'acceptera tes mises à jour."
echo "  2. git add $CONF && git commit -m 'Updater: eigen sleutel' && git push"
echo "  3. Compile et installe cette version (scripts/publish-mac-update.sh la publie aussi)."
