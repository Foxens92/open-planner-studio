#!/usr/bin/env bash
# Zet voor elke versiecommit ("Versie <JJJJ.W.N>: <omschrijving>", zie scripts/nouvelle-version.sh)
# de lokale tag `fox-v<versie>` als die nog ontbreekt. Eenmalig nodig na het overzetten naar de Mac:
# de versies die in de cloud gemaakt zijn, hadden hun tag nooit op GitHub (een cloudsessie mocht geen
# tags pushen). Daarna zet nouvelle-version.sh de tag zelf. Pusht niets.
#
# Gebruik:  bash scripts/etiquettes-versions.sh
set -uo pipefail

cd "$(dirname "$0")/.."
TAB="$(printf '\t')"
nieuw=0
while IFS="$TAB" read -r hash sujet; do
  case "$sujet" in
    "Versie "*": "*) ;;
    *) continue ;;
  esac
  version="${sujet#Versie }"; version="${version%%: *}"
  description="${sujet#*: }"
  echo "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || continue
  etiquette="fox-v$version"
  git rev-parse -q --verify "refs/tags/$etiquette" >/dev/null && continue
  if git tag -a "$etiquette" -m "$description" "$hash"; then
    echo "Version enregistrée : $etiquette ($description)"
    nieuw=$((nieuw + 1))
  fi
done < <(git log -n 300 --format="%H${TAB}%s")

echo "$nieuw étiquette(s) créée(s)."
exit 0
