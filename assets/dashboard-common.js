/* ===================================================================
   TABLEAU DE BORD COMMUN — Admin & Super Admin
   Onglets : Membres · Planning · Compta · Boutique
   =================================================================== */

function formatDate(ts){
  if(!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('fr-BE') + ' à ' + d.toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'});
}

function ouvrirModal(html){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOverlay';
  overlay.innerHTML = '<div class="modal">' + html + '</div>';
  overlay.addEventListener('click', (e) => { if(e.target === overlay) fermerModal(); });
  document.body.appendChild(overlay);
}
function fermerModal(){
  const el = document.getElementById('modalOverlay');
  if(el) el.remove();
}

/* ---------------------- ONGLET MEMBRES ---------------------- */
async function chargerMembres(){
  const zoneDemandes = document.getElementById('listeDemandes');
  const zoneMembres = document.getElementById('listeMembres');
  if(!zoneDemandes || !zoneMembres) return;

  zoneDemandes.innerHTML = '<p class="small-muted">Chargement...</p>';
  zoneMembres.innerHTML = '<p class="small-muted">Chargement...</p>';

  const demandesSnap = await db.collection('demandes_inscription').where('statut','==','en_attente').get();
  if(demandesSnap.empty){
    zoneDemandes.innerHTML = '<p class="small-muted">Aucune demande en attente.</p>';
  }else{
    let rows = '';
    demandesSnap.forEach(doc => {
      const d = doc.data();
      rows += `<tr>
        <td>${d.prenom} ${d.nom}</td><td>${d.email}</td><td>${d.telephone}</td>
        <td style="max-width:220px;">${d.raison || '—'}</td>
        <td>
          <button class="btn btn-sm" onclick="validerDemande('${doc.id}')">Valider</button>
          <button class="btn btn-sm btn-danger" onclick="refuserDemande('${doc.id}')">Refuser</button>
        </td></tr>`;
    });
    zoneDemandes.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Motif</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  const membresSnap = await db.collection('membres').orderBy('dateCreation','desc').get();
  if(membresSnap.empty){
    zoneMembres.innerHTML = '<p class="small-muted">Aucun membre pour le moment.</p>';
  }else{
    let rows = '';
    membresSnap.forEach(doc => {
      const m = doc.data();
      rows += `<tr>
        <td>${m.prenom} ${m.nom}</td><td>${m.username}</td><td>${m.email}</td>
        <td>${formatDate(m.derniereConnexion)}</td>
        <td><button class="btn btn-sm btn-outline" onclick="voirFicheMembre('${doc.id}')">Voir la fiche</button></td>
      </tr>`;
    });
    zoneMembres.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Parent</th><th>Identifiant</th><th>Email</th><th>Dernière connexion</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
}

/* Crée le compte Firebase Auth SANS déconnecter l'admin en cours,
   via une seconde instance d'application Firebase temporaire. */
async function creerCompteMembre(username, motdepasse, role){
  const secondaryApp = firebase.apps.find(a => a.name === 'secondary') || firebase.initializeApp(firebaseConfig, 'secondary');
  const secondaryAuth = secondaryApp.auth();
  const email = usernameToEmail(username);
  const cred = await secondaryAuth.createUserWithEmailAndPassword(email, motdepasse);
  const uid = cred.user.uid;
  await secondaryAuth.signOut();
  return uid;
}

async function validerDemande(demandeId){
  if(!confirm("Valider cette demande et créer le compte membre ?")) return;
  try{
    const ref = db.collection('demandes_inscription').doc(demandeId);
    const snap = await ref.get();
    const d = snap.data();

    const uid = await creerCompteMembre(d.username, d.motdepasse, 'membre');

    await db.collection('users').doc(uid).set({
      username: d.username, role: 'membre', email: d.email,
      derniereConnexion: null, dateCreation: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('passwords_vault').doc(uid).set({
      nom: d.nom, prenom: d.prenom, username: d.username, motdepasse: d.motdepasse,
      role: 'membre', derniereConnexion: null
    });
    await db.collection('membres').doc(uid).set({
      nom: d.nom, prenom: d.prenom, email: d.email, telephone: d.telephone,
      username: d.username, raisonInitiale: d.raison || '', enfants: [],
      derniereConnexion: null, dateCreation: firebase.firestore.FieldValue.serverTimestamp()
    });
    await ref.update({ statut: 'valide' });
    alert("Compte membre créé. Identifiant : " + d.username);
    chargerMembres();
  }catch(err){
    alert(traduireErreur(err));
  }
}

async function refuserDemande(demandeId){
  if(!confirm("Refuser cette demande ?")) return;
  await db.collection('demandes_inscription').doc(demandeId).update({ statut: 'refuse' });
  chargerMembres();
}

async function voirFicheMembre(membreId){
  const snap = await db.collection('membres').doc(membreId).get();
  const m = snap.data();
  const enfantsSnap = await db.collection('enfants').where('membreId','==',membreId).get();
  let enfantsHtml = '<p class="small-muted">Aucun enfant enregistré.</p>';
  if(!enfantsSnap.empty){
    enfantsHtml = '';
    enfantsSnap.forEach(doc => {
      const e = doc.data();
      const suivi = (e.suivi || []).map(s => `<li><strong>${s.date}</strong> — ${s.note}</li>`).join('') || '<li class="small-muted">Pas encore de suivi.</li>';
      enfantsHtml += `<div class="card mt-24">
        <h3>${e.prenom} ${e.nom}</h3>
        <p class="small-muted">Né(e) le ${e.dateNaissance || '—'} · ${e.ecole || '—'} · ${e.classe || '—'}</p>
        <strong>Suivi :</strong><ul>${suivi}</ul>
        <label>Ajouter une note de suivi</label>
        <textarea id="noteSuivi_${doc.id}" rows="2"></textarea>
        <button class="btn btn-sm mt-24" onclick="ajouterSuivi('${doc.id}')">Ajouter</button>
      </div>`;
    });
  }
  ouvrirModal(`
    <h2>${m.prenom} ${m.nom}</h2>
    <p class="small-muted">${m.email} · ${m.telephone}</p>
    <p class="small-muted">Identifiant : ${m.username} · Dernière connexion : ${formatDate(m.derniereConnexion)}</p>
    <div class="divider"></div>
    <h3>Enfants</h3>
    ${enfantsHtml}
    <div class="text-center mt-24"><button class="btn btn-outline" onclick="fermerModal()">Fermer</button></div>
  `);
}

async function ajouterSuivi(enfantId){
  const texte = document.getElementById('noteSuivi_' + enfantId).value.trim();
  if(!texte) return;
  const ref = db.collection('enfants').doc(enfantId);
  const snap = await ref.get();
  const suivi = snap.data().suivi || [];
  suivi.push({ date: new Date().toLocaleDateString('fr-BE'), note: texte });
  await ref.update({ suivi });
  fermerModal();
  alert("Note de suivi ajoutée.");
}

function ouvrirModalAjoutMembre(){
  ouvrirModal(`
    <h2>Ajouter un membre</h2>
    <div id="alerteModal" class="alert alert-error hidden"></div>
    <label>Nom</label><input id="am_nom">
    <label>Prénom</label><input id="am_prenom">
    <label>Email</label><input id="am_email" type="email">
    <label>Téléphone</label><input id="am_telephone">
    <label>Identifiant</label><input id="am_username">
    <label>Mot de passe (6 caractères min., sans caractère spécial)</label><input id="am_motdepasse" type="text">
    <div class="text-center mt-24">
      <button class="btn" onclick="creerMembreManuel()">Créer le membre</button>
      <button class="btn btn-outline" onclick="fermerModal()">Annuler</button>
    </div>
  `);
}

async function creerMembreManuel(){
  const nom = document.getElementById('am_nom').value.trim();
  const prenom = document.getElementById('am_prenom').value.trim();
  const email = document.getElementById('am_email').value.trim();
  const telephone = document.getElementById('am_telephone').value.trim();
  const username = document.getElementById('am_username').value.trim();
  const motdepasse = document.getElementById('am_motdepasse').value;

  if(!nom || !prenom || !email || !username || motdepasse.length < 6 || /[^a-zA-Z0-9]/.test(motdepasse)){
    afficherAlerte('alerteModal', "Vérifie les champs : mot de passe 6 caractères min., sans caractère spécial.");
    return;
  }
  try{
    const uid = await creerCompteMembre(username, motdepasse, 'membre');
    await db.collection('users').doc(uid).set({ username, role:'membre', email, derniereConnexion:null, dateCreation: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('passwords_vault').doc(uid).set({ nom, prenom, username, motdepasse, role:'membre', derniereConnexion:null });
    await db.collection('membres').doc(uid).set({ nom, prenom, email, telephone, username, enfants:[], derniereConnexion:null, dateCreation: firebase.firestore.FieldValue.serverTimestamp() });
    fermerModal();
    chargerMembres();
  }catch(err){
    afficherAlerte('alerteModal', traduireErreur(err));
  }
}

/* ---------------------- ONGLET PLANNING ---------------------- */
async function chargerPlanning(){
  const zone = document.getElementById('listePlanning');
  if(!zone) return;
  zone.innerHTML = '<p class="small-muted">Chargement...</p>';
  const snap = await db.collection('planning_disponibilites').orderBy('date','asc').get();
  if(snap.empty){ zone.innerHTML = '<p class="small-muted">Aucune disponibilité définie.</p>'; return; }
  let rows = '';
  for(const doc of snap.docs){
    const p = doc.data();
    const resaSnap = await db.collection('reservations').where('disponibiliteId','==',doc.id).where('statut','==','confirmee').get();
    rows += `<tr>
      <td>${p.date}</td><td>${p.heureDebut} - ${p.heureFin}</td>
      <td>${resaSnap.size} / ${p.placesMax}</td>
      <td><button class="btn btn-sm btn-danger" onclick="supprimerCreneau('${doc.id}')">Supprimer</button></td>
    </tr>`;
  }
  zone.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Horaire</th><th>Places</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function ouvrirModalCreneau(){
  ouvrirModal(`
    <h2>Ajouter un créneau</h2>
    <div id="alerteModal" class="alert alert-error hidden"></div>
    <label>Date</label><input id="cr_date" type="date">
    <label>Heure de début</label><input id="cr_debut" type="time">
    <label>Heure de fin</label><input id="cr_fin" type="time">
    <label>Nombre de places</label><input id="cr_places" type="number" min="1" value="1">
    <div class="text-center mt-24">
      <button class="btn" onclick="creerCreneau()">Ajouter</button>
      <button class="btn btn-outline" onclick="fermerModal()">Annuler</button>
    </div>
  `);
}

async function creerCreneau(){
  const date = document.getElementById('cr_date').value;
  const heureDebut = document.getElementById('cr_debut').value;
  const heureFin = document.getElementById('cr_fin').value;
  const placesMax = parseInt(document.getElementById('cr_places').value || '1', 10);
  if(!date || !heureDebut || !heureFin){
    afficherAlerte('alerteModal', "Merci de compléter la date et les horaires.");
    return;
  }
  await db.collection('planning_disponibilites').add({ date, heureDebut, heureFin, placesMax });
  fermerModal();
  chargerPlanning();
}

async function supprimerCreneau(id){
  if(!confirm("Supprimer ce créneau ?")) return;
  await db.collection('planning_disponibilites').doc(id).delete();
  chargerPlanning();
}

/* ---------------------- ONGLET COMPTA ---------------------- */
async function chargerCompta(){
  const zoneAchats = document.getElementById('listeAchats');
  const zoneVentes = document.getElementById('listeVentes');
  if(!zoneAchats || !zoneVentes) return;

  const achatsSnap = await db.collection('compta_achats').orderBy('date','desc').get();
  let rowsA = '';
  achatsSnap.forEach(doc => {
    const a = doc.data();
    rowsA += `<tr><td>${a.date}</td><td>${a.fournisseur}</td><td>${a.montantTVAC} €</td><td>${a.categorie}</td><td>${a.deductibilite}%</td></tr>`;
  });
  zoneAchats.innerHTML = achatsSnap.empty ? '<p class="small-muted">Aucun achat enregistré.</p>' :
    `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Fournisseur</th><th>Montant TVAC</th><th>Catégorie</th><th>Déductibilité</th></tr></thead><tbody>${rowsA}</tbody></table></div>`;

  const ventesSnap = await db.collection('compta_ventes').orderBy('date','desc').get();
  let rowsV = '';
  ventesSnap.forEach(doc => {
    const v = doc.data();
    rowsV += `<tr><td>${v.numeroFacture}</td><td>${v.date}</td><td>${v.client}</td><td>${v.description}</td><td>${v.montant} €</td></tr>`;
  });
  zoneVentes.innerHTML = ventesSnap.empty ? '<p class="small-muted">Aucune vente enregistrée.</p>' :
    `<div class="table-wrap"><table><thead><tr><th>N° facture</th><th>Date</th><th>Client</th><th>Description</th><th>Montant</th></tr></thead><tbody>${rowsV}</tbody></table></div>`;
}

function ouvrirModalAchat(){
  ouvrirModal(`
    <h2>Ajouter un achat</h2>
    <label>Date</label><input id="ac_date" type="date" value="${new Date().toISOString().slice(0,10)}">
    <label>Fournisseur</label><input id="ac_fournisseur">
    <label>Montant TVAC (€)</label><input id="ac_montant" type="number" step="0.01">
    <label>Catégorie</label>
    <select id="ac_categorie">
      <option value="Fournitures">Fournitures (100%)</option>
      <option value="Documentation">Documentation (100%)</option>
      <option value="Restaurant">Restaurant (67%)</option>
      <option value="Autre">Autre (100%)</option>
    </select>
    <div class="text-center mt-24">
      <button class="btn" onclick="creerAchat()">Ajouter</button>
      <button class="btn btn-outline" onclick="fermerModal()">Annuler</button>
    </div>
  `);
}

async function creerAchat(){
  const date = document.getElementById('ac_date').value;
  const fournisseur = document.getElementById('ac_fournisseur').value.trim();
  const montantTVAC = parseFloat(document.getElementById('ac_montant').value || '0');
  const categorie = document.getElementById('ac_categorie').value;
  const deductibilite = categorie === 'Restaurant' ? 67 : 100;
  if(!fournisseur || !montantTVAC){ alert("Merci de compléter le fournisseur et le montant."); return; }
  await db.collection('compta_achats').add({ date, fournisseur, montantTVAC, categorie, deductibilite });
  fermerModal();
  chargerCompta();
}

function ouvrirModalVente(){
  ouvrirModal(`
    <h2>Ajouter une vente</h2>
    <label>Date</label><input id="ve_date" type="date" value="${new Date().toISOString().slice(0,10)}">
    <label>Client</label><input id="ve_client">
    <label>Description</label><input id="ve_description">
    <label>Montant (€)</label><input id="ve_montant" type="number" step="0.01">
    <div class="text-center mt-24">
      <button class="btn" onclick="creerVente()">Ajouter</button>
      <button class="btn btn-outline" onclick="fermerModal()">Annuler</button>
    </div>
  `);
}

async function creerVente(){
  const date = document.getElementById('ve_date').value;
  const client = document.getElementById('ve_client').value.trim();
  const description = document.getElementById('ve_description').value.trim();
  const montant = parseFloat(document.getElementById('ve_montant').value || '0');
  if(!client || !description){ alert("Merci de compléter le client et la description."); return; }

  const annee = new Date(date).getFullYear();
  const compteurRef = db.collection('config').doc('compteur_factures_' + annee);
  const numeroFacture = await db.runTransaction(async (t) => {
    const doc = await t.get(compteurRef);
    const dernier = doc.exists ? doc.data().dernier : 0;
    const nouveau = dernier + 1;
    t.set(compteurRef, { dernier: nouveau });
    return annee + ' ' + String(nouveau).padStart(3,'0');
  });

  await db.collection('compta_ventes').add({ date, client, description, montant, numeroFacture });
  fermerModal();
  chargerCompta();
}

/* ---------------------- ONGLET BOUTIQUE ---------------------- */
async function chargerBoutique(){
  const zoneProduits = document.getElementById('listeProduits');
  const zoneCommandes = document.getElementById('listeCommandes');
  if(!zoneProduits) return;

  const produitsSnap = await db.collection('boutique_produits').get();
  let rowsP = '';
  produitsSnap.forEach(doc => {
    const p = doc.data();
    rowsP += `<tr><td>${p.nom}</td><td>${p.prix} €</td><td>${p.type === 'precommande' ? 'Précommande' : 'En stock'}</td><td>${p.stock ?? '—'}</td>
      <td><button class="btn btn-sm btn-danger" onclick="supprimerProduit('${doc.id}')">Supprimer</button></td></tr>`;
  });
  zoneProduits.innerHTML = produitsSnap.empty ? '<p class="small-muted">Aucun produit.</p>' :
    `<div class="table-wrap"><table><thead><tr><th>Produit</th><th>Prix</th><th>Type</th><th>Stock</th><th></th></tr></thead><tbody>${rowsP}</tbody></table></div>`;

  if(zoneCommandes){
    const commandesSnap = await db.collection('commandes').orderBy('date','desc').get();
    let rowsC = '';
    for(const doc of commandesSnap.docs){
      const c = doc.data();
      rowsC += `<tr><td>${c.date}</td><td>${c.membreNom || c.membreId}</td><td>${c.produitNom}</td><td>${c.quantite}</td><td>${c.statut}</td></tr>`;
    }
    zoneCommandes.innerHTML = commandesSnap.empty ? '<p class="small-muted">Aucune commande.</p>' :
      `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Membre</th><th>Produit</th><th>Qté</th><th>Statut</th></tr></thead><tbody>${rowsC}</tbody></table></div>`;
  }
}

function ouvrirModalProduit(){
  ouvrirModal(`
    <h2>Ajouter un produit</h2>
    <label>Nom</label><input id="pr_nom">
    <label>Description</label><textarea id="pr_description" rows="2"></textarea>
    <label>Prix (€)</label><input id="pr_prix" type="number" step="0.01">
    <label>Type</label>
    <select id="pr_type"><option value="precommande">Précommande</option><option value="stock">En stock</option></select>
    <label>Stock disponible (laisser vide si précommande illimitée)</label><input id="pr_stock" type="number">
    <div class="text-center mt-24">
      <button class="btn" onclick="creerProduit()">Ajouter</button>
      <button class="btn btn-outline" onclick="fermerModal()">Annuler</button>
    </div>
  `);
}

async function creerProduit(){
  const nom = document.getElementById('pr_nom').value.trim();
  const description = document.getElementById('pr_description').value.trim();
  const prix = parseFloat(document.getElementById('pr_prix').value || '0');
  const type = document.getElementById('pr_type').value;
  const stockVal = document.getElementById('pr_stock').value;
  const stock = stockVal ? parseInt(stockVal,10) : null;
  if(!nom || !prix){ alert("Merci de compléter le nom et le prix."); return; }
  await db.collection('boutique_produits').add({ nom, description, prix, type, stock });
  fermerModal();
  chargerBoutique();
}

async function supprimerProduit(id){
  if(!confirm("Supprimer ce produit ?")) return;
  await db.collection('boutique_produits').doc(id).delete();
  chargerBoutique();
}

/* ---------------------- ONGLETS (navigation) ---------------------- */
function activerOnglet(nom){
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === nom));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + nom));
  if(nom === 'membres') chargerMembres();
  if(nom === 'planning') chargerPlanning();
  if(nom === 'compta') chargerCompta();
  if(nom === 'boutique') chargerBoutique();
  if(nom === 'motsdepasse' && typeof chargerVault === 'function') chargerVault();
}
