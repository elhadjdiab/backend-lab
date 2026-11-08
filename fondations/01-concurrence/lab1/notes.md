# Lab 1 — Notes : la race condition (JavaScript / Node 22)

> Les résultats de ces notes viennent de mes propres essais, relancés et confirmés.

---

## 0. L'idée générale en trois phrases

- Une **race condition** est un bug où le résultat dépend de **l'ordre et du moment** auquel plusieurs tâches s'exécutent. Le même code peut donner des résultats différents d'un lancement à l'autre.
- Dans ce lab, le bug est toujours le même : une opération en **plusieurs étapes** (lire, calculer, écrire) est **interrompue au milieu**. Les autres tâches travaillent alors avec une valeur qui n'est plus à jour, et leurs écritures s'écrasent. C'est une **mise à jour perdue** (*lost update*).
- Le nom du problème est un manque d'**atomicité** : l'opération aurait dû être indivisible.

**Ce que ce n'est pas : un problème de visibilité.** La visibilité, c'est un thread qui ne voit pas du tout l'écriture d'un autre (elle reste dans son cache). Ici, tout le monde voit la même mémoire : la valeur lue était correcte au moment de la lecture, mais elle est **périmée au moment de l'écriture**. La visibilité fera l'objet d'un autre exercice (la boucle qui ne s'arrête jamais).

---

## 1. Partie A — la race condition « logique » (`race-async.mjs`)

### 1.1 La situation

Un compte contient 100 $. Plusieurs retraits sont lancés **en même temps** avec `Promise.allSettled`. Il n'y a **qu'un seul thread** : ce sont des appels asynchrones (des promesses) qui s'entrelacent à chaque `await`.

### 1.2 Le code, ligne par ligne

```js
async function withdraw(x) {
  const current = balance;                  // 1. je copie le solde dans ma variable locale
  if (current < x) throw new Error('fonds insuffisants');   // 2. je vérifie avec ma copie
  await audit();                            // 3. j'attends (réseau simulé) : les autres s'exécutent ici
  balance = current - x;                    // 4. j'écris avec ma copie, qui peut être périmée
}
```

- `current` est une **copie** du solde. Elle ne se met jamais à jour toute seule.
- Le test à la ligne 2 se fait avec cette copie. Il n'a donc aucun moyen de savoir qu'un autre retrait est en cours.
- `await audit()` est la **fenêtre** : pendant que j'attends, les autres appels démarrent et lisent le même solde.
- À la ligne 4, j'écris `current - x` **par-dessus** ce qui s'y trouve, sans regarder ce que les autres ont fait.

### 1.3 La séquence détaillée (3 retraits de 40 $, solde de 100 $)

```
Retrait 1 : lit 100, test OK (100 ≥ 40), attend
Retrait 2 : lit 100, test OK, attend       ← personne n'a encore écrit
Retrait 3 : lit 100, test OK, attend
Retrait 1 : reprend, écrit 100 − 40 = 60
Retrait 2 : reprend, écrit 100 − 40 = 60   ← écrase, ignore le retrait 1
Retrait 3 : reprend, écrit 100 − 40 = 60
Résultat : 3 retraits acceptés, solde = 60
Attendu  : 2 acceptés, 1 refusé, solde = 20
```

Ce qui est faux : on a accepté 120 $ de retraits sur un compte de 100 $, et le solde n'a baissé que de 40 $. Il n'y a **aucune erreur affichée** : le programme a l'air de bien fonctionner.

### 1.4 Les expériences

| Scénario | Résultat correct | Avec le bug | Explication |
|---|---|---|---|
| 3 retraits de 40 $ | 2 acceptés, 1 refusé, solde 20 | 3 acceptés, solde **60** (observé) | Les trois lisent 100 avant qu'aucun n'écrive. |
| 10 retraits de 10 $ | solde 0 | solde **90** (confirmé) | Les 10 lisent 100, chacun écrit 90 : 9 retraits sont perdus. |
| Retraits de 40 $ (attente 10 ms) et 70 $ (attente 50 ms) | un des deux refusé | solde **30** (observé) | Le retrait de 70 écrit en dernier et écrase le 60. Le retrait de 40 est perdu. |
| Mêmes retraits, durées inversées (40 $ : 50 ms, 70 $ : 10 ms) | un des deux refusé | solde **60** (confirmé) | Cette fois, c'est le retrait de 40 qui écrit en dernier. |
| `await audit()` supprimé | — | bug disparu (confirmé) | Plus de pause entre lecture et écriture : aucun autre appel ne peut s'intercaler. |

**Ce qu'il faut retenir de ces essais :**
- Le **dernier à écrire gagne**, et c'est la **durée de l'attente** qui décide de l'ordre d'écriture.
- Dans un vrai serveur, cette durée vient du réseau ou de la base de données : elle change à chaque requête. Le bug apparaît donc **par intermittence**, ce qui le rend très difficile à reproduire.
- Un solde final qui « a l'air correct » (par exemple 30) peut cacher un bug : les deux retraits ont été acceptés alors qu'un seul aurait dû passer.

### 1.5 Erreurs rencontrées pendant le lab (à ne pas refaire)

- **J'ai commenté la ligne `const sleep = ...`.** Résultat : un `ReferenceError` dans `audit`, avant l'écriture. Le solde est resté à 100 et les appels sont `rejected`. Un solde de 100 avec des rejets signifie que les appels ont **échoué avant d'écrire**.
- **`Promise.allSettled` cache les erreurs** : il note `rejected` sans rien afficher. Il faut toujours afficher `r.reason.message` pour voir pourquoi un appel a échoué.
- **J'ai écrit `await audit()` au lieu de `await audit(ms)`.** La durée n'était pas transmise, donc l'attente durait environ 1 ms et mes mesures étaient fausses. Toujours vérifier qu'un paramètre arrive bien jusqu'à l'endroit où il sert.
- **J'ai d'abord parlé de visibilité et de threads.** Dans la partie A, il n'y a qu'un thread, et le problème est l'atomicité, pas la visibilité.

### 1.6 Lien avec la vie réelle

Le même schéma se retrouve partout où l'on **lit une valeur, décide, puis écrit** avec une attente au milieu (appel à la base de données, appel à une API) :

- **Solde d'un portefeuille ou d'un compte** : deux paiements simultanés qui lisent le même solde.
- **Stock d'un produit en ligne** : deux clients achètent le dernier article en même temps, et le site vend un article qui n'existe plus (**survente**).
- **Billets de concert, places de cinéma ou d'avion** : la même place est vendue à deux personnes.
- **Application d'échange entre particuliers** (comme un échange de devises P2P) : deux utilisateurs acceptent la même offre au même moment, et elle est exécutée deux fois.
- **Compteurs** (likes, vues, quotas d'API) : des incréments sont perdus.

Pourquoi c'est grave : il n'y a ni plantage ni message d'erreur. Les données deviennent fausses **en silence**, et on s'en aperçoit tard, parfois quand de l'argent est déjà parti. Les tests en développement passent, car il y a peu de requêtes simultanées. Le bug apparaît en production, sous charge.

---

## 2. Partie B — la correction avec un mutex (`race-async-fix.mjs`)

### 2.1 Le principe

Il faut **empêcher un retrait de commencer tant que le précédent n'a pas fini, écriture comprise**. Ainsi, chaque retrait lit un solde à jour. L'ensemble « lire, vérifier, attendre, écrire » devient une **section critique** : un seul appel à la fois.

### 2.2 Le mutex, ligne par ligne

```js
class Mutex {
  #tail = Promise.resolve();            // fin du dernier travail demandé (au départ : rien en cours)
  run(fn) {
    const result = this.#tail.then(fn); // fn démarre quand le travail précédent est fini
    this.#tail = result.catch(() => {});// le prochain appelant attendra la fin de CE travail
    return result;                      // l'appelant reçoit le résultat ou l'erreur de son propre travail
  }
}
```

- `#tail` garde la promesse qui représente **la fin du dernier travail demandé**.
- Chaque `run(fn)` se **branche à la suite** (`.then`) de `#tail`, puis devient la nouvelle `#tail`. Les travaux forment une **chaîne**, comme des wagons : un seul s'exécute à la fois, dans l'ordre de demande.
- Ce n'est ni de la récursion ni des threads : c'est un **chaînage de promesses** sur un seul fil.
- `.catch(() => {})` sert à **ne pas casser la chaîne**. L'appelant reçoit toujours son erreur (via `result`), mais `#tail` ne devient jamais une promesse rejetée. Sans cela, `.then(fn)` sauterait `fn` pour tous les travaux suivants : une seule erreur bloquerait toute la file. Confirmé par le test `(40, 150, 40)` : avec le `.catch`, le 3e retrait s'exécute ; sans lui, il est refusé avec l'erreur du 2e (voir 2.4 bis).

### 2.3 Le déroulement avec le mutex (3 retraits de 40 $, attente de 10 ms)

```
t = 0 ms    retrait 1 : lit 100, test OK, attend. Les retraits 2 et 3 sont en file, ils n'ont rien lu.
t = 10 ms   retrait 1 écrit 60.   Retrait 2 démarre : lit 60, test OK, attend.
t = 20 ms   retrait 2 écrit 20.   Retrait 3 démarre : lit 20, test échoué → refusé.
Résultat : accepté, accepté, refusé, solde = 20 ✔
```

Chaque retrait lit **après** l'écriture du précédent : sa copie est toujours à jour. C'est la correction du bug de la partie A.

### 2.4 Le coût du mutex

Les retraits ne se **chevauchent** plus : leurs attentes s'additionnent au lieu de se superposer.

| | Attentes | Temps total mesuré (attentes de 200, 100 et 300 ms) |
|---|---|---|
| Sans mutex | se chevauchent | ≈ 306 ms (la plus longue) |
| Avec mutex | l'une après l'autre | ≈ 610 ms (200 + 100 + 300) |

C'est un **compromis** : résultat correct mais plus lent. Sans mutex, le même test donne en plus un solde faux (90 au lieu de 70 pour trois retraits de 10 $).

Pour réduire ce coût :
- protéger le **moins de code possible** ;
- utiliser **un mutex par compte** : les retraits sur des comptes différents ne s'attendent plus.

### 2.4 bis Résultats mesurés avec `mutex-test.mjs`

| Commande | Résultat obtenu | Ce que ça prouve |
|---|---|---|
| `mutex timing` | 3 `ok`, solde **70**, **610 ms** | Les attentes se suivent (200 + 100 + 300). Chaque retrait lit un solde à jour. |
| `nomutex timing` | 3 `ok`, solde **90**, **306 ms** | Les attentes se chevauchent. Le dernier à écrire écrase les autres : le bug est de retour. |
| `mutex error` | `ok`, `fonds insuffisants`, `ok`, solde **20** | Le retrait de 150 est refusé et la file continue grâce au `.catch`. |
| `nocatch error` | `ok`, `fonds insuffisants`, `fonds insuffisants`, solde **60** | Sans `.catch`, l'erreur du 2e retrait se propage : le 3e n'est jamais exécuté. |
| `nomutex error` | `ok`, `fonds insuffisants`, `ok`, solde **60** | Statuts d'apparence normale, mais le solde devrait être 20 : un bug caché. |

À retenir : le mutex coûte environ le double en temps (610 ms contre 306 ms) pour garantir un résultat correct, et un résultat qui « a l'air normal » (statuts corrects) peut cacher un solde faux.

### 2.5 Les autres façons de corriger

1. **Supprimer l'`await` entre la lecture et l'écriture**, quand c'est possible. Souvent impossible : l'attente est un appel réseau ou une requête à la base.
2. **Rendre l'opération atomique dans la base de données** : une seule requête qui vérifie et modifie en même temps.
   ```sql
   UPDATE accounts SET balance = balance - 40 WHERE id = 1 AND balance >= 40;
   -- 1 ligne modifiée : retrait accepté ; 0 ligne : fonds insuffisants
   ```
   C'est la solution la plus courante en production, et elle marche même avec plusieurs serveurs (module 2).
3. **Verrou optimiste** : une colonne `version` ; la mise à jour échoue si quelqu'un a modifié la ligne entre-temps, et on réessaie.
4. **Une bibliothèque** (par exemple `async-mutex`) plutôt qu'un mutex écrit à la main.
5. **Une file de traitement unique** par compte : un seul worker traite les opérations l'une après l'autre.

### 2.6 Limite importante

Ce mutex vit **dans la mémoire d'un seul processus**. Si l'application tourne sur **plusieurs serveurs**, chacun a son propre mutex : ils ne se voient pas, et le bug revient. En production, il faut donc une protection **partagée** : la base de données (solution 2 ou 3) ou un verrou distribué (module 8).

### 2.7 Pourquoi construire le mutex à la main

C'est un exercice pour **comprendre le mécanisme** (chaînage de promesses, section critique, coût). Dans un vrai projet, on préfère la base de données ou une bibliothèque testée, en sachant pourquoi elles existent.

---

## 3. Partie C — la vraie race condition entre threads (`race-workers.mjs`)

### 3.1 Ce qui change par rapport à la partie A

| | Partie A | Partie C |
|---|---|---|
| Qui s'exécute | Un seul fil, des appels qui s'entrelacent | **Plusieurs threads** qui tournent vraiment **en même temps** sur plusieurs cœurs |
| D'où vient la fenêtre du bug | Le `await` | Aucune pause nécessaire : le parallélisme réel suffit |
| Le bug | Copie périmée, écritures qui s'écrasent | **Exactement le même** |

### 3.2 Les mots nouveaux

- **Worker** : un vrai thread, qui exécute du code en parallèle de l'autre.
- **`SharedArrayBuffer`** : une zone de mémoire que tous les workers voient et modifient. C'est la seule exception à la règle « les workers ne partagent rien ». Dans mon analogie : le **tableau blanc**.
- **`Int32Array`** : une façon de lire cette mémoire comme des nombres entiers. `shared[0]` est le compteur.
- **`isMainThread`** : le fichier est exécuté une fois par le thread principal et une fois par chaque worker. Ce test sépare les deux rôles : le principal crée les workers, attend leur fin et affiche le total ; chaque worker incrémente.

### 3.3 Le bug

```js
for (let i = 0; i < PER_WORKER; i++) shared[0]++;   // 1 000 000 fois, dans chacun des 4 workers
```

`shared[0]++` a l'air d'une instruction, mais ce sont **trois étapes** : lire, ajouter 1, écrire. Deux workers peuvent s'entrecroiser :

```
Worker 1 : lit 5
Worker 2 : lit 5          ← avant que le worker 1 ait écrit
Worker 1 : écrit 6
Worker 2 : écrit 6        ← écrase : un des deux incréments est perdu
```

Deux incréments ont eu lieu, mais le compteur n'a avancé que de 1.

### 3.4 Mes résultats (4 workers, 4 000 000 attendus)

| Lancement | Total obtenu | Incréments perdus | Part perdue |
|---|---|---|---|
| 1 | 1 999 468 | 2 000 532 | ≈ 50 % |
| 2 | 1 294 722 | 2 705 278 | ≈ 68 % |
| 3 | 1 211 213 | 2 788 787 | ≈ 70 % |
| 4 | 2 475 751 | 1 524 249 | ≈ 38 % |
| 5 | 1 306 156 | 2 693 844 | ≈ 67 % |
| **Avec 1 worker** | **1 000 000** | **0** | **0 %** |

### 3.5 Ce que montrent ces résultats

1. **Les pertes sont énormes** : en moyenne, plus de la moitié du travail est annulé. Quatre workers n'ont pas travaillé quatre fois mieux qu'un seul.
2. **Le total change à chaque lancement.** L'ordre dans lequel le système d'exploitation exécute les threads n'est jamais le même, donc le nombre de chevauchements non plus. Même code, même machine, résultats différents : **c'est la signature d'une race condition**.
3. **Avec un seul worker, aucune perte** : pour perdre un incrément, il faut deux threads qui lisent la même valeur. Un seul thread qui écrit n'a personne à écraser.
4. **Plus il y a de workers, plus il y a de pertes**, car la probabilité que deux threads lisent la même valeur augmente avec leur nombre. Confirmé avec 2 et 8 workers.
5. Un bug qui change à chaque exécution n'est pas rare, il dépend simplement du **moment**. Il peut passer inaperçu pendant des tests, puis apparaître en production.

### 3.6 La piste de correction : `Atomics.add` (à tester)

- `Atomics.add(shared, 0, 1)` fait « lire, ajouter, écrire » en **une seule opération indivisible**, garantie par le processeur. Aucun autre thread ne peut s'intercaler.
- Attendu : `node race-workers.mjs atomic` donne exactement 4 000 000, à chaque lancement. Confirmé.
- Elle convient à **une seule variable**. Si une règle touche plusieurs valeurs en même temps (par exemple débiter un compte et en créditer un autre), il faut un **verrou**.
- Question à explorer : la version atomique est-elle plus lente ? Les durées des deux modes sont affichées par le script ; je les compare sur ma machine.

### 3.7 Lien avec la vie réelle

- **Compteurs de visites, de likes, de ventes** mis à jour par plusieurs threads ou processus d'un même serveur : des événements sont perdus et les statistiques sont fausses.
- **Métriques et surveillance** : un compteur de requêtes ou d'erreurs non protégé sous-estime la réalité, précisément quand la charge est forte, c'est-à-dire quand on en a le plus besoin.
- **Caches et structures partagées** entre threads (en Java, C#, Go, C++) : sans protection, elles peuvent être corrompues, et pas seulement fausses.
- **Compteurs partagés entre plusieurs serveurs** : on utilise des opérations atomiques fournies par un service central, par exemple `INCR` dans Redis (module 2), ou `UPDATE ... SET compteur = compteur + 1` dans la base.
- En production, ce genre de bug est parmi les plus coûteux : difficile à reproduire, il ne laisse pas de trace claire dans les journaux.

---

## 4. Synthèse des trois parties

| | Partie A | Partie B | Partie C |
|---|---|---|---|
| Rôle | Reproduire le bug (un seul fil, `await`) | Corriger avec un mutex | Reproduire le bug (vrais threads) |
| Cause du bug | Copie périmée + écritures qui s'écrasent | — | Même cause |
| Solution étudiée | — | Chaînage de promesses (section critique) | `Atomics.add` (opération indivisible) |
| Coût | — | Temps total plus long (pas de chevauchement) | À mesurer |
| Limite | — | Un seul processus | Une seule variable |

**Le fil rouge :** dès que plusieurs tâches peuvent toucher à la même donnée avec une étape « lire puis écrire » au milieu, il faut rendre l'opération **indivisible** (atomique, verrou ou base de données), sinon des mises à jour se perdent en silence.

---

## 5. Vocabulaire

- **Race condition** : résultat qui dépend de l'ordre et du moment d'exécution de plusieurs tâches.
- **Atomicité** : une opération est indivisible, personne ne peut s'intercaler au milieu.
- **Entrelacement** : l'exécution de plusieurs tâches qui se mélangent dans le temps.
- **Mise à jour perdue (lost update)** : une écriture écrase une autre, qui disparaît.
- **Section critique** : portion de code qui ne doit être exécutée que par une tâche à la fois.
- **Mutex** : mécanisme qui garantit l'accès à une section critique à un seul à la fois.
- **Visibilité** : savoir si un thread voit l'écriture d'un autre (problème différent de celui-ci).
- **Thread / worker** : un fil d'exécution qui tourne en parallèle des autres.
- **Concurrence / parallélisme** : plusieurs tâches en cours de progression (éventuellement sur un seul fil) / plusieurs tâches réellement exécutées en même temps.

---

## 6. Questions de contrôle

1. **Pourquoi une race condition est-elle possible en JavaScript alors qu'il n'y a qu'un seul thread ?**
   Parce que chaque `await` laisse s'exécuter un autre appel. Une lecture suivie d'une écriture autour d'un `await` n'est pas indivisible.
2. **Pourquoi le résultat change-t-il d'un lancement à l'autre ?**
   L'ordre d'exécution (durées d'attente, ordonnancement des threads) change, donc le nombre de chevauchements aussi.
3. **Pourquoi aucune perte avec un seul worker ?**
   Il faut deux tâches qui lisent la même valeur pour perdre une écriture.
4. **Pourquoi le mutex rend-il le programme plus lent ?**
   Les attentes ne se chevauchent plus, elles s'additionnent.
5. **Pourquoi un mutex en mémoire ne suffit-il pas avec plusieurs serveurs ?**
   Chaque serveur a son propre mutex et ils ne se voient pas. Il faut une protection partagée (la base de données, un verrou distribué).
6. **Dans quel cas utiliser `Atomics.add` plutôt qu'un mutex ?**
   Pour une seule variable (un compteur). Pour un invariant sur plusieurs valeurs, il faut un verrou.
7. **Un exemple réel où la partie A peut arriver ?**
   Le dernier article en stock vendu à deux clients ; la même place de concert vendue deux fois ; une offre d'échange acceptée deux fois.

---

