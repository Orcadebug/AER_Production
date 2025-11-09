const dns = require('dns');
let online = true;

function probe() {
  dns.lookup('aercarbon.com', (err) => {
    const newState = !err;
    if (newState !== online) {
      online = newState;
      if (typeof onChange === 'function') onChange(online);
    }
  });
}
let onChange = null;

function watchOnline(cb) {
  onChange = cb;
  probe();
  setInterval(probe, 10000);
}

function getOnline() { return online; }

module.exports = { watchOnline, getOnline };
