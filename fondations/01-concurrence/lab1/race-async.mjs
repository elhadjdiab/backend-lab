// Lab 1A : race condition « logique » en mono-thread
// Lancer : node race-async.mjs
let balance = 100;
 const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// const audit = () => sleep(10);              // simule un appel réseau

const audit = (ms) => sleep(ms);              // simule un appel réseau
async function withdraw(x, ms) {
  const current = balance;                  // 1. lecture
  if (current < x) throw new Error('fonds insuffisants');
  await audit(ms);                            // 2. attente : un autre appel s'exécute ici
  balance = current - x;                    // 3. écriture fondée sur une valeur PÉRIMÉE
}

const results = await Promise.allSettled([withdraw(40, 10), withdraw(70, 50)]);
console.log(results.map((r) => r.status === 'rejected' ? r.reason.message : 'ok'));
console.log('solde =', balance);
// Résultat correct attendu : 2 retraits acceptés, 1 refusé, solde = 20
