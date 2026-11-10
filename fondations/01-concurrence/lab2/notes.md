# Lab 2 — Notes : le deadlock (JavaScript / Node 22)


## 0. L'idée générale

- Un **deadlock** (interblocage) arrive quand plusieurs tâches s'attendent **en cercle** : chacune détient une ressource dont une autre a besoin, et aucune ne peut avancer.
- Le programme **ne plante pas** et **n'affiche aucune erreur** : il se fige.
- Analogie : deux voitures face à face sur un pont étroit. Chacune attend que l'autre recule.
- Le lien avec le lab 1 : le mutex était la **solution** à la race condition. Mal utilisé (plusieurs verrous pris dans des ordres différents), il crée un **nouveau** problème : le deadlock. Une solution à un problème de concurrence peut en introduire un autre.

---

## 1. Les quatre conditions de Coffman

Edward Coffman a décrit en 1971 les quatre conditions qui doivent être réunies **en même temps** pour qu'un deadlock existe. Si on en supprime **une seule**, il devient impossible.

| Condition | Définition | Dans le lab |
|---|---|---|
| **Exclusion mutuelle** | Une ressource n'est utilisable que par une tâche à la fois | Le mutex d'un compte |
| **Détention et attente** | Une tâche garde ce qu'elle a déjà en demandant autre chose | T1 garde A et demande B |
| **Pas de préemption** | On ne peut pas retirer de force une ressource à son détenteur | Personne ne reprend A à T1 |
| **Attente circulaire** | Un cycle de tâches s'attendent | T1 attend T2, qui attend T1 |

---

## 2. Partie A — le deadlock avec des promesses (`deadlock-async.mjs`)

### 2.1 La situation

Deux comptes, A et B, chacun protégé par un mutex. Un transfert verrouille le compte **source**, puis le compte **destination**. Deux transferts sont lancés en même temps, **en sens contraire** : T1 (A → B, 10 $) et T2 (B → A, 20 $). Il n'y a qu'un seul thread : ce sont des appels asynchrones qui s'entrelacent.

### 2.2 Ma prédiction et le résultat

- **Prédiction** : les deux transferts ne finissent pas, les soldes restent à 100 et 100.
- **Résultat obtenu** :
  ```
  T1 : demande le verrou de A
  T2 : demande le verrou de B
  T1 : a le verrou de A
  T2 : a le verrou de B
  T1 : demande le verrou de B      ← bloqué : B est détenu par T2
  T2 : demande le verrou de A      ← bloqué : A est détenu par T1

  DEADLOCK : aucun transfert n'a terminé après 1 seconde.
  A = 100, B = 100 (rien n'a bougé)
  ```

### 2.3 Le schéma d'attente circulaire

```
T1 détient A  ──attend──▶  B  ◀──détenu par──  T2
T2 détient B  ──attend──▶  A  ◀──détenu par──  T1
```

Il y a un cycle : T1 → T2 → T1. Chaque tâche détient une ressource et en demande une autre qui est détenue par l'autre.

| Moment | T1 | T2 |
|---|---|---|
| 1 | prend A | prend B |
| 2 | demande B (occupé, attend) | demande A (occupé, attend) |
| Après | attend T2 pour toujours | attend T1 pour toujours |

### 2.4 Les expériences

| Modification | Résultat | Explication |
|---|---|---|
| T2 dans le **même sens** que T1 (`transfer('T2', A, B, 20)`) | Les deux terminent : A = 70, B = 130 | Les deux tâches demandent A en premier. T2 attend que T1 ait **fini** (A et B), puis passe. Il n'y a pas de cycle. |
| Suppression de `await sleep(10)` | Le deadlock persiste | La pause rendait le scénario plus réaliste, mais n'est pas la cause. Dès que T1 et T2 prennent chacun leur premier verrou avant de demander le second, le cycle existe. |
| Un seul transfert | Il termine normalement | Il n'y a personne d'autre pour détenir le second verrou. |
| Transferts **l'un après l'autre** (au lieu de `Promise.all`) | Les deux terminent : A = 110, B = 90 | T1 libère tout avant que T2 commence : les deux ne se chevauchent jamais. |

**Ce que ça montre :** le deadlock demande **un chevauchement dans le temps** et **un ordre opposé** de prise des verrous. Tant qu'une de ces deux choses manque, tout se passe bien.

### 2.5 Sans chien de garde

Dans le script, un chien de garde affiche `DEADLOCK` après 1 seconde. Sans lui, Node s'arrête de lui-même avec le code de sortie 13 et l'avertissement `Detected unsettled top-level await` : il n'y a plus rien à exécuter, mais il ne dit pas pourquoi. En production, avec un serveur qui reste actif, le processus **resterait figé** et aucun message n'apparaîtrait.

---

## 3. Partie B — le deadlock entre vrais threads (`deadlock-workers.mjs`)

### 3.1 La situation

Deux workers (de vrais threads) se partagent deux verrous en mémoire partagée. Le worker 1 prend A puis B ; le worker 2 prend B puis A. Un chien de garde dans le thread principal observe l'état au bout de 1,5 seconde.

### 3.2 Le résultat

```
DEADLOCK détecté après 1,5 s :
  verrou A détenu par : worker 1
  verrou B détenu par : worker 2
  worker 1 attend : verrou B
  worker 2 attend : verrou A
```
C'est le même cycle que dans la partie A, avec les mêmes quatre conditions.

### 3.3 Les réponses aux questions

- **À quoi sert la pause de 100 ms ?** Elle laisse le temps à l'autre worker de prendre **son** premier verrou avant que le premier demande le second. Sans elle, un worker pourrait prendre les deux verrous avant que l'autre démarre, et le deadlock n'arriverait que par hasard (une race condition sur le deadlock lui-même). La pause rend le bug **reproductible**.
- **Que ferait le programme sans chien de garde ?** Il resterait figé indéfiniment : les deux workers dorment dans `Atomics.wait` et personne ne les réveille.

### 3.4 Différences entre les parties A et B

| | Partie A | Partie B |
|---|---|---|
| Qui est bloqué | Des promesses en attente (le thread continue) | De vrais **threads** endormis |
| Ce qui arrive sans chien de garde | Node quitte avec le code 13 | Le programme reste figé |
| Le cycle | T1 ↔ T2 | worker 1 ↔ worker 2, **identique** |

### 3.5 Les outils de la partie B

- **`isMainThread`** : le même fichier est exécuté une fois par le thread principal et une fois par chaque worker. Ce test donne à chacun son rôle : le principal crée les workers et surveille ; les workers font le travail. Sans lui, chaque worker créerait à son tour des workers, sans fin.
- **`workerData`** : les données que le principal passe à un worker à sa création (la mémoire partagée, son numéro, le mode).
- **`Atomics.store(tab, i, v)`** : écrit `v` dans la mémoire partagée, de façon sûre pour tous les threads.
- **`Atomics.load(tab, i)`** : lit la valeur de façon sûre et à jour.
- **`Atomics.wait(tab, i, v, ms)`** : endort le thread **si** `tab[i]` vaut encore `v`. Retourne `"not-equal"`, `"timed-out"` ou `"ok"`. Contrairement à `await`, il **bloque tout le thread**.
- **`Atomics.notify(tab, i, n)`** : réveille jusqu'à `n` threads endormis sur cette case.
- **`Atomics.compareExchange(tab, i, attendu, nouveau)`** : si `tab[i]` vaut `attendu`, écrit `nouveau`. Retourne **toujours l'ancienne valeur**. Le verrou l'utilise ainsi : `=== 0` signifie « il était libre, je l'ai pris ».
- **`for (;;)`** : une boucle infinie (équivalente à `while (true)`). On en sort avec `break`, ici quand le verrou est obtenu.

**Pourquoi `wait` reçoit-il le propriétaire courant ?** Si le verrou est libéré entre ma lecture et mon `wait`, la valeur a changé : `wait` retourne `"not-equal"` tout de suite et je réessaie. Sans cette vérification, je pourrais m'endormir après le signal de réveil et dormir pour toujours.

---

## 4. Partie C — comprendre : les six questions

**1. Pourquoi un deadlock ne produit-il aucun message d'erreur ?**
Parce que rien n'a échoué : aucune exception n'est levée. Les tâches sont simplement **en attente**, et attendre est un état normal pour un programme. Un deadlock ne se voit que par l'absence de progrès. Pour le détecter, il faut un chien de garde, un timeout ou un outil qui affiche l'état des threads (dump de threads).

**2. Pourquoi ce code peut-il passer tous les tests en développement, puis se figer en production ?**
Il faut un **chevauchement** de deux opérations en **sens opposé** sur les mêmes ressources. En développement, il y a peu de requêtes simultanées, donc ce moment n'arrive presque jamais. Sous forte charge, il devient probable. Le bug dépend du timing, comme la race condition du lab 1.

**3. Pourquoi deux transferts dans le même sens ne se bloquent-ils pas ?**
Les deux demandent A en premier. T2 attend T1, mais T1 n'attend jamais T2 : il n'y a pas de cycle. **La condition qui manque est l'attente circulaire.**

**4. Dans quel cas T1 et T2 ne se bloquent-ils pas, même en sens contraire ?**
Quand les deux ne se chevauchent pas : T1 termine et libère ses verrous avant que T2 commence. Chaque tâche prend alors ses verrous sans que l'autre en détienne. **La condition qui manque est l'attente circulaire** : il n'y a jamais deux tâches qui attendent l'une l'autre en même temps. (Elle manquerait aussi si on prenait les deux verrous en une seule opération, tout ou rien.)

**5. En quoi un deadlock est-il différent d'une race condition ?**

| | Race condition (lab 1) | Deadlock (lab 2) |
|---|---|---|
| Symptôme | Résultats **faux**, en silence | Le programme **s'arrête de progresser** |
| Le programme continue-t-il ? | Oui | Non |
| Visibilité | Cachée : tout semble normal | Visible : ça se fige |
| Détection | Difficile (il faut vérifier les données) | Plus facile (le symptôme est évident, un dump de threads montre qui attend quoi) |

Les deux dépendent du timing, donc se reproduisent mal. La race condition est la plus dangereuse, car on peut ne jamais la voir.

**6. Combien de verrous et de tâches faut-il au minimum ?**
Le cas classique : **2 tâches et 2 verrous**. Un cas particulier : une tâche qui demande **deux fois** un mutex non réentrant qu'elle détient déjà se bloque elle-même (1 tâche, 1 verrou).

---

## 5. Partie D — les solutions (`deadlock-async-fix.mjs`)

### 5.1 L'ordre global des verrous
`node deadlock-async-fix.mjs order`

- Tous les transferts verrouillent d'abord le compte avec le **plus petit identifiant**, quelle que soit la direction.
- T1 (A → B) prend A puis B ; T2 (B → A) prend **aussi** A puis B. T2 attend donc T1, comme dans le cas « même sens » de la partie A.
- **Condition supprimée : l'attente circulaire.**
- Résultat attendu : `A = 110, B = 90`, en une vingtaine de millisecondes.

### 5.2 Le timeout et le nouvel essai
`node deadlock-async-fix.mjs timeout`

- Si on n'obtient pas le deuxième verrou en 50 ms, on **libère le premier** et on réessaie après une pause **aléatoire**.
- **Condition supprimée : la détention et l'attente** (la tâche ne garde plus ce qu'elle a quand elle ne peut pas obtenir la suite).
- Résultat attendu : un message `timeout à l'essai 1`, puis la fin au 2e essai. Le total est plus long que la solution précédente (de l'ordre de 100 ms).
- **La pause est aléatoire** pour que les deux tâches ne réessaient pas exactement au même moment, ce qui recréerait le même blocage en boucle. Ce cas s'appelle un **livelock** : les tâches bougent sans progresser.

### 5.3 La même correction avec des workers
`node deadlock-workers.mjs order`

Les deux workers prennent A puis B. Le programme se termine (environ 300 ms). Même principe que 5.1.

### 5.4 Tableau comparatif

| | Ordre global | Timeout + réessai |
|---|---|---|
| **Condition supprimée** | Attente circulaire | Détention et attente |
| **Peut-il rester un blocage ?** | Non, si la règle est respectée **partout**. Une seule exception dans le code peut recréer un cycle. | Pas de blocage définitif, mais un **livelock** est possible sans pause aléatoire |
| **Coût en temps** | Presque nul (une comparaison) | Du temps perdu à attendre le timeout, puis à réessayer |
| **Difficulté de mise en place** | Facile, mais exige de la **discipline** dans toute la base de code | Plus lourde : gestion des erreurs, nombre d'essais, pauses |
| **Quand l'utiliser** | Quand on connaît à l'avance les ressources à verrouiller (comptes, lignes d'une table) | Quand l'ordre ne peut pas être connu à l'avance, ou que les verrous viennent de systèmes extérieurs |

**Ma préférence en pratique :** l'ordre global, parce qu'il **prévient** le problème au lieu de le réparer après coup. Le timeout sert de filet de sécurité.

### 5.5 Les autres moyens d'éviter le problème

- **Éviter de prendre plusieurs verrous.** Si une opération n'en demande qu'un, il n'y a pas de cycle possible.
- **Tout prendre d'un coup** (tout ou rien) : on demande les deux verrous en une seule opération.
- **Laisser la base de données le faire** : une seule requête SQL qui modifie les deux soldes dans une transaction.
- **Une file par ressource** : un seul worker traite les opérations d'un compte, l'une après l'autre.

---

## 6. Dans la vraie vie

- **Virements croisés** : deux virements A → B et B → A au même moment, avec un verrou par compte.
- **Bases de données** : deux transactions qui modifient les mêmes lignes dans un ordre opposé. PostgreSQL détecte le cycle et **annule l'une des deux** avec l'erreur `deadlock detected` (code `40P01`). Mon code doit alors **réessayer** la transaction. La prévention est la même que dans le lab : modifier les lignes toujours dans le même ordre (par exemple par identifiant croissant). À revoir au module 2.
- **Appels entre services** : le service A appelle B de façon synchrone pendant que B appelle A, avec des pools de threads ou de connexions limités. Tous les threads attendent une réponse qui ne viendra jamais.
- **Files bornées** : deux composants qui s'envoient des messages dans des files pleines, chacun attendant de la place dans la file de l'autre.

### Ce qu'on fait vraiment, comparé au lab

Dans un vrai projet, on **évite** d'écrire ce genre de verrou à la main :
1. Éviter l'état partagé.
2. Passer des messages plutôt que partager de la mémoire.
3. Laisser un système qui le gère (requête SQL atomique, transaction, `INCR` dans Redis, file de messages).
4. Utiliser une bibliothèque éprouvée.
5. Écrire son propre verrou : dernier recours.

Les labs servent à **reconnaître** les symptômes et à comprendre ce que font les outils de haut niveau. Ces problèmes existent encore à leur niveau (les deadlocks en base de données, par exemple), et c'est à moi de les prévenir et de réessayer.

---
