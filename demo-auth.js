// Demo login: replaces Firebase. Nothing here reaches the real BUENTRADE system.
(function(){
  var KEY = 'bt_demo_session';
  // email -> SHA-256 of its password. "invitado" is the friend's login and never changes; "felipe" is the owner's; "trader" and "buyer" show the two profiles of the Bid funnel.
  var ACCOUNTS = {
    "invitado@buentrade.demo": "912b1ae1e94aa5ce8ef040ff85b3417a9a19d3638dcfba189d81457e197eac41",
    "felipe@buentrade.demo": "140719f7228f5f898e8059194584b6b2bdf2f3db6d984b86700637df54eaa3d0",
    "trader@buentrade.demo": "03afee30a1d1d6f714ecba34bc7949168acd46250fde8b5749fd378282a58d64",
    "buyer@buentrade.demo": "d173bf5367dbed9644a3e8355427619b72b99b4c2b3d3500e51b3388b07845b2"
  };
  var listeners = [];
  function mk(email){ return { email: email, emailVerified: true, uid: 'demo-user', displayName: 'Demo', getIdToken: function(){ return Promise.resolve('demo'); } }; }
  var current = null;
  try { var s = localStorage.getItem(KEY); if (s) current = mk(s); } catch(e){}
  function sha256(str){
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function(b){
      return Array.prototype.map.call(new Uint8Array(b), function(x){ return ('0'+x.toString(16)).slice(-2); }).join('');
    });
  }
  function fire(){ listeners.forEach(function(cb){ try { cb(current); } catch(e){} }); }
  var authObj = {
    get currentUser(){ return current; },
    setPersistence: function(){ return Promise.resolve(); },
    onAuthStateChanged: function(cb){
      listeners.push(cb);
      // like Firebase, answer only after the page has finished loading its own scripts
      var go = function(){ setTimeout(function(){ cb(current); }, 0); };
      if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
      return function(){};
    },
    signInWithEmailAndPassword: function(email, pass){
      return sha256(String(pass || '')).then(function(h){
        var em = String(email || '').trim().toLowerCase();
        if (Object.prototype.hasOwnProperty.call(ACCOUNTS, em) && ACCOUNTS[em] === h) {
          current = mk(em);
          try { localStorage.setItem(KEY, em); } catch(e){}
          setTimeout(fire, 0);
          return { user: current };
        }
        var err = new Error('Usuario o contraseña incorrectos.'); err.code = 'auth/invalid-credential'; throw err;
      });
    },
    signOut: function(){ current = null; try { localStorage.removeItem(KEY); } catch(e){} setTimeout(fire, 0); return Promise.resolve(); },
    sendPasswordResetEmail: function(){ return Promise.reject(new Error('No disponible en el demo.')); },
    createUserWithEmailAndPassword: function(){ return Promise.reject(new Error('El registro está desactivado en el demo.')); }
  };
  // The Messaging / Market Flash assistant needs AI and mail keys that the demo does not have: answer it empty and instantly.
  var realFetch = window.fetch.bind(window);
  window.fetch = function(url, opts){
    try {
      if (String(url).indexOf('/functions/v1/messaging') !== -1) {
        return Promise.resolve(new Response(JSON.stringify({ clients: [], bulletins: [], items: [], sections: [], demo: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      // Emails: the demo has no mail service. The OS email window gets an instant "sent" so the whole flow can be seen; nothing leaves, nobody receives anything.
      if (String(url).indexOf('/.netlify/functions/send-email') !== -1) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, demo: true, id: 'demo-not-sent' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
    } catch(e){}
    return realFetch(url, opts);
  };
  function auth(){ return authObj; }
  auth.Auth = { Persistence: { LOCAL: 'local', SESSION: 'session', NONE: 'none' } };
  window.firebase = { initializeApp: function(){}, auth: auth };

  // DEMO ribbon — everything on screen is sample data and nothing real is sent.
  document.addEventListener('DOMContentLoaded', function(){
    var b = document.createElement('div');
    b.textContent = 'DEMO — datos de ejemplo. No se envía ningún correo ni mensaje real.';
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#0f766e;color:#fff;font:600 12px/1.2 Inter,system-ui,sans-serif;text-align:center;padding:6px 10px;letter-spacing:.2px;pointer-events:none';
    document.body.appendChild(b);
  });
})();
