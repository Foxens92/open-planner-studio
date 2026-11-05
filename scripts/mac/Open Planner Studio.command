#!/bin/bash
# Lance Open Planner Studio dans le navigateur (Mac). Double-clic depuis le Bureau.
#
# Installation (une fois, dans le Terminal, depuis le dossier du projet) :
#   cp "scripts/mac/Open Planner Studio.command" ~/Desktop/
#
# Ce que fait ce fichier :
#   1. retrouve le dossier du projet (demandé la première fois, puis mémorisé) ;
#   2. si l'application tourne déjà, ouvre simplement le navigateur ;
#   3. sinon récupère les dernières modifications de ta branche (si rien n'est en cours),
#      installe les dépendances si elles ont changé, démarre le serveur et ouvre le navigateur.
# Laisse la fenêtre du Terminal ouverte pendant que tu travailles ; la fermer arrête l'application.

MEMO="$HOME/.open-planner-studio-dossier"

# Un double-clic ne charge pas toujours le PATH de Homebrew : on ajoute les emplacements courants.
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node@22/bin:/usr/local/bin:/usr/local/opt/node@22/bin:$PATH"

pause_et_quitter() { echo; read -r -p "Appuie sur Entrée pour fermer cette fenêtre." _; exit "${1:-1}"; }
est_le_projet() { [ -f "$1/scripts/dev-server.mjs" ] && [ -f "$1/package.json" ]; }

# --- 1. Dossier du projet ---------------------------------------------------------------------
DOSSIER=""
[ -f "$MEMO" ] && DOSSIER="$(cat "$MEMO")"
if ! est_le_projet "$DOSSIER"; then
  DOSSIER=""
  for c in "$HOME/open-planner-studio" "$HOME/Documents/open-planner-studio" \
           "$HOME/Developer/open-planner-studio" "$HOME/Desktop/open-planner-studio"; do
    if est_le_projet "$c"; then DOSSIER="$c"; break; fi
  done
fi
if [ -z "$DOSSIER" ]; then
  DOSSIER="$(osascript -e 'POSIX path of (choose folder with prompt "Choisis le dossier open-planner-studio")' 2>/dev/null)"
  DOSSIER="${DOSSIER%/}"
fi
if ! est_le_projet "$DOSSIER"; then
  echo "Dossier du projet introuvable. Clone-le d'abord :"
  echo "  git clone https://github.com/Foxens92/open-planner-studio.git"
  pause_et_quitter 1
fi
echo "$DOSSIER" > "$MEMO"
cd "$DOSSIER" || pause_et_quitter 1

command -v node >/dev/null || { echo "Node.js introuvable. Installe-le : brew install node@22"; pause_et_quitter 1; }
command -v git >/dev/null || { echo "git introuvable. Installe les outils Xcode : xcode-select --install"; pause_et_quitter 1; }

# Port fixe de ce dossier, noté par le serveur dans .claude/launch.json.
port_note() {
  node -e "import('./scripts/dev-port.mjs').then(m => console.log(m.readRecordedPort(process.cwd()) || ''))" 2>/dev/null
}
repond() { curl -s -o /dev/null --max-time 2 "http://localhost:$1/"; }

# --- 2. Déjà lancé ? --------------------------------------------------------------------------
PORT="$(port_note)"
if [ -n "$PORT" ] && repond "$PORT"; then
  echo "L'application tourne déjà : ouverture de http://localhost:$PORT/"
  open "http://localhost:$PORT/"
  exit 0
fi

# --- 3. Mise à jour du code et des dépendances ------------------------------------------------
BRANCHE="$(git symbolic-ref --quiet --short HEAD)"
if [ -z "$BRANCHE" ]; then
  echo "Version figée : $(git describe --tags --always) (pas de mise à jour automatique)."
elif [ -n "$(git status --porcelain)" ]; then
  echo "Modifications locales en cours : pas de mise à jour automatique."
else
  echo "Récupération des dernières modifications de $BRANCHE..."
  git pull --ff-only --quiet || echo "Mise à jour impossible (réseau ?) : lancement de la version locale."
fi
# Étiquettes fox-v<version> manquantes (créées à partir des commits "Versie ..."), pour pouvoir
# revenir à n'importe quelle version.
[ -f scripts/etiquettes-versions.sh ] && bash scripts/etiquettes-versions.sh
echo "Version : $(node -p "require('./package.json').version") ($(git describe --tags --always))"

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Installation des dépendances (quelques minutes la première fois)..."
  npm ci || { echo "L'installation a échoué."; pause_et_quitter 1; }
fi

# --- 4. Démarrage et ouverture du navigateur --------------------------------------------------
JOURNAL="$(mktemp "${TMPDIR:-/tmp}/open-planner-studio.XXXXXX")"
npm run dev > "$JOURNAL" 2>&1 &
SERVEUR=$!
trap 'kill "$SERVEUR" 2>/dev/null; rm -f "$JOURNAL"' EXIT

echo "Démarrage..."
PORT=""
for _ in $(seq 1 120); do
  if ! kill -0 "$SERVEUR" 2>/dev/null; then
    echo "Le serveur s'est arrêté :"; cat "$JOURNAL"; pause_et_quitter 1
  fi
  PORT="$(grep -oE 'http://localhost:[0-9]+' "$JOURNAL" | head -n 1 | sed 's/.*://')"
  if [ -n "$PORT" ] && repond "$PORT"; then break; fi
  sleep 0.5
done
[ -n "$PORT" ] && repond "$PORT" || { echo "Le serveur ne répond pas :"; cat "$JOURNAL"; pause_et_quitter 1; }

echo
echo "Open Planner Studio : http://localhost:$PORT/"
echo "Laisse cette fenêtre ouverte. Ferme-la (ou Ctrl+C) pour arrêter l'application."
open "http://localhost:$PORT/"
wait "$SERVEUR"
