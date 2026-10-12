// Lab 1B : la même chose, corrigée avec un mutex asynchrone
// Lancer : node race-async-fix.mjs
let balance = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const audit = (ms) => sleep(ms);

// Un mutex asynchrone simple, basé sur une file de promesses
class Mutex {
  #tail = Promise.resolve(); 
  run(fn) { 
    const result = this.#tail.then(fn);     // fn démarre quand la précédente est finie
    // this.#tail = result.catch(() => {});    // une erreur ne bloque pas la file
    return result;
  }
}
const mutex = new Mutex();

// Lab 1B : la même chose, corrigée avec un mutex asynchrone
async function withdraw(x, ms) {
  const current = balance;
  if (current < x) throw new Error('fonds insuffisants');
  await audit(ms);
  balance = current - x;
}
const safeWithdraw = (x, ms) => mutex.run(() => withdraw(x, ms));

console.time('total')
const results = await Promise.allSettled([safeWithdraw(40, 200), safeWithdraw(40, 100), safeWithdraw(40, 300)]);
console.log(results.map((r) => r.status === 'rejected' ? r.reason.message : 'ok'));
console.log('solde =', balance);
console.timeEnd('total') 