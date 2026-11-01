// FORGOT PASSWORD (owner 2026-10-31: "ya no puedo entrar, no tengo la clave" — the sign-in screen had no way out): a link under "Sign In" that sends the account's own "set a new password" email through Firebase to the address typed above.
// It changes nothing by itself: Firebase sends the email to that address and the person sets the new password from it. The answer is the same whether or not the address has an account (no one can probe who has one).
(function(){
  function init(){
    var form = document.getElementById('formSignIn');
    if (!form || document.getElementById('btForgot')) return;
    var link = document.createElement('button');
    link.type = 'button'; link.id = 'btForgot'; link.textContent = 'Forgot password?';
    link.style.cssText = 'display:block;margin:12px auto 0;background:none;border:0;padding:4px 8px;color:#2F6FBF;font:600 13px Inter,system-ui,sans-serif;text-decoration:underline;cursor:pointer';
    form.appendChild(link);
    link.addEventListener('click', function(){
      var email = String((document.getElementById('siEmail') || {}).value || '').trim(), msg = document.getElementById('authMsg');
      function say(t, ok){ if (!msg) return; msg.textContent = t; msg.className = 'auth-msg ' + (ok ? 'ok' : 'err'); }
      if (!email) { say('Type your work email above, then press "Forgot password?".'); return; }
      if (typeof auth === 'undefined' || !auth || typeof auth.sendPasswordResetEmail !== 'function') { say('Password reset is not available right now.'); return; }
      link.disabled = true;
      auth.sendPasswordResetEmail(email)
        .then(function(){ say('If that email has an account, a link to set a new password is on its way. Check your inbox.', true); })
        .catch(function(e){ say(e && e.code === 'auth/invalid-email' ? 'That email does not look right.' : 'Could not send the email. Try again in a minute.'); })
        .then(function(){ link.disabled = false; });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
