/* ===================================================================
   ONGLET "MOTS DE PASSE" — visible UNIQUEMENT par le Super Admin (HeleneL)
   Tableau : Nom / Identifiant / Mot de passe / Rôle / Dernière connexion
   Masqués par défaut, icône œil pour afficher à la demande.
   =================================================================== */

const OEIL_OUVERT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const OEIL_BARRE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18"/><path d="M10.6 5.2A11 11 0 0 1 12 5c7 0 11 7 11 7a13.3 13.3 0 0 1-3.4 4M6.6 6.6C3.8 8.3 1 12 1 12s4 7 11 7a10.6 10.6 0 0 0 5-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

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
      <td>
        <span class="mdp-cell" data-mdp="${(v.motdepasse||'').replace(/"/g,'&quot;')}">••••••••</span>
        <button type="button" class="toggle-eye" style="padding:4px;" onclick="basculerUneLigneMdp(this)" aria-label="Afficher le mot de passe">${OEIL_OUVERT}</button>
      </td>
      <td>${v.role}</td>
      <td>${formatDate(v.derniereConnexion)}</td>
      <td><button class="btn btn-sm btn-outline" onclick="reinitialiserMotDePasse('${doc.id}','${v.username}')">Réinitialiser</button></td>
    </tr>`;
  });
  zone.innerHTML = `
    <div class="toolbar"><span class="small-muted">Visible uniquement par HeleneL. Cliquez sur l'œil pour révéler un mot de passe.</span></div>
    <div class="table-wrap"><table><thead><tr><th>Nom</th><th>Identifiant</th><th>Mot de passe</th><th>Rôle</th><th>Dernière connexion</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function basculerUneLigneMdp(btn){
  const span = btn.previousElementSibling;
  if(!span) return;
  const visible = span.textContent !== '••••••••';
  if(visible){ span.textContent = '••••••••'; btn.innerHTML = OEIL_OUVERT; }
  else { span.textContent = span.dataset.mdp || '—'; btn.innerHTML = OEIL_BARRE; }
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
