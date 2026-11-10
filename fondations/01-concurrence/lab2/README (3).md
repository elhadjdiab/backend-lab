# Lab 2 : le deadlock (JavaScript / Node 22)

Durée : 2 à 3 heures. Prérequis : le lab 1 (race conditions et mutex).

**Règles du lab**
1. **Avant de lancer chaque script, écrire la prédiction** dans `notes.md`.
2. **Le problème avant la solution** : les parties A, B et C servent à observer et comprendre le deadlock. Ne lance les scripts de correction (partie D) qu'après avoir fini la partie C.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `mutex.mjs` | Un mutex asynchrone (utilisé par les autres scripts). À lire, ne pas modifier. |
| `deadlock-async.mjs` | **Parties A et C** : le deadlock avec des promesses |
| `deadlock-workers.mjs` | **Partie B** : le deadlock entre vrais threads |
| `deadlock-async-fix.mjs` | **Partie D** : les corrections (à ouvrir en dernier) |

## Le problème en une phrase

Un **deadlock** (interblocage) arrive quand plusieurs tâches s'attendent **en cercle** : chacune détient une ressource dont une autre a besoin, et aucune ne peut avancer. Le programme ne plante pas, ne lève aucune erreur : il **se fige**.

Analogie : deux voitures sur un pont étroit, face à face. Chacune attend que l'autre recule. Personne ne bouge, pour toujours.

---

## Partie A : observer un deadlock (`deadlock-async.mjs`)

Deux comptes, A et B, chacun protégé par un mutex. Un transfert verrouille d'abord le compte source, puis le compte destination, pour être sûr qu'aucun autre transfert ne modifie les soldes pendant l'opération. Deux transferts sont lancés **en même temps, en sens contraire** : T1 (A → B, 10 $) et T2 (B → A, 20 $).

1. Lis `transfer`. Pour chaque ligne, repère ce que la tâche **détient** et ce qu'elle **demande**.
2. **Prédis** : les deux transferts vont-ils finir ? Quels seront les soldes ? Écris ta réponse.
3. Lance : `node deadlock-async.mjs`
4. Observe l'ordre des messages. Tu dois voir que T1 et T2 obtiennent chacun leur premier verrou, puis demandent le verrou de l'autre, et que plus rien ne se passe.
5. Dessine dans `notes.md` un tableau ou un schéma : qui détient quoi, qui attend quoi.

```
T1 détient A  ──attend──▶  B  ◀──détenu par──  T2
T2 détient B  ──attend──▶  A  ◀──détenu par──  T1
```

**Expériences** (une seule modification à la fois, et prédis avant de lancer)
1. Remplace le transfert T2 par `transfer('T2', A, B, 20)` (même sens que T1). Le deadlock disparaît-il ? Pourquoi ?
2. Remets le sens contraire et supprime la ligne `await sleep(10);`. Le deadlock disparaît-il ? Pourquoi ou pourquoi pas ?
3. Lance un seul transfert (commente l'autre). Que se passe-t-il ?
4. Exécute les deux transferts **l'un après l'autre** (`await transfer(...)` puis `await transfer(...)`) au lieu de `Promise.all`. Que se passe-t-il ?

À noter : dans ce script, un chien de garde affiche `DEADLOCK` après 1 seconde. Sans lui, Node s'arrêterait de lui-même (plus rien à exécuter) avec un avertissement sur une attente non terminée, mais sans te dire pourquoi.

---

## Partie B : le deadlock entre vrais threads (`deadlock-workers.mjs`)

Ici, deux workers (de vrais threads) se partagent deux verrous en mémoire partagée. Le worker 1 prend A puis B, le worker 2 prend B puis A. Un chien de garde, dans le thread principal, regarde l'état au bout de 1,5 seconde.

1. Lis le fichier. Repère `lock`, `unlock` et la pause de 100 ms. À quoi sert cette pause ?
2. **Prédis** ce que le programme va afficher.
3. Lance : `node deadlock-workers.mjs`
4. Lis le rapport : qui détient chaque verrou, et qui attend quoi ? Compare avec ton schéma de la partie A.
5. Question : si le chien de garde n'existait pas, que ferait le programme ?

**Différence avec la partie A :** ici, deux threads sont réellement bloqués dans `Atomics.wait` et ne se réveilleront jamais. Le processus ne se termine pas tout seul : il consomme une ressource et reste figé.

---

## Partie C : comprendre (avant les solutions)

Un deadlock exige **les quatre conditions de Coffman**, toutes en même temps :

| Condition | Dans le lab |
|---|---|
| **Exclusion mutuelle** : une ressource n'est utilisable que par une tâche à la fois | Le mutex d'un compte |
| **Détention et attente** : on garde ce qu'on a en demandant autre chose | T1 garde A et demande B |
| **Pas de préemption** : on ne peut pas retirer de force une ressource à son détenteur | Personne ne reprend A à T1 |
| **Attente circulaire** : un cycle de tâches s'attendent | T1 attend T2, qui attend T1 |

Il suffit d'en **supprimer une** pour empêcher le deadlock.

**Questions (réponds dans `notes.md`, de mémoire)**
1. Pourquoi un deadlock ne produit-il aucun message d'erreur ?
2. Pourquoi est-il possible que ce code passe tous les tests en développement, puis se fige en production ?
3. Pourquoi deux transferts **dans le même sens** ne se bloquent-ils pas ? Quelle condition de Coffman manque ?
4. Dans quel cas T1 et T2 ne se bloquent-ils pas, même en sens contraire ? Quelle condition manque alors ?
5. En quoi un deadlock est-il différent d'une race condition (lab 1) ? Lequel est le plus facile à détecter, et pourquoi ?
6. Combien de verrous faut-il au minimum pour créer un deadlock ? Combien de tâches ?

**Ne passe à la partie D que quand tu as répondu à ces questions.**

---

## Partie D : les solutions (`deadlock-async-fix.mjs`)

Lance chaque mode, **après avoir prédit** le résultat et la condition de Coffman qu'il supprime.

### Solution 1 : l'ordre global des verrous
`node deadlock-async-fix.mjs order`

Tous les transferts verrouillent d'abord le compte avec le plus petit identifiant, quelle que soit la direction.
- Lis `transferOrdered`. Pourquoi T1 et T2 prennent-ils maintenant les verrous dans le même ordre ?
- Quelle condition de Coffman est supprimée ?
- Résultat attendu : `A = 110, B = 90`.

### Solution 2 : le timeout et le nouvel essai
`node deadlock-async-fix.mjs timeout`

Si on n'obtient pas le deuxième verrou en 50 ms, on **libère le premier** et on réessaie après une pause aléatoire.
- Lis `transferTimeout` et le message `timeout à l'essai 1`.
- Quelle condition est supprimée ? (Indice : que fait la tâche du verrou qu'elle détient ?)
- Lance-le 5 fois : le nombre d'essais est-il toujours le même ? Pourquoi la pause est-elle aléatoire ?
- Quel est le risque si les deux tâches réessaient exactement au même moment, en boucle ? (C'est un **livelock**.)

### La même correction dans le monde des threads
`node deadlock-workers.mjs order`

Les deux workers prennent maintenant A puis B. Le programme se termine : compare avec le résultat de la partie B.

### Comparaison des deux solutions (à remplir dans `notes.md`)

| | Ordre global | Timeout + réessai |
|---|---|---|
| Condition supprimée | ? | ? |
| Peut-il rester un blocage ? | ? | ? |
| Coût en temps | ? | ? |
| Difficulté à mettre en place | ? | ? |
| Quand l'utiliser | ? | ? |

---

## Dans la vraie vie

- **Transferts entre comptes** (le cas du lab) : deux virements croisés entre les mêmes comptes.
- **Bases de données** : deux transactions qui modifient les mêmes lignes **dans un ordre opposé** (l'une met à jour la ligne 1 puis la 2, l'autre la 2 puis la 1). PostgreSQL détecte le cycle et annule l'une des deux avec l'erreur `deadlock detected` (code `40P01`). Ton code doit alors **réessayer** la transaction. La prévention est la même qu'ici : toujours modifier les lignes dans le même ordre (par exemple par identifiant croissant). Tu le reverras au module 2.
- **Appels entre services** : le service A appelle B de façon synchrone pendant que B appelle A, avec des pools de threads ou de connexions limités : tous les threads attendent une réponse qui ne viendra jamais.
- **Files bornées** : deux composants qui s'envoient des messages dans des files pleines, chacun attendant de la place dans la file de l'autre.

## Livrable

Dans `phase-1-fondations/01-concurrence/lab2/`, crée un `notes.md` contenant :
- tes prédictions et ce que tu as observé pour chaque partie ;
- ton schéma d'attente circulaire (partie A) ;
- les réponses aux six questions de la partie C ;
- le tableau comparatif de la partie D rempli ;
- un exemple réel où tu pourrais rencontrer un deadlock.


