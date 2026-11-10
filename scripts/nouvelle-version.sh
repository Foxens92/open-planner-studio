#!/usr/bin/env bash
# Eén nieuwe versie per wijziging in deze fork, zodat elke stap terug te halen is. Volledig lokaal
# (eigenaar, 2026-11-10): geen GitHub, geen push.
#
# Kiest de volgende versie JJJJ.W.N (ISO-weekjaar, ISO-week, volgnummer binnen de week) uit de huidige
# versie en de lokale `fox-v`-tags, met dezelfde regel als `npm run bump` maar zonder origin, en zet die
# met `npm run bump <versie>` in alle versievelden. Daarna een commit "Versie <versie>: <omschrijving>"
# en een geannoteerde tag `fox-v<versie>`.
#
# Terughalen:  git checkout fox-v<versie>   (bekijken/testen, daarna eventueel de app opnieuw bouwen)
# Terug naar de nieuwste stand:  git checkout main
#
# Gebruik:  bash scripts/nouvelle-version.sh "Korte omschrijving van de wijziging"
# Extra commit-tekst: OPS_COMMIT_BODY="..." bash scripts/nouvelle-version.sh "..."
set -euo pipefail

cd "$(dirname "$0")/.."
DESC="${1:-}"
die() { echo "Erreur : $*" >&2; exit 1; }
[ -n "$DESC" ] || die "donne une courte description : bash scripts/nouvelle-version.sh \"Ce qui change\""
git symbolic-ref --quiet --short HEAD >/dev/null \
  || die "tu es sur une ancienne version (HEAD détaché). Reviens d'abord sur la dernière : git checkout main."

VERSION="$(OPS_TAGS="$(git tag -l 'fox-v*')" node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { nextVersion } from "./scripts/bump-version.js";
  const current = JSON.parse(readFileSync("package.json", "utf8")).version;
  const tags = (process.env.OPS_TAGS || "").split("\n").filter(Boolean).map(t => "v" + t.slice("fox-v".length));
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  console.log(nextVersion(today, [...tags, "v" + current]));
')"
TAG="fox-v$VERSION"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "l'étiquette $TAG existe déjà."

npm run --silent bump -- "$VERSION"
git add -A
# Optionele toelichting onder de titel (bv. de attributieregels van een agent).
if [ -n "${OPS_COMMIT_BODY:-}" ]; then
  git commit -q -m "Versie $VERSION: $DESC" -m "$OPS_COMMIT_BODY"
else
  git commit -q -m "Versie $VERSION: $DESC"
fi
git tag -a "$TAG" -m "$DESC"
echo "Version $VERSION enregistrée ($TAG) : $DESC"
echo "Pour l'installer dans Applications : double-clic sur « Mettre à jour Open Planner Studio » (bureau)."
