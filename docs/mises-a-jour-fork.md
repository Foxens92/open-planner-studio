# Mises à jour de cette version (fork Foxens92)

L'application installée cherche ses mises à jour sur ce dépôt, et non plus sur celui d'OpenAEC :
`https://github.com/Foxens92/open-planner-studio/releases/latest/download/latest.json`
(`src-tauri/tauri.conf.json`, et `src/services/githubRepo.ts` pour les liens vers les versions et
les retours). Une mise à jour n'est installée que si elle est signée avec la clé dont la partie
publique est inscrite dans `tauri.conf.json`.

## Une seule fois : créer ta clé

Sur le Mac, dans le dossier du projet :

```bash
npm ci
bash scripts/mac-update-key.sh
git add src-tauri/tauri.conf.json && git commit -m "Updater: eigen sleutel" && git push
```

Le script crée `~/.tauri/open-planner-studio.key` (clé privée, protégée par un mot de passe) et
`~/.tauri/open-planner-studio.key.pub`, puis inscrit la clé publique dans `tauri.conf.json`.

**Sauvegarde la clé privée et son mot de passe.** Si tu les perds, aucune application déjà installée
n'acceptera plus tes mises à jour : il faudra la réinstaller à la main. Ne les mets jamais dans le
dépôt.

## À chaque nouvelle version

```bash
npm run bump                      # nouveau numéro de version, plus élevé que l'actuel
git commit -am "Versie ophogen" && git push
bash scripts/publish-mac-update.sh "Ce qui change dans cette version"
```

Prérequis : outils Xcode, Node 22, Rust (`rustup`) et GitHub CLI connecté (`brew install gh`,
puis `gh auth login`). Le script compile une app universelle (Apple Silicon et Intel), signe le
paquet de mise à jour, crée `latest.json` et publie la version `mac-v<version>` sur GitHub. Il
refuse de publier si la clé ou l'adresse ne correspondent pas, si des modifications ne sont pas
commitées ou si le commit n'est pas sur GitHub.

Les applications installées avec une version plus ancienne et la même clé proposent la mise à jour
au démarrage.

## Limites

- Seul macOS est publié. Windows et Linux ne reçoivent pas de mises à jour par ce chemin.
- L'application n'est pas signée par Apple (pas de compte développeur) : la première installation
  demande un clic droit puis « Ouvrir ». Les mises à jour suivantes passent par l'application.
- La chaîne officielle (`.github/workflows/release.yml`) n'est pas utilisée : elle démarre sur les
  étiquettes `v*`, d'où le préfixe `mac-v`. Le workflow `release-verify.yml` se déclenche à chaque
  publication et échouera, car il attend toutes les plateformes ; tu peux le désactiver dans l'onglet
  Actions du dépôt.
- Les versions publiées par OpenAEC ne sont plus proposées. Pour intégrer leurs nouveautés, il faut
  les fusionner dans ce dépôt puis publier ta propre version.

## Tester dans le navigateur : le lanceur du bureau

Une fois, dans le Terminal, depuis le dossier du projet :

```bash
git pull
cp "scripts/mac/Open Planner Studio.command" ~/Desktop/
```

Ensuite, un double-clic sur **Open Planner Studio** (bureau) récupère les dernières modifications,
démarre l'application et l'ouvre dans le navigateur. Laisse la fenêtre du Terminal ouverte pendant
le test ; la fermer arrête l'application. Si l'application tourne déjà, le double-clic ouvre
simplement le navigateur. La première fois, le lanceur peut demander où se trouve le dossier du
projet ; il s'en souvient ensuite (`~/.open-planner-studio-dossier`).

## Une version par modification

Chaque modification est enregistrée comme une nouvelle version (`2026.45.1`, `2026.45.2`…) : un
commit « Versie <version> : description » et une étiquette `fox-v<version>`
(`scripts/nouvelle-version.sh`). Les modifications faites par Claude dans le cloud ne peuvent pas
envoyer d'étiquette sur GitHub : le lanceur du bureau les crée sur ton Mac à partir des commits
« Versie … » et les envoie (`scripts/etiquettes-versions.sh`). Lance donc le lanceur une fois avant
de chercher une version. Pour revenir en arrière :

```bash
git fetch --tags
git tag -l "fox-v*"                      # liste des versions
git checkout fox-v2026.45.1              # se placer sur une version pour la tester
git checkout claude/loving-brahmagupta-h0v95j   # revenir à la dernière version
```

Sur une ancienne version, le lanceur ne fait pas de mise à jour automatique : il lance exactement
cette version. Pour annuler définitivement une modification, demande-le : elle sera défaite dans une
nouvelle version, sans réécrire l'historique.
