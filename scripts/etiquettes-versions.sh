#!/usr/bin/env bash
# Zet voor elke versiecommit ("Versie <JJJJ.W.N>: <omschrijving>", zie scripts/nouvelle-version.sh)
# de tag `fox-v<versie>` als die nog ontbreekt, en stuurt de fox-v-tags naar GitHub.
#
# Waarom apart: een agentsessie in de cloud mag alleen zijn werkbranch pushen, geen tags. De
# versiecommits komen dus wel op GitHub, de tags maakt de Mac van de eigenaar (de lanceerder roept
# dit script aan). Lokaal werkt terughalen ook als het pushen van de tags mislukt.
#
# Gebruik:  bash scripts/etiquettes-versions.sh   (stil; meldt alleen nieuwe tags)
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

etiquettes="$(git tag -l 'fox-v*')"
if [ -n "$etiquettes" ]; then
  # shellcheck disable=SC2086
  git push -q origin $(printf '%s\n' $etiquettes | sed 's|^|refs/tags/|') 2>/dev/null \
    || { [ "$nieuw" -gt 0 ] && echo "(Étiquettes gardées sur ce Mac ; envoi vers GitHub impossible pour l'instant.)"; }
fi
exit 0
