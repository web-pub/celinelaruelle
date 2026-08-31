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

const CATEGORIES_JOURNAL = ['Général','Devoirs','Comportement','Points positifs','À travailler'];

async function voirFicheMembre(membreId){
  const snap = await db.collection('membres').doc(membreId).get();
  const m = snap.data();
  const enfantsSnap = await db.collection('enfants').where('membreId','==',membreId).get();
  let enfantsHtml = '<p class="small-muted">Aucun enfant enregistré.</p>';
  if(!enfantsSnap.empty){
    enfantsHtml = '';
    for(const doc of enfantsSnap.docs){
      const e = doc.data();
      enfantsHtml += `<div class="card mt-24">
        <div class="toolbar" style="margin-bottom:8px;">
          <div><h3 style="margin:0;">${e.prenom} ${e.nom}</h3>
          <p class="small-muted" style="margin:2px 0 0;">Né(e) le ${e.dateNaissance || '—'} · ${e.ecole || '—'} · ${e.classe || '—'}</p></div>
          <button class="btn btn-sm" onclick="ouvrirModalEntreeJournal('${doc.id}','${membreId}')">+ Ajouter au journal</button>
        </div>
        <strong>Journal de classe</strong>
        <div id="journal_${doc.id}" class="mt-24"><p class="small-muted">Chargement...</p></div>
      </div>`;
    }
  }
  ouvrirModal(`
    <h2>Fiche membre</h2>
    <div id="alerteFicheAdmin" class="alert alert-error hidden"></div>
    <label>Nom <span class="req">*</span></label><input id="fa_nom" value="${(m.nom||'').replace(/"/g,'&quot;')}">
    <label>Prénom <span class="req">*</span></label><input id="fa_prenom" value="${(m.prenom||'').replace(/"/g,'&quot;')}">
    <label>Email <span class="req">*</span></label><input id="fa_email" type="email" value="${(m.email||'').replace(/"/g,'&quot;')}">
    <label>Téléphone</label><input id="fa_telephone" value="${(m.telephone||'').replace(/"/g,'&quot;')}">
    <p class="note-obligatoire"><span class="req">*</span> Champs obligatoires</p>
    <button class="btn btn-sm mt-24" onclick="enregistrerFicheAdmin('${membreId}')">Enregistrer la fiche</button>
    <p class="small-muted mt-24">Identifiant : ${m.username} · Dernière connexion : ${formatDate(m.derniereConnexion)}</p>
    <div class="divider"></div>
    <div class="toolbar">
      <h3 style="margin:0;">Enfants</h3>
      <button class="btn btn-sm" onclick="ouvrirModalAjoutEnfantAdmin('${membreId}')">+ Ajouter un enfant</button>
    </div>
    ${enfantsHtml}
    <div class="text-center mt-24"><button class="btn btn-outline" onclick="fermerModal()">Fermer</button></div>
  `);
  enfantsSnap.forEach(doc => chargerJournalEnfant(doc.id, 'journal_' + doc.id));
}

async function enregistrerFicheAdmin(membreId){
  const nom = document.getElementById('fa_nom').value.trim();
  const prenom = document.getElementById('fa_prenom').value.trim();
  const email = document.getElementById('fa_email').value.trim();
  const telephone = document.getElementById('fa_telephone').value.trim();
  if(!nom || !prenom || !email){ afficherAlerte('alerteFicheAdmin', "Nom, prénom et email sont obligatoires."); return; }
  await db.collection('membres').doc(membreId).update({ nom, prenom, email, telephone });
  fermerModal();
  voirFicheMembre(membreId);
  chargerMembres();
}

function ouvrirModalAjoutEnfantAdmin(membreId){
  ouvrirModal(`
    <h2>Ajouter un enfant</h2>
    <div id="alerteModal" class="alert alert-error hidden"></div>
    <label>Nom <span class="req">*</span></label><input id="ea_nom">
    <label>Prénom <span class="req">*</span></label><input id="ea_prenom">
    <label>Date de naissance</label><input id="ea_naissance" type="date">
    <label>École</label><input id="ea_ecole">
    <label>Classe</label><input id="ea_classe">
    <p class="note-obligatoire"><span class="req">*</span> Champs obligatoires</p>
    <div class="text-center mt-24">
      <button class="btn" onclick="creerEnfantAdmin('${membreId}')">Ajouter</button>
      <button class="btn btn-outline" onclick="fermerModal(); voirFicheMembre('${membreId}');">Annuler</button>
    </div>
  `);
}

async function creerEnfantAdmin(membreId){
  const nom = document.getElementById('ea_nom').value.trim();
  const prenom = document.getElementById('ea_prenom').value.trim();
  const dateNaissance = document.getElementById('ea_naissance').value;
  const ecole = document.getElementById('ea_ecole').value.trim();
  const classe = document.getElementById('ea_classe').value.trim();
  if(!nom || !prenom){ afficherAlerte('alerteModal', "Nom et prénom sont obligatoires."); return; }
  await db.collection('enfants').add({ membreId, nom, prenom, dateNaissance, ecole, classe });
  fermerModal();
  voirFicheMembre(membreId);
}

async function chargerJournalEnfant(enfantId, containerId){
  const zone = document.getElementById(containerId);
  if(!zone) return;
  const snap = await db.collection('journal_entries').where('enfantId','==',enfantId).orderBy('dateCreation','desc').get();
  if(snap.empty){ zone.innerHTML = '<p class="small-muted">Aucune entrée pour le moment.</p>'; return; }
  let html = '<div class="journal-timeline">';
  snap.forEach(doc => {
    const j = doc.data();
    html += `<div class="journal-entry">
      <div class="journal-entry-head">
        <span class="pill pill-categorie">${j.categorie}</span>
        <span class="small-muted">${j.dateAffichage} — ${j.auteur}</span>
      </div>
      <p>${j.contenu}</p>
    </div>`;
  });
  html += '</div>';
  zone.innerHTML = html;
}

function ouvrirModalEntreeJournal(enfantId, membreId){
  const options = CATEGORIES_JOURNAL.map(c => `<option value="${c}">${c}</option>`).join('');
  ouvrirModal(`
    <h2>Ajouter au journal de classe</h2>
    <div id="alerteModal" class="alert alert-error hidden"></div>
    <label>Catégorie</label>
    <select id="jr_categorie">${options}</select>
    <label>Contenu</label>
    <textarea id="jr_contenu" rows="4" placeholder="Ce qui s'est passé, les progrès observés, les points d'attention..."></textarea>
    <div class="text-center mt-24">
      <button class="btn" onclick="enregistrerEntreeJournal('${enfantId}','${membreId}')">Enregistrer</button>
      <button class="btn btn-outline" onclick="fermerModal(); voirFicheMembre('${membreId}')">Annuler</button>
    </div>
  `);
}

async function enregistrerEntreeJournal(enfantId, membreId){
  const categorie = document.getElementById('jr_categorie').value;
  const contenu = document.getElementById('jr_contenu').value.trim();
  if(!contenu){ afficherAlerte('alerteModal', "Merci de décrire l'entrée du journal."); return; }
  await db.collection('journal_entries').add({
    enfantId, membreId, categorie, contenu, auteur: 'Céline',
    dateAffichage: new Date().toLocaleDateString('fr-BE'),
    dateCreation: firebase.firestore.FieldValue.serverTimestamp()
  });
  fermerModal();
  voirFicheMembre(membreId);
}

function ouvrirModalAjoutMembre(){
  ouvrirModal(`
    <h2>Ajouter un membre</h2>
    <div id="alerteModal" class="alert alert-error hidden"></div>
    <label>Nom <span class="req">*</span></label><input id="am_nom">
    <label>Prénom <span class="req">*</span></label><input id="am_prenom">
    <label>Email <span class="req">*</span></label><input id="am_email" type="email">
    <label>Téléphone</label><input id="am_telephone">
    <label>Identifiant <span class="req">*</span></label><input id="am_username">
    <label>Mot de passe (6 caractères min., sans caractère spécial) <span class="req">*</span></label>
    <div class="password-wrap">
      <input id="am_motdepasse" type="password">
      <button type="button" class="toggle-eye" onclick="togglePw('am_motdepasse', this)" aria-label="Afficher le mot de passe"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg></button>
    </div>
    <p class="note-obligatoire"><span class="req">*</span> Champs obligatoires</p>
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
    const amo = a.amortissable ? `Amorti sur ${a.dureeAns} an(s)` : 'Charge directe';
    rowsA += `<tr><td>${a.date}</td><td>${a.fournisseur}</td><td>${a.montantTVAC} €</td><td>${a.categorie}</td><td>${a.deductibilite}%</td><td>${amo}</td></tr>`;
  });
  zoneAchats.innerHTML = achatsSnap.empty ? '<p class="small-muted">Aucun achat enregistré.</p>' :
    `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Fournisseur</th><th>Montant TVAC</th><th>Catégorie</th><th>Déductibilité</th><th>Amortissement</th></tr></thead><tbody>${rowsA}</tbody></table></div>`;

  const ventesSnap = await db.collection('compta_ventes').orderBy('date','desc').get();
  let rowsV = '';
  ventesSnap.forEach(doc => {
    const v = doc.data();
    rowsV += `<tr><td>${v.numeroFacture}</td><td>${v.date}</td><td>${v.client}</td><td>${v.description}</td><td>${v.montant} €</td></tr>`;
  });
  zoneVentes.innerHTML = ventesSnap.empty ? '<p class="small-muted">Aucune vente enregistrée.</p>' :
    `<div class="table-wrap"><table><thead><tr><th>N° facture</th><th>Date</th><th>Client</th><th>Description</th><th>Montant</th></tr></thead><tbody>${rowsV}</tbody></table></div>`;

  const selectAnnee = document.getElementById('pl_annee');
  if(selectAnnee && !selectAnnee.dataset.rempli){
    selectAnnee.innerHTML = genererOptionsAnnees();
    selectAnnee.dataset.rempli = '1';
  }
  calculerPL();
  chargerParametresCategories();
}

/* ---- Catégories de charges (nom, % déductibilité, amortissement) ---- */
/* Gérées dans la section "Paramètres" repliable en bas de l'onglet Compta */
async function recupererCategories(){
  const snap = await db.collection('compta_categories').orderBy('nom').get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function chargerParametresCategories(){
  const zone = document.getElementById('listeCategories');
  if(!zone) return;
  const categories = await recupererCategories();
  let rows = categories.map(c => `<tr>
    <td>${c.nom}</td><td>${c.deductibilite}%</td>
    <td>${c.amortissable ? 'Oui — ' + c.dureeAns + ' an(s)' : 'Non'}</td>
    <td><button class="btn btn-sm btn-danger" onclick="supprimerCategorie('${c.id}')">Supprimer</button></td>
  </tr>`).join('');
  if(!rows) rows = '<tr><td colspan="4" class="small-muted">Aucune catégorie pour le moment.</td></tr>';
  zone.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Nom</th><th>Déductibilité</th><th>Amortissement</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function creerCategorie(){
  const nom = document.getElementById('cat_nom').value.trim();
  const deductibilite = parseFloat(document.getElementById('cat_deductibilite').value || '100');
  const amortissable = document.getElementById('cat_amortissable').checked;
  const dureeAns = amortissable ? parseInt(document.getElementById('cat_duree').value || '1', 10) : 1;
  if(!nom){ afficherAlerte('alerteCategorie', "Merci de donner un nom à la catégorie."); return; }
  await db.collection('compta_categories').add({ nom, deductibilite, amortissable, dureeAns });
  document.getElementById('cat_nom').value = '';
  document.getElementById('cat_deductibilite').value = '100';
  document.getElementById('cat_amortissable').checked = false;
  document.getElementById('cat_duree_wrap').classList.add('hidden');
  masquerAlerte('alerteCategorie');
  chargerParametresCategories();
}

async function supprimerCategorie(id){
  if(!confirm("Supprimer cette catégorie ? (les achats déjà enregistrés ne sont pas modifiés)")) return;
  await db.collection('compta_categories').doc(id).delete();
  chargerParametresCategories();
}

/* ---- Achats ---- */
async function ouvrirModalAchat(){
  const categories = await recupererCategories();
  const options = categories.length
    ? categories.map(c => `<option value="${c.id}">${c.nom} (${c.deductibilite}%${c.amortissable ? ', amorti sur '+c.dureeAns+' an(s)' : ''})</option>`).join('')
    : '<option value="">— Aucune catégorie —</option>';
  ouvrirModal(`
    <h2>Ajouter un achat</h2>
    <div id="alerteModal" class="alert alert-error hidden"></div>
    <label>Date</label><input id="ac_date" type="date" value="${new Date().toISOString().slice(0,10)}">
    <label>Fournisseur</label><input id="ac_fournisseur">
    <label>Montant TVAC (€)</label><input id="ac_montant" type="number" step="0.01">
    <label>Catégorie</label>
    <select id="ac_categorie">${options}</select>
    ${categories.length ? '' : '<p class="small-muted">Aucune catégorie créée : ferme cette fenêtre et ouvre "Paramètres" en bas de la page Compta pour en ajouter une.</p>'}
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
  const categorieId = document.getElementById('ac_categorie').value;
  if(!fournisseur || !montantTVAC){ afficherAlerte('alerteModal', "Merci de compléter le fournisseur et le montant."); return; }
  if(!categorieId){ afficherAlerte('alerteModal', "Merci de choisir une catégorie (à créer dans Paramètres si besoin)."); return; }

  const catSnap = await db.collection('compta_categories').doc(categorieId).get();
  const cat = catSnap.data();
  await db.collection('compta_achats').add({
    date, fournisseur, montantTVAC,
    categorie: cat.nom, deductibilite: cat.deductibilite,
    amortissable: cat.amortissable, dureeAns: cat.dureeAns
  });
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

/* ---------------------- ONGLET BLOG ---------------------- */
async function chargerBlog(){
  const zone = document.getElementById('listeArticles');
  if(!zone) return;
  zone.innerHTML = '<p class="small-muted">Chargement...</p>';
  const snap = await db.collection('blog_articles').orderBy('dateCreation','desc').get();
  if(snap.empty){ zone.innerHTML = '<p class="small-muted">Aucun article pour le moment.</p>'; return; }
  let rows = '';
  snap.forEach(doc => {
    const a = doc.data();
    rows += `<tr>
      <td>${a.titre}</td>
      <td>${a.publie ? '<span class="pill pill-valide">Publié</span>' : '<span class="pill pill-attente">Brouillon</span>'}</td>
      <td>${a.dateAffichage || '—'}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="ouvrirModalArticle('${doc.id}')">Modifier</button>
        <button class="btn btn-sm" onclick="basculerPublicationArticle('${doc.id}', ${!a.publie})">${a.publie ? 'Dépublier' : 'Publier'}</button>
        <button class="btn btn-sm btn-danger" onclick="supprimerArticle('${doc.id}')">Supprimer</button>
      </td>
    </tr>`;
  });
  zone.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Titre</th><th>Statut</th><th>Date</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function ouvrirModalArticle(articleId){
  let a = { titre:'', contenu:'' };
  if(articleId){
    const snap = await db.collection('blog_articles').doc(articleId).get();
    a = snap.data();
  }
  ouvrirModal(`
    <h2>${articleId ? 'Modifier' : 'Nouvel'} article</h2>
    <div id="alerteModal" class="alert alert-error hidden"></div>
    <label>Titre</label><input id="bl_titre" value="${(a.titre||'').replace(/"/g,'&quot;')}">
    <label>Contenu</label><textarea id="bl_contenu" rows="8">${a.contenu||''}</textarea>
    <div class="text-center mt-24">
      <button class="btn" onclick="enregistrerArticle('${articleId||''}')">Enregistrer</button>
      <button class="btn btn-outline" onclick="fermerModal()">Annuler</button>
    </div>
  `);
}

async function enregistrerArticle(articleId){
  const titre = document.getElementById('bl_titre').value.trim();
  const contenu = document.getElementById('bl_contenu').value.trim();
  if(!titre || !contenu){ afficherAlerte('alerteModal', "Merci de compléter le titre et le contenu."); return; }
  const dateAffichage = new Date().toLocaleDateString('fr-BE');
  if(articleId){
    await db.collection('blog_articles').doc(articleId).update({ titre, contenu });
  }else{
    await db.collection('blog_articles').add({
      titre, contenu, publie:false, dateAffichage,
      dateCreation: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  fermerModal();
  chargerBlog();
}

async function basculerPublicationArticle(articleId, publie){
  await db.collection('blog_articles').doc(articleId).update({ publie });
  chargerBlog();
}

async function supprimerArticle(articleId){
  if(!confirm("Supprimer définitivement cet article ?")) return;
  await db.collection('blog_articles').doc(articleId).delete();
  chargerBlog();
}

/* ---------------------- ONGLET LIVRES ---------------------- */
async function chargerLivres(){
  const zone = document.getElementById('listeLivres');
  if(!zone) return;
  zone.innerHTML = '<p class="small-muted">Chargement...</p>';
  const snap = await db.collection('livres').orderBy('dateCreation','desc').get();
  if(snap.empty){ zone.innerHTML = '<p class="small-muted">Aucun livre pour le moment.</p>'; return; }
  const statutLabel = { bientot:'Bientôt disponible', precommande:'Précommande ouverte', disponible:'Disponible' };
  let rows = '';
  snap.forEach(doc => {
    const l = doc.data();
    rows += `<tr>
      <td>${l.titre}${l.code ? '<br><span class="small-muted">'+l.code+'</span>' : ''}</td>
      <td>${statutLabel[l.statut] || l.statut}</td>
      <td>${l.prix ? l.prix + ' €' : '—'}</td>
      <td>${l.publie ? '<span class="pill pill-valide">Publié</span>' : '<span class="pill pill-attente">Brouillon</span>'}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="ouvrirModalLivre('${doc.id}')">Modifier</button>
        <button class="btn btn-sm" onclick="basculerPublicationLivre('${doc.id}', ${!l.publie})">${l.publie ? 'Dépublier' : 'Publier'}</button>
        <button class="btn btn-sm btn-danger" onclick="supprimerLivre('${doc.id}')">Supprimer</button>
      </td>
    </tr>`;
  });
  zone.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Titre</th><th>Statut</th><th>Prix</th><th>Publication</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function ouvrirModalLivre(livreId){
  let l = { titre:'', description:'', statut:'bientot', prix:'', code:'', couverture:'assets/livre-cover.jpg' };
  if(livreId){
    const snap = await db.collection('livres').doc(livreId).get();
    l = snap.data();
  }
  ouvrirModal(`
    <h2>${livreId ? 'Modifier' : 'Nouveau'} livre</h2>
    <div id="alerteModal" class="alert alert-error hidden"></div>
    <label>Titre</label><input id="lv_titre" value="${(l.titre||'').replace(/"/g,'&quot;')}">
    <label>Description</label><textarea id="lv_description" rows="6">${l.description||''}</textarea>
    <label>Statut</label>
    <select id="lv_statut">
      <option value="bientot" ${l.statut==='bientot'?'selected':''}>Bientôt disponible</option>
      <option value="precommande" ${l.statut==='precommande'?'selected':''}>Précommande ouverte</option>
      <option value="disponible" ${l.statut==='disponible'?'selected':''}>Disponible</option>
    </select>
    <label>Prix (€, optionnel)</label><input id="lv_prix" type="number" step="0.01" value="${l.prix||''}">
    <label>Code du livre (ISBN ou référence interne)</label><input id="lv_code" value="${(l.code||'').replace(/"/g,'&quot;')}">
    <label>Image de couverture (chemin dans assets/)</label><input id="lv_couverture" value="${l.couverture||'assets/livre-cover.jpg'}">
    <p class="field-hint">Le fichier de couverture est déjà dans assets/livre-cover.jpg — laisse ce champ tel quel sauf si tu ajoutes une autre image.</p>
    <div class="text-center mt-24">
      <button class="btn" onclick="enregistrerLivre('${livreId||''}')">Enregistrer</button>
      <button class="btn btn-outline" onclick="fermerModal()">Annuler</button>
    </div>
  `);
}

async function enregistrerLivre(livreId){
  const titre = document.getElementById('lv_titre').value.trim();
  const description = document.getElementById('lv_description').value.trim();
  const statut = document.getElementById('lv_statut').value;
  const prixVal = document.getElementById('lv_prix').value;
  const prix = prixVal ? parseFloat(prixVal) : null;
  const code = document.getElementById('lv_code').value.trim();
  const couverture = document.getElementById('lv_couverture').value.trim() || 'assets/livre-cover.jpg';
  if(!titre || !description){ afficherAlerte('alerteModal', "Merci de compléter le titre et la description."); return; }
  if(livreId){
    await db.collection('livres').doc(livreId).update({ titre, description, statut, prix, code, couverture });
  }else{
    await db.collection('livres').add({
      titre, description, statut, prix, code, couverture, publie:false,
      dateCreation: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  fermerModal();
  chargerLivres();
}

async function basculerPublicationLivre(livreId, publie){
  await db.collection('livres').doc(livreId).update({ publie });
  chargerLivres();
}

async function supprimerLivre(livreId){
  if(!confirm("Supprimer définitivement ce livre ?")) return;
  await db.collection('livres').doc(livreId).delete();
  chargerLivres();
}

/* ---- P&L simplifié ---- */
async function calculerPL(){
  const zone = document.getElementById('resultatPL');
  if(!zone) return;
  const select = document.getElementById('pl_annee');
  const annee = parseInt((select ? select.value : '') || new Date().getFullYear(), 10);

  const [achatsSnap, ventesSnap] = await Promise.all([
    db.collection('compta_achats').get(),
    db.collection('compta_ventes').get()
  ]);

  let totalVentes = 0;
  ventesSnap.forEach(doc => {
    const v = doc.data();
    if(new Date(v.date).getFullYear() === annee) totalVentes += v.montant;
  });

  let totalCharges = 0;
  achatsSnap.forEach(doc => {
    const a = doc.data();
    const anneeAchat = new Date(a.date).getFullYear();
    const deduct = (a.deductibilite ?? 100) / 100;
    if(a.amortissable){
      const duree = a.dureeAns || 1;
      if(annee >= anneeAchat && annee < anneeAchat + duree){
        totalCharges += (a.montantTVAC / duree) * deduct;
      }
    }else{
      if(anneeAchat === annee) totalCharges += a.montantTVAC * deduct;
    }
  });

  const resultat = totalVentes - totalCharges;
  zone.innerHTML = `
    <div class="grid-3">
      <div class="stat-card"><span class="stat-number">${totalVentes.toFixed(2)} €</span><p>Ventes ${annee}</p></div>
      <div class="stat-card"><span class="stat-number">${totalCharges.toFixed(2)} €</span><p>Charges déductibles ${annee}</p></div>
      <div class="stat-card"><span class="stat-number" style="color:${resultat>=0?'var(--ok)':'var(--error)'};">${resultat.toFixed(2)} €</span><p>Résultat net simplifié</p></div>
    </div>`;
}

function genererOptionsAnnees(){
  const courante = new Date().getFullYear();
  let options = '';
  for(let a = courante; a >= courante - 5; a--){
    options += `<option value="${a}">${a}</option>`;
  }
  return options;
}

/* ---------------------- ONGLET CONTENU DU SITE ---------------------- */
const CHAMPS_CONTENU = [
  { section:'Accueil', champs:[
    { cle:'accueil_eyebrow', label:'Accroche (au-dessus du titre)', type:'input' },
    { cle:'accueil_lead', label:'Texte sous le titre', type:'textarea' },
    { cle:'accueil_stat1_nombre', label:'Chiffre clé 1', type:'input' },
    { cle:'accueil_stat1_texte', label:'Texte chiffre clé 1', type:'input' },
    { cle:'accueil_stat2_nombre', label:'Chiffre clé 2', type:'input' },
    { cle:'accueil_stat2_texte', label:'Texte chiffre clé 2', type:'input' },
    { cle:'accueil_stat3_nombre', label:'Chiffre clé 3', type:'input' },
    { cle:'accueil_stat3_texte', label:'Texte chiffre clé 3', type:'input' },
    { cle:'accueil_citation', label:'Citation mise en avant', type:'textarea' },
  ]},
  { section:'Qui suis-je', champs:[
    { cle:'qsj_intro', label:'Paragraphes d\'introduction (parcours)', type:'textarea', grand:true },
    { cle:'qsj_vocation', label:'Section "Une vocation"', type:'textarea', grand:true },
    { cle:'qsj_perso', label:'Section "Et côté perso ?"', type:'textarea', grand:true },
    { cle:'qsj_citation', label:'Citation "Et côté perso"', type:'textarea' },
    { cle:'qsj_footer', label:'Ligne récapitulative en bas de la carte', type:'input' },
  ]},
  { section:'Accompagnement', champs:[
    { cle:'acc_service1_titre', label:'Titre service 1', type:'input' },
    { cle:'acc_service1_texte', label:'Texte service 1', type:'textarea' },
    { cle:'acc_service2_titre', label:'Titre service 2', type:'input' },
    { cle:'acc_service2_texte', label:'Texte service 2', type:'textarea' },
    { cle:'acc_service3_titre', label:'Titre service 3', type:'input' },
    { cle:'acc_service3_texte', label:'Texte service 3', type:'textarea' },
    { cle:'acc_pourqui', label:'Section "Pour qui ?"', type:'textarea', grand:true },
  ]},
  { section:'Contact', champs:[
    { cle:'contact_lead', label:'Texte sous le titre de la page Contact', type:'textarea' },
  ]},
];

async function chargerContenuSite(){
  const zone = document.getElementById('listeContenu');
  if(!zone) return;
  zone.innerHTML = '<p class="small-muted">Chargement...</p>';

  const snap = await db.collection('site_content').doc('global').get();
  const data = snap.exists ? snap.data() : {};

  let html = `<div id="alerteContenu" class="alert alert-error hidden"></div>
    <p class="small-muted mb-24">Laisse un champ vide pour garder le texte par défaut du site. Ce contenu est visible sur les pages publiques dès l'enregistrement.</p>`;

  CHAMPS_CONTENU.forEach(section => {
    html += `<details class="settings-block mt-24" open><summary>${section.section}</summary><div class="mt-24">`;
    section.champs.forEach(c => {
      const val = (data[c.cle] || '').replace(/"/g,'&quot;');
      if(c.type === 'input'){
        html += `<label>${c.label}</label><input id="sc_${c.cle}" value="${val}">`;
      }else{
        html += `<label>${c.label}</label><textarea id="sc_${c.cle}" rows="${c.grand ? 6 : 3}">${data[c.cle] || ''}</textarea>`;
      }
    });
    html += `</div></details>`;
  });

  html += `<div class="text-center mt-24"><button class="btn" onclick="enregistrerContenuSite()">Enregistrer le contenu</button></div>`;
  zone.innerHTML = html;
}

async function enregistrerContenuSite(){
  const donnees = {};
  CHAMPS_CONTENU.forEach(section => {
    section.champs.forEach(c => {
      const el = document.getElementById('sc_' + c.cle);
      if(el) donnees[c.cle] = el.value.trim();
    });
  });
  try{
    await db.collection('site_content').doc('global').set(donnees, { merge:true });
    afficherAlerte('alerteContenu', "Contenu enregistré.", 'ok');
    setTimeout(() => masquerAlerte('alerteContenu'), 3000);
  }catch(err){
    afficherAlerte('alerteContenu', traduireErreur(err));
  }
}

/* ---------------------- ONGLETS (navigation) ---------------------- */
function activerOnglet(nom){
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === nom));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + nom));
  if(nom === 'membres') chargerMembres();
  if(nom === 'planning') chargerPlanning();
  if(nom === 'compta') chargerCompta();
  if(nom === 'boutique') chargerBoutique();
  if(nom === 'blog') chargerBlog();
  if(nom === 'livres') chargerLivres();
  if(nom === 'contenu') chargerContenuSite();
  if(nom === 'motsdepasse' && typeof chargerVault === 'function') chargerVault();
}
