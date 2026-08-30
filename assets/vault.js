/* ===================================================================
   ONGLET "MOTS DE PASSE" — visible UNIQUEMENT par le Super Admin (HeleneL)
   Tableau : Nom / Identifiant / Mot de passe / Rôle / Dernière connexion
   Les mots de passe sont affichés en clair directement (pas de masquage).
   =================================================================== */

async function chargerVault(){
  const zone = document.getElementById('listeVault');
  if(!zone) return;
  zone.innerHTML = '<p class="small-muted">Chargement...</p>';

  const snap = await db.collection('passwords_vault').get();
  if(snap.empty){ zone.innerHTML = '<p class="small-muted">Aucun compte enregistré.</p>'; return; }

  let rows = '';
  snap.forEach(doc => {
    const v = doc.data();
    rows += `<tr>
      <td>${(v.prenom || '') + ' ' + (v.nom || '')}</td>
      <td>${v.username}</td>
      <td>${v.motdepasse || '—'}</td>
      <td>${v.role}</td>
      <td>${formatDate(v.derniereConnexion)}</td>
      <td><button class="btn btn-sm btn-outline" onclick="reinitialiserMotDePasse('${doc.id}','${v.username}')">Réinitialiser</button></td>
    </tr>`;
  });
  zone.innerHTML = `
    <div class="toolbar">
      <span class="small-muted">Visible uniquement par HeleneL.</span>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Nom</th><th>Identifiant</th><th>Mot de passe</th><th>Rôle</th><th>Dernière connexion</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function reinitialiserMotDePasse(uid, username){
  const nouveau = prompt("Nouveau mot de passe pour " + username + " (6 caractères min., sans caractère spécial) :");
  if(!nouveau) return;
  if(nouveau.length < 6 || /[^a-zA-Z0-9]/.test(nouveau)){
    alert("Mot de passe invalide : 6 caractères minimum, sans caractère spécial.");
    return;
  }
  alert("⚠️ Pour des raisons de sécurité Firebase, la réinitialisation du mot de passe d'un autre compte doit être effectuée depuis la console Firebase (Authentication > " + username + " > Réinitialiser le mot de passe), ou en demandant au membre d'utiliser 'Mot de passe oublié' sur la page de connexion. Une fois fait, mets à jour la valeur ici :");
  const confirmerMaj = confirm("As-tu déjà changé le mot de passe dans la console Firebase ? Cliquer OK pour mettre à jour le tableau ci-dessous avec la nouvelle valeur.");
  if(confirmerMaj){
    await db.collection('passwords_vault').doc(uid).update({ motdepasse: nouveau });
    chargerVault();
  }
}
