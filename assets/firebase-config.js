/* ===================================================================
   CONFIGURATION FIREBASE — projet "celinelaruelle"
   -------------------------------------------------------------------
   1) Va sur https://console.firebase.google.com
   2) Crée un projet nommé par exemple "celinelaruelle"
   3) Active Authentication > Sign-in method > Email/Password
   4) Active Firestore Database (mode production)
   5) Dans "Paramètres du projet > Général > Vos applications",
      crée une application Web et colle ici les valeurs affichées.
   =================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyBlQocbjltMD6x-JZsRVQoEuYIfqOJmbPU",
  authDomain: "celinelaruellecoach.firebaseapp.com",
  projectId: "celinelaruellecoach",
  storageBucket: "celinelaruellecoach.firebasestorage.app",
  messagingSenderId: "203218504810",
  appId: "1:203218504810:web:d6ab9facd9e7464cc88e13"
};

// Référence projet Firebase — reprise dans les règles Firestore (voir firestore.rules)
// Dépôt GitHub (hébergement du site) : celinelaruelle
const PROJECT_REF = "celinelaruellecoach";

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
/* auth n'est initialisé que si le SDK Firebase Auth est chargé sur la page
   (pages publiques comme blog.html/livres.html n'en ont pas besoin). */
const auth = firebase.auth ? firebase.auth() : null;

/* Domaine fictif utilisé pour générer un email technique à partir d'un
   simple identifiant (les membres/admin se connectent en "identifiant + mot
   de passe", pas en email). */
const AUTH_DOMAIN_SUFFIX = "@celinelaruelle.local";

function usernameToEmail(username){
  return username.trim().toLowerCase().replace(/\s+/g,'') + AUTH_DOMAIN_SUFFIX;
}
