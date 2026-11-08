# backend-lab

Mon laboratoire d'apprentissage pour devenir un ingénieur backend solide.

Résoudre des problèmes d'algorithmique n'est qu'une partie du métier. L'objectif de ce dépôt est d'apprendre à construire des logiciels qui restent **sécurisés, rapides et fiables en conditions réelles**, en reproduisant chaque problème moi-même avant d'apprendre à le résoudre.

- **Auteur** : Abdoulaye
- **Langage des exemples et des labs** : JavaScript (Node.js 22, modules ES `.mjs`)
- **Durée prévue** : 28 semaines, à raison de 8 à 10 heures par semaine
- **Cours de référence** : « Backend solide », roadmap et cours complet en 10 modules (document HTML)

---

## Table des matières

1. [La méthode de travail](#la-méthode-de-travail)
2. [La roadmap en 10 modules](#la-roadmap-en-10-modules)
3. [Structure du dépôt](#structure-du-dépôt)
4. [Progression](#progression)
5. [Le projet final](#le-projet-final)
6. [Prérequis et installation](#prérequis-et-installation)
7. [Lancer un lab](#lancer-un-lab)
8. [Ressources](#ressources)

---

## La méthode de travail

Chaque concept suit la même boucle :

1. **Prédire** : écrire ce que je pense qu'un programme va afficher, avant de le lancer.
2. **Casser** : reproduire le problème moi-même (race condition, deadlock, N+1, cache stampede, retry storm…).
3. **Comprendre** : expliquer avec mes mots ce qui s'est passé, dans un fichier `notes.md`.
4. **Réparer** : appliquer la solution, vérifier qu'elle marche, mesurer son coût.
5. **Relier au réel** : trouver où ce problème apparaît en production (paiements, stocks, billets, compteurs, files de messages…).

Règle d'or : un concept n'est acquis que lorsque je peux **prédire le résultat avant de lancer le code** et **provoquer le bug volontairement**.

---

## La roadmap en 10 modules

| Phase | Module | Sujets principaux | Semaines |
|---|---|---|---|
| **1. Fondations sur une machine** | 1. Concurrence et multithreading | Atomicité, visibilité, race conditions, verrous, mutex, deadlocks, workers, `async/await` | 1 à 3 |
| | 2. Ingénierie des bases de données | Normalisation, index, plans d'exécution, transactions, isolation, verrous, cache Redis | 4 à 6 |
| | 3. Problèmes pratiques | Cache LRU, rate limiter, job scheduler, file bloquante, pipeline producteur-consommateur | 7 à 8 |
| **2. Architecture et robustesse** | 4. Sécurité applicative | OAuth 2.0, JWT, TLS et mTLS, contrôle d'accès, failles courantes (OWASP) | 9 à 10 |
| | 5. System design | Estimations, répartition de charge, conception d'API, goulots d'étranglement, compromis | 11 à 13 |
| | 6. Tolérance aux pannes | Timeouts, retries avec backoff, disjoncteur, bulkhead, dégradation gracieuse | 14 à 15 |
| **3. Systèmes distribués** | 7. Architecture événementielle | Kafka, RabbitMQ, SQS, ordre des messages, idempotence, garanties de livraison, Outbox | 16 à 18 |
| | 8. Systèmes distribués | Réplication, élection de leader, modèles de cohérence, Raft, partitionnement, sagas | 19 à 21 |
| **4. Production** | 9. Observabilité et débogage | Logs, métriques, traces, OpenTelemetry, SLO, analyse d'incident | 22 à 23 |
| | 10. Optimisation des performances | Profilage, mémoire, pools de connexions, N+1, tests de charge | 24 à 25 |
| **5. Synthèse** | Projet final | Plateforme de commandes distribuée | 26 à 28 |

L'ordre va du plus simple (ce qui s'exécute sur une seule machine) au plus complexe (le distribué), puis à ce qui concerne la production.

---

## Structure du dépôt

```
backend-lab/
├── README.md
├── .gitignore
│
├── phase-1-fondations/                  ← semaines 1 à 8
│   ├── 01-concurrence/
│   │   ├── notes.md                     ← notes générales du module
│   │   └── lab1/                        ← race conditions
│   │       ├── race-async.mjs
│   │       ├── race-async-fix.mjs
│   │       ├── race-workers.mjs
│   │       ├── mutex-test.mjs
│   │       └── notes.md                 ← prédictions, résultats, explications
│   ├── 02-bases-de-donnees/
│   └── 03-problemes-pratiques/
│
├── phase-2-architecture/                ← semaines 9 à 15
│   ├── 04-securite/
│   ├── 05-system-design/
│   └── 06-tolerance-aux-pannes/
│
├── phase-3-systemes-distribues/         ← semaines 16 à 21
│   ├── 07-evenementiel/
│   └── 08-systemes-distribues/
│
├── phase-4-production/                  ← semaines 22 à 25
│   ├── 09-observabilite/
│   └── 10-performance/
│
└── phase-5-projet-final/                ← semaines 26 à 28
    └── plateforme-commandes/
```

Chaque **phase** regroupe ses modules, et chaque **module** suit le même schéma : des notes, un ou plusieurs labs, et pour chaque lab un `notes.md` avec mes prédictions et mes explications. Les numéros des modules (01 à 10) restent continus d'une phase à l'autre. Les dossiers qui ne sont pas encore commencés sont créés au fur et à mesure.

---

## Progression

- [x] Module 1, lab 1 : race conditions (partie A : race logique avec `await`, partie B : mutex asynchrone, partie C : workers et mémoire partagée)
- [ ] Module 1, lab 2 : deadlock
- [ ] Module 1, lab 3 : visibilité
- [ ] Module 2 : bases de données
- [ ] Module 3 : problèmes pratiques
- [ ] Module 4 : sécurité applicative
- [ ] Module 5 : system design
- [ ] Module 6 : tolérance aux pannes
- [ ] Module 7 : architecture événementielle
- [ ] Module 8 : systèmes distribués
- [ ] Module 9 : observabilité
- [ ] Module 10 : performance
- [ ] Projet final

---

## Le projet final

Une petite **plateforme de commandes** en trois ou quatre services, où chaque compétence du cours doit laisser une trace démontrable.

| Service | Rôle |
|---|---|
| `orders` | API REST, création des commandes, publication d'événements avec le patron Outbox |
| `inventory` | Réservation du stock, consommateur idempotent, verrou optimiste |
| `payments` | Appel à un faux fournisseur de paiement lent et instable, clé d'idempotence |
| `notifications` | Consommation des événements, file de lettres mortes, envoi simulé |

**Infrastructure** : PostgreSQL (une base par service), Redis (cache et limiteur de débit), Kafka, Keycloak, OpenTelemetry avec Grafana.

**Critères de réussite**
- **Concurrence** : deux commandes simultanées sur le dernier article, une seule réussit, test automatisé.
- **Base de données** : index justifiés par des plans d'exécution, aucun N+1, cache protégé contre le stampede.
- **Sécurité** : OAuth 2.0 (Authorization Code + PKCE, Client Credentials entre services), contrôle au niveau de l'objet.
- **System design** : document de conception de 3 pages avec estimations, schéma et alternatives écartées.
- **Tolérance aux pannes** : timeouts, retries avec jitter, disjoncteur ; une commande reste acceptée « en attente » si le paiement est indisponible.
- **Événementiel** : Outbox, consommateurs idempotents, saga de commande avec compensations.
- **Observabilité** : tableau de bord RED, trace de bout en bout d'une commande, un SLO avec alerte.
- **Performance** : test de charge à taux fixe, rapport avant/après avec au moins deux optimisations mesurées.
- **Chaos** : tuer un service, ralentir la base, couper Kafka ; documenter le comportement et corriger les faiblesses.

---

## Prérequis et installation

**Dès le module 1**
- [Node.js](https://nodejs.org) 22 ou plus : `node -v`
- Git : `git --version`
- Un éditeur (VS Code)

**À installer au fil des modules**
- Docker et Docker Compose (module 2 et suivants)
- PostgreSQL et Redis, lancés avec Docker
- Kafka (ou Redpanda), Keycloak, Grafana, Prometheus, Tempo ou Jaeger
- k6 pour les tests de charge

---

## Lancer un lab

Depuis la racine du dépôt :

```bash
cd phase-1-fondations/01-concurrence/lab1

node race-async.mjs                      # race condition logique (le bug)
node race-async-fix.mjs                  # correction avec un mutex
node race-workers.mjs                    # race condition entre threads (le bug)
node race-workers.mjs atomic             # correction avec Atomics.add
node mutex-test.mjs mutex timing         # banc d'essai : mutex | nocatch | nomutex, timing | error
```

Aucune dépendance à installer pour le module 1 : tout utilise les modules intégrés de Node.js.

---

## Ressources

**Livres**
- *Designing Data-Intensive Applications*, Martin Kleppmann
- *Release It!*, Michael Nygard
- *System Design Interview*, Alex Xu
- *Site Reliability Engineering*, Google (gratuit en ligne)
- *Systems Performance*, Brendan Gregg

**Cours et documentation**
- MIT 6.824 / 6.5840 : systèmes distribués
- *Use The Index, Luke* : l'indexation SQL expliquée
- Documentation officielle de Node.js, PostgreSQL, Kafka, OpenTelemetry et OWASP API Security Top 10

---

## Notes

Ce dépôt est un outil d'apprentissage : les premières versions du code sont volontairement simples ou contiennent des bugs, afin de les comprendre avant de les corriger. Les solutions « de production » (requêtes SQL atomiques, bibliothèques éprouvées, services dédiés) sont discutées dans les notes de chaque lab.