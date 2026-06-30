(function () {
  const DB_KEY = 'activityTrackerLocalDb';
  const AUTH_KEY = 'activityTrackerLocalAuth';
  const USERS_KEY = 'activityTrackerLocalAuthUsers';
  const listeners = {};

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function uidFromEmail(email) {
    return 'uid_' + String(email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  function clean(path) {
    return String(path || '').replace(/^\/+|\/+$/g, '');
  }
  function parts(path) {
    const p = clean(path);
    return p ? p.split('/') : [];
  }
  function getAt(obj, path) {
    return parts(path).reduce((cur, part) => cur && cur[part], obj);
  }
  function setAt(obj, path, value) {
    const ps = parts(path);
    if (!ps.length) return value;
    let cur = obj;
    ps.slice(0, -1).forEach(part => {
      if (!cur[part] || typeof cur[part] !== 'object') cur[part] = {};
      cur = cur[part];
    });
    cur[ps[ps.length - 1]] = value;
    return obj;
  }
  function removeAt(obj, path) {
    const ps = parts(path);
    if (!ps.length) return {};
    let cur = obj;
    ps.slice(0, -1).forEach(part => { cur = cur && cur[part]; });
    if (cur) delete cur[ps[ps.length - 1]];
    return obj;
  }
  function mergeAt(obj, path, value) {
    const current = getAt(obj, path);
    return setAt(obj, path, Object.assign({}, current || {}, value || {}));
  }
  function snap(value) {
    return { val: () => value == null ? null : value, exists: () => value != null };
  }
  function notify(path) {
    Object.entries(listeners).forEach(([listenPath, callbacks]) => {
      if (clean(path).startsWith(clean(listenPath)) || clean(listenPath).startsWith(clean(path))) {
        const value = getAt(read(DB_KEY, {}), listenPath);
        callbacks.forEach(cb => cb(snap(value)));
      }
    });
  }
  function ref(path) {
    const basePath = clean(path);
    const api = {
      once() {
        return Promise.resolve(snap(getAt(read(DB_KEY, {}), basePath)));
      },
      on(event, cb) {
        if (event !== 'value') return api;
        listeners[basePath] = listeners[basePath] || [];
        listeners[basePath].push(cb);
        cb(snap(getAt(read(DB_KEY, {}), basePath)));
        return api;
      },
      off() {
        delete listeners[basePath];
      },
      set(value) {
        const db = setAt(read(DB_KEY, {}), basePath, value);
        write(DB_KEY, db);
        notify(basePath);
        return Promise.resolve();
      },
      update(value) {
        let db = read(DB_KEY, {});
        const keys = Object.keys(value || {});
        if (basePath === '' && keys.some(k => k.includes('/'))) {
          keys.forEach(k => { db = setAt(db, k, value[k]); notify(k); });
        } else {
          db = mergeAt(db, basePath, value);
          notify(basePath);
        }
        write(DB_KEY, db);
        return Promise.resolve();
      },
      remove() {
        const db = removeAt(read(DB_KEY, {}), basePath);
        write(DB_KEY, db);
        notify(basePath);
        return Promise.resolve();
      },
      push(value) {
        const key = 'k_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        const child = ref(basePath + '/' + key);
        if (value !== undefined) child.set(value);
        return Object.assign(child, { key });
      },
      child(childPath) {
        return ref(basePath + '/' + childPath);
      },
      orderByChild() { return api; },
      limitToLast() { return api; }
    };
    return api;
  }

  const auth = {
    createUserWithEmailAndPassword(email, password) {
      email = String(email || '').toLowerCase();
      const users = read(USERS_KEY, {});
      if (users[email]) return Promise.reject(new Error('This email is already signed up. Please sign in.'));
      const user = { uid: uidFromEmail(email), email };
      users[email] = { uid: user.uid, email, password };
      write(USERS_KEY, users);
      write(AUTH_KEY, user);
      return Promise.resolve({ user });
    },
    signInWithEmailAndPassword(email, password) {
      email = String(email || '').toLowerCase();
      const account = read(USERS_KEY, {})[email];
      if (!account || account.password !== password) return Promise.reject(new Error('Invalid email or password.'));
      const user = { uid: account.uid, email };
      write(AUTH_KEY, user);
      return Promise.resolve({ user });
    },
    signOut() {
      localStorage.removeItem(AUTH_KEY);
      return Promise.resolve();
    },
    onAuthStateChanged(cb) {
      cb(read(AUTH_KEY, null));
    }
  };

  window.firebase = {
    initializeApp() { return {}; },
    app() { return {}; },
    auth() { return auth; },
    database() { return { ref }; }
  };
})();
