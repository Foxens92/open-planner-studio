#!/bin/bash
# Compile Open Planner Studio à partir du dossier du projet et installe l'application dans
# Applications (Mac). Double-clic depuis le Bureau après chaque modification.
#
# Installation (une fois, dans le Terminal, depuis le dossier du projet) :
#   cp "scripts/mac/Mettre à jour Open Planner Studio.command" ~/Desktop/
#
# Le travail est fait par scripts/mac/installer-app.sh dans le dossier du projet.

MEMO="$HOME/.open-planner-studio-dossier"
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/opt/homebrew/opt/node@22/bin:/usr/local/bin:/usr/local/opt/node@22/bin:$PATH"

pause_et_quitter() { echo; read -r -p "Appuie sur Entrée pour fermer cette fenêtre." _; exit "${1:-1}"; }
est_le_projet() { [ -f "$1/scripts/mac/installer-app.sh" ] && [ -f "$1/package.json" ]; }

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
  echo "Dossier du projet introuvable (voir docs/travail-local-mac.md)."
  pause_et_quitter 1
fi
echo "$DOSSIER" > "$MEMO"

if bash "$DOSSIER/scripts/mac/installer-app.sh"; then
  echo; echo "Terminé. Cette fenêtre peut être fermée."
  pause_et_quitter 0
else
  echo; echo "La mise à jour a échoué (voir les messages ci-dessus)."
  pause_et_quitter 1
fi
