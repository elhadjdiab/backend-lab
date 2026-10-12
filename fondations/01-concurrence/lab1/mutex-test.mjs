// Banc d'essai du mutex : un seul fichier, aucune modification à faire.
// Lancer : node mutex-test.mjs <mode> <scénario>
//   mode      : mutex | nocatch | nomutex
//   scénario  : timing | error
// Exemples : node mutex-test.mjs mutex timing
//            node mutex-test.mjs nocatch error
const mode = process.argv[2] ?? 'mutex';
const scenario = process.argv[3] ?? 'timing';

let balance = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Mutex {
  #tail = Promise.resolve();
  run(fn) {
    const result = this.#tail.then(fn);
    this.#tail = mode === 'nocatch' ? result : result.catch(() => {});
    return result;
  }
}
const mutex = new Mutex();

async function withdraw(x, ms) {
  const current = balance;
  if (current < x) throw new Error('fonds insuffisants');
  await sleep(ms);
  balance = current - x;
}
const safeWithdraw = (x, ms) => (mode === 'nomutex' ? withdraw(x, ms) : mutex.run(() => withdraw(x, ms)));

const jobs = scenario === 'error'
  ? [[40, 100], [150, 100], [40, 100]]     // le 2e doit échouer
  : [[10, 200], [10, 100], [10, 300]];     // tous réussissent : on mesure le temps

console.log(`mode = ${mode}, scénario = ${scenario}`);
console.time('total');
const results = await Promise.allSettled(jobs.map(([x, ms]) => safeWithdraw(x, ms)));
console.log(results.map((r) => (r.status === 'rejected' ? r.reason.message : 'ok')));
console.log('solde =', balance);
console.timeEnd('total');
