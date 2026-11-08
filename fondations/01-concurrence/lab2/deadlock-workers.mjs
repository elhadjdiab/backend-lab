// Lab 2C : un deadlock entre vrais threads (workers + mémoire partagée)
// Lancer : node deadlock-workers.mjs            (le deadlock)
//          node deadlock-workers.mjs order      (corrigé par l'ordre des verrous)
import { Worker, isMainThread, workerData } from 'node:worker_threads';

// Mémoire partagée : [verrou A, verrou B, attente W1, attente W2, nb de workers terminés]
const LOCK_A = 0, LOCK_B = 1, WAIT_1 = 2, WAIT_2 = 3, DONE = 4;
const NAMES = ['A', 'B'];

function pause(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function lock(mem, which, me) {
  Atomics.store(mem, me === 1 ? WAIT_1 : WAIT_2, which + 1);          // « j'attends ce verrou »
  for (;;) {
    if (Atomics.compareExchange(mem, which, 0, me) === 0) break;      // verrou libre : je le prends
    const owner = Atomics.load(mem, which);
    if (owner !== 0) Atomics.wait(mem, which, owner);                 // je dors tant qu'il est pris
  }
  Atomics.store(mem, me === 1 ? WAIT_1 : WAIT_2, 0);
}
function unlock(mem, which) {
  Atomics.store(mem, which, 0);
  Atomics.notify(mem, which, 1);
}

if (isMainThread) {
  const mode = process.argv[2] ?? 'unsafe';
  const mem = new Int32Array(new SharedArrayBuffer(5 * 4));
  const workers = [1, 2].map((id) => new Worker(new URL(import.meta.url), { workerData: { mem, id, mode } }));
  console.log(`mode = ${mode}`);
  const start = performance.now();

  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (Atomics.load(mem, DONE) === 2) { clearInterval(check); resolve('DONE'); }
      else if (performance.now() - start > 1500) { clearInterval(check); resolve('DEADLOCK'); }
    }, 50);
  }).then(async (result) => {
    if (result === 'DONE') {
      console.log(`Les deux workers ont terminé en ${(performance.now() - start).toFixed(0)} ms.`);
    } else {
      const own = (i) => (Atomics.load(mem, i) === 0 ? 'personne' : `worker ${Atomics.load(mem, i)}`);
      const wants = (i) => (Atomics.load(mem, i) === 0 ? 'rien' : `verrou ${NAMES[Atomics.load(mem, i) - 1]}`);
      console.log('\nDEADLOCK détecté après 1,5 s :');
      console.log(`  verrou A détenu par : ${own(LOCK_A)}`);
      console.log(`  verrou B détenu par : ${own(LOCK_B)}`);
      console.log(`  worker 1 attend : ${wants(WAIT_1)}`);
      console.log(`  worker 2 attend : ${wants(WAIT_2)}`);
      await Promise.all(workers.map((w) => w.terminate()));
      process.exit(1);
    }
  });
  await Promise.all(workers.map((w) => w.terminate()));
} else {
  const { mem, id, mode } = workerData;
  // Worker 1 veut A puis B ; worker 2 veut B puis A (sauf en mode « order »)
  let first = id === 1 ? LOCK_A : LOCK_B;
  let second = id === 1 ? LOCK_B : LOCK_A;
  if (mode === 'order') { first = LOCK_A; second = LOCK_B; }

  lock(mem, first, id);
  pause(100);                       // le temps que l'autre worker prenne son premier verrou
  lock(mem, second, id);
  unlock(mem, second);
  unlock(mem, first);
  Atomics.add(mem, DONE, 1);
}
