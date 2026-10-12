// Lab 1C : vraie race condition entre threads (mémoire partagée)
// Lancer : node race-workers.mjs            (version dangereuse)
//          node race-workers.mjs atomic     (version corrigée)
import { Worker, isMainThread, workerData } from 'node:worker_threads'; 

const WORKERS = 1;
const PER_WORKER = 1_000_000;

if (isMainThread) {
  const mode = process.argv[2] ?? 'unsafe'; 
  const shared = new Int32Array(new SharedArrayBuffer(4));   // 1 entier partagé
  const start = performance.now();

  await Promise.all(Array.from({ length: WORKERS }, () =>
    new Promise((resolve, reject) => {
      const w = new Worker(new URL(import.meta.url), { workerData: { shared, mode, PER_WORKER } });
      w.on('exit', resolve);
      w.on('error', reject);
    })));

  const expected = WORKERS * PER_WORKER;
  console.log(`mode     : ${mode}`);
  console.log(`attendu  : ${expected}`);
  console.log(`obtenu   : ${shared[0]}`);
  console.log(`perdu    : ${expected - shared[0]}`);
  console.log(`durée    : ${(performance.now() - start).toFixed(0)} ms`);
} else {
  const { shared, mode, PER_WORKER } = workerData;
  if (mode === 'atomic') {
    for (let i = 0; i < PER_WORKER; i++) Atomics.add(shared, 0, 1);   // indivisible
  } else {
    for (let i = 0; i < PER_WORKER; i++) shared[0]++;                 // lire, ajouter, écrire
  }
}
