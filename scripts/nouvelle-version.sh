#!/usr/bin/env bash
# Eén nieuwe versie per wijziging in deze fork, zodat elke stap terug te halen is.
#
# Verhoogt de versie (npm run bump: JJJJ.W.N, het volgnummer binnen de ISO-week telt op), commit dat
# samen met de staande wijzigingen en zet een geannoteerde tag `fox-v<versie>` die naar GitHub gaat.
# Bewust geen `v*`-tag: die start de officiële releaseketen (.github/workflows/release.yml).
#
# Terughalen:  git checkout fox-v<versie>     (alleen bekijken/testen)
# Terug naar de nieuwste stand:  git checkout <branch>
#
# Gebruik:  bash scripts/nouvelle-version.sh "Korte omschrijving van de wijziging"
# Extra commit-tekst: OPS_COMMIT_BODY="..." bash scripts/nouvelle-version.sh "..."
set -euo pipefail

cd "$(dirname "$0")/.."
DESC="${1:-}"
die() { echo "Erreur : $*" >&2; exit 1; }
[ -n "$DESC" ] || die "donne une courte description : bash scripts/nouvelle-version.sh \"Ce qui change\""
BRANCH="$(git symbolic-ref --quiet --short HEAD)" || die "tu es sur une ancienne version (HEAD détaché). Reviens d'abord sur ta branche : git checkout <branche>."

npm run --silent bump
VERSION="$(node -p "require('./package.json').version")"
TAG="fox-v$VERSION"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "l'étiquette $TAG existe déjà."

git add -A
# Optionele toelichting onder de titel (bv. de attributieregels van een agent).
if [ -n "${OPS_COMMIT_BODY:-}" ]; then
  git commit -q -m "Versie $VERSION: $DESC" -m "$OPS_COMMIT_BODY"
else
  git commit -q -m "Versie $VERSION: $DESC"
fi
git tag -a "$TAG" -m "$DESC"
git push -q -u origin "$BRANCH"
# Een agentsessie in de cloud mag geen tags pushen: de versiecommit staat dan op GitHub en de Mac
# van de eigenaar zet de tag later (scripts/etiquettes-versions.sh, via de lanceerder).
if git push -q origin "$TAG" 2>/dev/null; then
  echo "Version $VERSION enregistrée ($TAG) : $DESC"
else
  echo "Version $VERSION enregistrée : $DESC (étiquette $TAG locale ; elle sera créée sur GitHub par le lanceur du Mac)"
fi
