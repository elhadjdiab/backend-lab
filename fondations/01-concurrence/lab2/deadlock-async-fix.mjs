// Lab 2B : deux façons d'éviter le deadlock (promesses)
// Lancer : node deadlock-async-fix.mjs order      (ordre global des verrous)
//          node deadlock-async-fix.mjs timeout    (timeout + nouvel essai)
import { Mutex } from './mutex.mjs';

const mode = process.argv[2] ?? 'order';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (max) => Math.floor(Math.random() * max);

const A = { id: 1, name: 'A', balance: 100, mutex: new Mutex() };
const B = { id: 2, name: 'B', balance: 100, mutex: new Mutex() };

// Solution 1 : toujours verrouiller dans le même ordre (par identifiant)
async function transferOrdered(label, from, to, amount) {
  const [first, second] = from.id < to.id ? [from, to] : [to, from];
  const release1 = await first.mutex.acquire();
  await sleep(10);
  const release2 = await second.mutex.acquire();
  from.balance -= amount;
  to.balance += amount;
  console.log(`${label} : terminé (${from.name} → ${to.name}, ${amount} $)`);
  release2();
  release1();
}

// Solution 2 : on abandonne si on ne peut pas obtenir le 2e verrou à temps, puis on réessaie
async function transferTimeout(label, from, to, amount) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    const releaseFrom = await from.mutex.acquire();
    try {
      await sleep(10);
      const releaseTo = await to.mutex.acquire(50);       // échoue après 50 ms
      from.balance -= amount;
      to.balance += amount;
      console.log(`${label} : terminé à l'essai ${attempt} (${from.name} → ${to.name}, ${amount} $)`);
      releaseTo();
      return;
    } catch (e) {
      console.log(`${label} : timeout à l'essai ${attempt}, je libère ${from.name} et je réessaie`);
    } finally {
      releaseFrom();
    }
    await sleep(10 + jitter(60));                         // pause aléatoire avant de réessayer
  }
  throw new Error(`${label} : abandon après 10 essais`);
}

const transfer = mode === 'timeout' ? transferTimeout : transferOrdered;
console.log(`mode = ${mode}`);
console.time('total');
await Promise.all([
  transfer('T1', A, B, 10),
  transfer('T2', B, A, 20),
]);
console.log(`A = ${A.balance}, B = ${B.balance}  (attendu : A = 110, B = 90)`);
console.timeEnd('total');
