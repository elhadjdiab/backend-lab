# Lab 1 : la race condition (JavaScript / Node 22)

Durée : 2 à 3 heures. Prérequis : Node.js 22 installé (`node -v`).

Règle du lab : **avant de lancer chaque script, écris ta prédiction** (dans un fichier `notes.md`). Tu comprends vraiment un concept quand tu prédis le résultat avant de l'exécuter.

---

## Partie A : la race condition « logique » (mono-thread)

Fichier : `race-async.mjs`

Un compte a 100 $. On lance trois retraits de 40 $ en même temps.

1. Lis le code. Question : combien de retraits devraient réussir ? Quel solde final est correct ?
   (Réponse à écrire avant de continuer : 2 réussis, 1 refusé, solde de 20.)
2. Prédis ce que le script affichera, puis lance : `node race-async.mjs`
3. Observe : les trois retraits réussissent et le solde est de **60**. De l'argent est apparu.
4. **Explique pourquoi**, dans `notes.md`, avec tes mots. Aide : suis le script ligne par ligne pour le premier retrait, puis pour le deuxième, au moment du `await audit()`.
5. Expérience : supprime la ligne `await audit();` et relance. Que se passe-t-il ? Pourquoi ? (Il n'y a plus de point d'attente entre la lecture et l'écriture : plus de fenêtre pour la course.)

**Idée à retenir :** en JavaScript, il n'y a qu'un fil, mais chaque `await` est un endroit où un autre code peut s'exécuter. Une lecture suivie d'une écriture autour d'un `await` n'est pas sûre.

## Partie B : la correction avec un mutex

Fichier : `race-async-fix.mjs`

1. Lis la classe `Mutex`. Question : comment force-t-elle les appels à passer un par un ?
2. Prédis le résultat, puis lance : `node race-async-fix.mjs`
3. Observe : 2 acceptés, 1 refusé, solde de **20**.
4. Expériences :
   - Augmente le délai de `audit()` à 200 ms. Le résultat change-t-il ? Et le temps d'exécution ?
   - Quel est le coût du mutex ? (Les appels ne se chevauchent plus : on perd du parallélisme.)

## Partie C : la vraie race condition entre threads

Fichier : `race-workers.mjs`

Ici, 4 threads (workers) incrémentent le **même** entier en mémoire partagée, 1 000 000 de fois chacun.

1. Question : quel total devrait-on obtenir ? (4 000 000)
2. Prédis : sera-t-il exact ? Lance : `node race-workers.mjs`
3. Observe : le total est bien inférieur, et **différent à chaque exécution**. Relance 5 fois et note les valeurs.
4. Explique dans `notes.md` les trois étapes cachées derrière `shared[0]++` (lire, ajouter, écrire) et ce qui se passe quand deux threads lisent la même valeur.
5. Corrige : `node race-workers.mjs atomic`. Le total est exact. Compare les durées.
6. Expérience : change `WORKERS` à 1, puis 2, 8. Que remarques-tu sur le nombre d'incréments perdus ?

---

## Questions de contrôle (réponds sans regarder le code)

1. Pourquoi une race condition est-elle possible en JavaScript alors qu'il n'y a qu'un seul thread ?
2. Que fait `Atomics.add` que `shared[0]++` ne fait pas ?
3. Pourquoi le résultat change-t-il d'une exécution à l'autre ? Qu'est-ce que cela dit sur la difficulté de déboguer ce type de bug ?
4. Dans quel cas un mutex est-il un mauvais choix, et que préférer pour un simple compteur ?
5. Cite une situation réelle de ton futur backend où la partie A pourrait arriver (stock d'un produit, solde, place de concert, etc.).

## Livrable

Dans ton dépôt `backend-lab`, crée le dossier `01-concurrence/lab1/` avec les trois scripts et ton `notes.md` contenant :
- tes prédictions et ce qui a réellement eu lieu ;
- l'explication de chaque bug en quelques lignes ;
- les réponses aux questions de contrôle.

Quand tu as fini, envoie-moi tes explications : je te dirai ce qui est juste, ce qui manque, et on passe au lab 2 (le deadlock).