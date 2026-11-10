# Travailler en local sur le Mac

Depuis le 10/11/2026, ce projet vit uniquement sur ton Mac : pas de GitHub, pas de mise à jour en
ligne. Claude modifie le dossier du projet directement, chaque modification devient une version
(`fox-v<version>`), et un double-clic recompile l'application installée dans Applications.

## 1. Préparer le Mac (une seule fois)

Dans le Terminal :

```bash
xcode-select --install                                    # outils de compilation Apple
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh    # Rust (réponds 1, installation par défaut)
```

Node.js 22 : télécharge et installe le paquet « LTS » sur https://nodejs.org (ou `brew install node@22`
si tu utilises Homebrew).

Ferme puis rouvre le Terminal, et vérifie : `node -v` (v22…) et `cargo -V` répondent.

Installe aussi l'application Claude pour Mac (claude.ai/download) : c'est par elle, côté Code, que
Claude travaillera dans le dossier du projet. Claude Code en ligne de commande (`claude`, lancé depuis
le dossier) fonctionne aussi.

## 2. Récupérer le code (dernière utilisation de GitHub)

```bash
mkdir -p ~/Documents/Développement
cd ~/Documents/Développement
git clone --branch claude/loving-brahmagupta-h0v95j https://github.com/Foxens92/open-planner-studio.git "EX Planner"
cd "EX Planner"
git branch -m main                 # la branche de travail s'appelle désormais main
git remote remove origin           # coupe le lien avec GitHub
bash scripts/etiquettes-versions.sh   # recrée les étiquettes des versions déjà faites
```

Le projet est maintenant dans **Documents › Développement › EX Planner**
(`~/Documents/Développement/EX Planner`), avec tout son historique.

## 3. Mettre les deux raccourcis sur le bureau

```bash
cp "scripts/mac/Mettre à jour Open Planner Studio.command" ~/Desktop/
cp "scripts/mac/Tester dans le navigateur.command" ~/Desktop/
```

- **Mettre à jour Open Planner Studio** : compile l'application à partir du dossier et la remplace
  dans Applications, puis l'ouvre. La première fois prend 10 à 20 minutes (compilation Rust), les
  suivantes quelques minutes. Si l'application est ouverte, elle est d'abord fermée proprement (elle
  te demande d'enregistrer si besoin).
- **Tester dans le navigateur** : lance le dossier tel qu'il est dans le navigateur, sans compiler.
  Utile pour un essai rapide ; garde la fenêtre du Terminal ouverte pendant le test.

Les raccourcis cherchent le projet dans Documents › Développement › EX Planner. S'il est ailleurs, ils
demandent le dossier la première fois et s'en souviennent ensuite.

## 4. Première installation

Double-clic sur **Mettre à jour Open Planner Studio**. À la fin, l'application est dans Applications :
fais-la glisser dans le Dock si tu veux. Elle se lance ensuite comme n'importe quelle application.
Tes plannings sont des fichiers `.ifc` que tu enregistres où tu veux ; ils ne sont jamais touchés par
une mise à jour.

Comme l'application est compilée sur ton propre Mac, macOS ne devrait pas la bloquer. S'il le fait :
clic droit sur l'application, puis « Ouvrir ».

## 5. Faire une modification

1. Ouvre Claude, côté Code, sur le dossier **Documents › Développement › EX Planner**.
2. Décris la modification. Claude la fait, la vérifie et l'enregistre comme nouvelle version.
3. Double-clic sur **Mettre à jour Open Planner Studio** : l'application installée passe à la nouvelle
   version.

## 6. Revenir à une version précédente

```bash
cd ~/Documents/Développement/"EX Planner"
git tag -l "fox-v*"            # liste des versions
git checkout fox-v2026.45.1    # se placer sur une version
```

Puis **Mettre à jour Open Planner Studio** pour installer cette version. Pour revenir à la dernière :
`git checkout main`, puis de nouveau **Mettre à jour**. Pour annuler définitivement une modification,
demande-le à Claude : elle sera défaite dans une nouvelle version, sans effacer l'historique.

## 7. Sauvegarde

Il n'y a plus de copie sur GitHub : le dossier **EX Planner** (historique compris, dans son
sous-dossier caché `.git`) est la seule source. Active Time Machine, ou copie régulièrement ce dossier
sur un disque externe.

## 8. Le dépôt GitHub

Une fois que l'application fonctionne sur ton Mac, le dépôt `Foxens92/open-planner-studio` ne sert
plus. Tu peux l'archiver ou le supprimer depuis GitHub (Settings du dépôt, tout en bas).
