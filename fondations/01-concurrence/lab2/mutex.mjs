// Mutex asynchrone réutilisable par les scripts du lab 2.
// acquire() rend une promesse qui donne une fonction « release ».
// acquire(ms) échoue avec une erreur 'timeout' si le verrou n'est pas obtenu à temps.
export class Mutex {
  #locked = false;
  #waiters = [];

  acquire(timeoutMs) {
    return new Promise((resolve, reject) => {
      const entry = { timer: null };
      entry.grant = () => {
        clearTimeout(entry.timer); 
        this.#locked = true; 
        resolve(() => this.#release()); 
      };
      if (!this.#locked) return entry.grant();       // libre : on le prend tout de suite
      this.#waiters.push(entry);                      // occupé : on fait la queue
      if (timeoutMs !== undefined) {
        entry.timer = setTimeout(() => {
          const i = this.#waiters.indexOf(entry);
          if (i >= 0) { this.#waiters.splice(i, 1); 
            reject(new Error('timeout')); }
        }, timeoutMs);
      }
    });
  }

  #release() {
    const next = this.#waiters.shift();
    if (next) next.grant();                           // le suivant dans la file prend le verrou
    else this.#locked = false;
  }
}
