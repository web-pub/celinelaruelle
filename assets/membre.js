/* ===================================================================
   ESPACE MEMBRE — fiche parent, enfants, planning, boutique
   =================================================================== */

let membreUid = null;

async function initEspaceMembre(uid){
  membreUid = uid;
  await chargerFiche();
  await chargerEnfantsMembre();
  await chargerPlanningMembre();
  await chargerBoutiqueMembre();
}

async function chargerFiche(){
  const snap = await db.collection('membres').doc(membreUid).get();
  const m = snap.data();
  document.getElementById('ficheNom').value = m.nom || '';
  document.getElementById('fichePrenom').value = m.prenom || '';
  document.getElementById('ficheEmail').value = m.email || '';
  document.getElementById('ficheTelephone').value = m.telephone || '';
}

async function enregistrerFiche(){
  const nom = document.getElementById('ficheNom').value.trim();
  const prenom = document.getElementById('fichePrenom').value.trim();
  const email = document.getElementById('ficheEmail').value.trim();
  const telephone = document.getElementById('ficheTelephone').value.trim();
  if(!nom || !prenom || !email){ afficherAlerte('alerteFiche', "Nom, prénom et email sont obligatoires."); return; }
  await db.collection('membres').doc(membreUid).update({ nom, prenom, email, telephone });
  afficherAlerte('alerteFiche', "Fiche mise à jour.", 'ok');
  setTimeout(() => masquerAlerte('alerteFiche'), 3000);
}

async function chargerEnfantsMembre(){
  const zone = document.getElementById('listeEnfantsMembre');
  const snap = await db.collection('enfants').where('membreId','==',membreUid).get();
  if(snap.empty){ zone.innerHTML = '<p class="small-muted">Aucun enfant enregistré pour le moment.</p>'; return; }
  let html = '';
  const ids = [];
  snap.forEach(doc => {
    const e = doc.data();
    ids.push(doc.id);
    html += `<div class="card mt-24">
      <h3 style="margin-bottom:2px;">${e.prenom} ${e.nom}</h3>
      <p class="small-muted">Né(e) le ${e.dateNaissance || '—'} · ${e.ecole || '—'} · ${e.classe || '—'}</p>
      <div class="divider"></div>
      <strong>Journal de classe</strong>
      <p class="small-muted" style="margin-top:2px;">Le suivi de Céline, mis à jour au fil de l'accompagnement.</p>
      <div id="journalParent_${doc.id}" class="mt-24"><p class="small-muted">Chargement...</p></div>
    </div>`;
  });
  zone.innerHTML = html;
  ids.forEach(id => chargerJournalEnfant(id, 'journalParent_' + id));
}

function ouvrirModalAjoutEnfant(){
  ouvrirModal(`
    <h2>Ajouter un enfant</h2>
    <label>Nom <span class="req">*</span></label><input id="en_nom">
    <label>Prénom <span class="req">*</span></label><input id="en_prenom">
    <label>Date de naissance</label><input id="en_naissance" type="date">
    <label>École</label><input id="en_ecole">
    <label>Classe</label><input id="en_classe">
    <p class="note-obligatoire"><span class="req">*</span> Champs obligatoires</p>
    <div class="text-center mt-24">
      <button class="btn" onclick="creerEnfant()">Ajouter</button>
      <button class="btn btn-outline" onclick="fermerModal()">Annuler</button>
    </div>
  `);
}

async function creerEnfant(){
  const nom = document.getElementById('en_nom').value.trim();
  const prenom = document.getElementById('en_prenom').value.trim();
  const dateNaissance = document.getElementById('en_naissance').value;
  const ecole = document.getElementById('en_ecole').value.trim();
  const classe = document.getElementById('en_classe').value.trim();
  if(!nom || !prenom){ alert("Merci de compléter au moins le nom et le prénom."); return; }
  await db.collection('enfants').add({ membreId: membreUid, nom, prenom, dateNaissance, ecole, classe, suivi: [] });
  fermerModal();
  chargerEnfantsMembre();
}

async function chargerPlanningMembre(){
  const zone = document.getElementById('listePlanningMembre');
  const snap = await db.collection('planning_disponibilites').orderBy('date','asc').get();
  if(snap.empty){ zone.innerHTML = '<p class="small-muted">Aucun créneau disponible pour le moment.</p>'; return; }

  let rows = '';
  for(const doc of snap.docs){
    const p = doc.data();
    const resaSnap = await db.collection('reservations').where('disponibiliteId','==',doc.id).where('statut','==','confirmee').get();
    const complet = resaSnap.size >= p.placesMax;
    const dejaReserve = resaSnap.docs.some(r => r.data().membreId === membreUid);
    rows += `<tr>
      <td>${p.date}</td><td>${p.heureDebut} - ${p.heureFin}</td><td>${resaSnap.size} / ${p.placesMax}</td>
      <td>${dejaReserve ? '<span class="pill pill-valide">Réservé</span>' :
          complet ? '<span class="pill pill-refuse">Complet</span>' :
          `<button class="btn btn-sm" onclick="reserverCreneau('${doc.id}')">Réserver</button>`}
      </td></tr>`;
  }
  zone.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Horaire</th><th>Places</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function reserverCreneau(disponibiliteId){
  await db.collection('reservations').add({
    membreId: membreUid, disponibiliteId, statut: 'confirmee',
    dateReservation: firebase.firestore.FieldValue.serverTimestamp()
  });
  chargerPlanningMembre();
}

async function chargerBoutiqueMembre(){
  const zone = document.getElementById('listeBoutiqueMembre');
  const snap = await db.collection('boutique_produits').get();
  if(snap.empty){ zone.innerHTML = '<p class="small-muted">Aucun produit disponible pour le moment.</p>'; return; }
  let html = '<div class="grid-3">';
  snap.forEach(doc => {
    const p = doc.data();
    html += `<div class="card">
      <h3>${p.nom}</h3>
      <p>${p.description || ''}</p>
      <p><strong>${p.prix} €</strong> — ${p.type === 'precommande' ? 'Précommande' : 'En stock'}</p>
      <button class="btn btn-sm" onclick="commanderProduit('${doc.id}','${p.nom.replace(/'/g,"’")}')">Commander</button>
    </div>`;
  });
  html += '</div>';
  zone.innerHTML = html;
}

async function commanderProduit(produitId, produitNom){
  const quantite = parseInt(prompt("Quantité souhaitée ?", "1") || '0', 10);
  if(!quantite || quantite < 1) return;
  const membreSnap = await db.collection('membres').doc(membreUid).get();
  const m = membreSnap.data();
  await db.collection('commandes').add({
    membreId: membreUid, membreNom: m.prenom + ' ' + m.nom,
    produitId, produitNom, quantite, statut: 'en_attente',
    date: new Date().toLocaleDateString('fr-BE')
  });
  alert("Commande envoyée ! Céline reviendra vers toi pour la confirmation.");
}
