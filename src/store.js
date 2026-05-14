const Store = require('electron-store');

const schema = {
  nickname: {
    type: 'string',
    default: '',
  },
  selectedVersion: {
    type: 'string',
    default: 'fabric-loader-0.16.5-1.21.4',
  },
  token: {
    type: ['string', 'null'],
    default: null,
  },
  lastProfile: {
    type: ['object', 'null'],
    default: null,
  },
};

const store = new Store({ schema, name: 'pulse-visuals-config' });

module.exports = {
  get(key) {
    return store.get(key);
  },
  set(key, value) {
    store.set(key, value);
  },
  delete(key) {
    store.delete(key);
  },
  clearProfile() {
    store.delete('token');
    store.delete('lastProfile');
    store.delete('nickname');
  },
  all() {
    return store.store;
  },
  path: store.path,
};
