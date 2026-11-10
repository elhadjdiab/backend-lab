// Lab 2A : un deadlock avec des promesses (un seul thread)
// Lancer : node deadlock-async.mjs
import { Mutex } from './mutex.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); // pour simuler un traitement asynchrone
const log = (msg) => console.log(msg); 

const A = { name: 'A', balance: 100, mutex: new Mutex() }; 
const B = { name: 'B', balance: 100, mutex: new Mutex() };

// Transfert : on verrouille d'abord le compte source, puis le compte destination.
async function transfer(label, from, to, amount) {
  log(`${label} : demande le verrou de ${from.name}`);
  const releaseFrom = await from.mutex.acquire(); // on obtient le verrou du compte source
  log(`${label} : a le verrou de ${from.name}`);

  await sleep(10);                       // simule la vérification du solde (base de données)

  log(`${label} : demande le verrou de ${to.name}`);
  const releaseTo = await to.mutex.acquire(); // on obtient le verrou du compte destination
  log(`${label} : a le verrou de ${to.name}`);

  from.balance -= amount;
  to.balance += amount;
  log(`${label} : transfert terminé (${from.name} → ${to.name}, ${amount} $)`);

  releaseTo();
  releaseFrom();
}

// Deux transferts en sens contraire, lancés en même temps
const work = Promise.all([
  transfer('T1', A, B, 10), 
  // transfer('T2', A, B, 20)
  // transfer('T2', B, A, 20), 
]);


// Chien de garde : si rien n'a fini après 1 seconde, on le signale
const watchdog = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 1000));
const outcome = await Promise.race([work.then(() => 'DONE'), watchdog]);

if (outcome === 'DONE') {
  console.log(`\nTerminé. A = ${A.balance}, B = ${B.balance}`);
} else {
  console.log('\nDEADLOCK : aucun transfert n\'a terminé après 1 seconde.');
  console.log(`A = ${A.balance}, B = ${B.balance} (rien n'a bougé)`);
  process.exit(1);
}
