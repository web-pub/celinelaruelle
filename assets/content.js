/* ===================================================================
   CONTENU DU SITE — remplace le texte par défaut par celui édité
   depuis l'onglet "Contenu" d'Admin/Super Admin, si disponible.
   Chaque élément avec data-content-key="xxx" est mis à jour si le
   champ "xxx" existe dans le document site_content/global.
   =================================================================== */
async function appliquerContenuSite(){
  try{
    const snap = await db.collection('site_content').doc('global').get();
    if(!snap.exists) return;
    const data = snap.data();
    document.querySelectorAll('[data-content-key]').forEach(el => {
      const key = el.dataset.contentKey;
      if(data[key]) el.textContent = data[key];
    });
  }catch(e){
    /* En cas d'erreur (hors ligne, règles...), on garde le texte par défaut du site. */
  }
}
document.addEventListener('DOMContentLoaded', appliquerContenuSite);
