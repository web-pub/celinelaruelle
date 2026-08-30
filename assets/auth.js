/* ===================================================================
   AUTHENTIFICATION — commun à toutes les pages
   =================================================================== */

/* Traduction des erreurs Firebase en messages clairs (FR) */
function traduireErreur(err){
  const code = err && err.code ? err.code : '';
  const map = {
    'auth/invalid-email': "Identifiant invalide.",
    'auth/user-not-found': "Ce compte n'existe pas. Vérifie ton identifiant.",
    'auth/wrong-password': "Mot de passe incorrect.",
    'auth/invalid-credential': "Identifiant ou mot de passe incorrect.",
    'auth/invalid-login-credentials': "Identifiant ou mot de passe incorrect.",
    'auth/too-many-requests': "Trop de tentatives. Réessaie dans quelques minutes.",
    'auth/network-request-failed': "Problème de connexion internet. Réessaie.",
    'auth/email-already-in-use': "Cet identifiant est déjà utilisé.",
    'auth/weak-password': "Le mot de passe doit contenir au moins 6 caractères.",
    'permission-denied': "Accès refusé : tu n'as pas les droits pour cette action."
  };
  return map[code] || ("Une erreur est survenue (" + (code || err.message || 'inconnue') + "). Réessaie ou contacte Hélène.");
}

function afficherAlerte(elementId, message, type){
  const el = document.getElementById(elementId);
  if(!el) return;
  el.textContent = message;
  el.className = 'alert ' + (type === 'ok' ? 'alert-ok' : 'alert-error');
  el.classList.remove('hidden');
}

function masquerAlerte(elementId){
  const el = document.getElementById(elementId);
  if(el) el.classList.add('hidden');
}

/* Connexion par identifiant + mot de passe */
function connecter(identifiant, motDePasse, alerteId, onSuccess){
  masquerAlerte(alerteId);
  if(!identifiant || !motDePasse){
    afficherAlerte(alerteId, "Merci de remplir l'identifiant et le mot de passe.");
    return;
  }
  const email = usernameToEmail(identifiant);
  auth.signInWithEmailAndPassword(email, motDePasse)
    .then(async (cred) => {
      const uid = cred.user.uid;
      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      if(!snap.exists){
        afficherAlerte(alerteId, "Ton compte existe mais ta fiche est introuvable. Contacte Hélène.");
        auth.signOut();
        return;
      }
      const data = snap.data();
      const now = firebase.firestore.FieldValue.serverTimestamp();
      await userRef.update({ derniereConnexion: now });
      // Historique visible dans l'onglet "mots de passe" (super admin) et fiche membre
      await db.collection('passwords_vault').doc(uid).set({ derniereConnexion: now }, { merge:true });
      await db.collection('connexions_log').add({
        uid, username: data.username, role: data.role, date: now
      });
      if(typeof onSuccess === 'function') onSuccess(data);
    })
    .catch(err => afficherAlerte(alerteId, traduireErreur(err)));
}

function deconnecter(){
  auth.signOut().then(() => { window.location.href = 'login.html'; });
}

/* Garde de page : vérifie le rôle requis, redirige sinon.
   rolesAutorises: tableau, ex. ['admin','superadmin'] */
function protegerPage(rolesAutorises, callback){
  auth.onAuthStateChanged(async (user) => {
    if(!user){
      window.location.href = 'login.html';
      return;
    }
    try{
      const snap = await db.collection('users').doc(user.uid).get();
      if(!snap.exists){
        alert("Fiche utilisateur introuvable. Déconnexion.");
        auth.signOut().then(()=> window.location.href = 'login.html');
        return;
      }
      const data = snap.data();
      if(!rolesAutorises.includes(data.role)){
        alert("Accès refusé : cette page ne correspond pas à ton rôle.");
        window.location.href = 'login.html';
        return;
      }
      callback(user, data);
    }catch(err){
      alert(traduireErreur(err));
    }
  });
}
