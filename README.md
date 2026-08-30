# Site Céline Laruelle — Coach scolaire

Version : **celinelaruelle V03**
Projet Firebase : **celinelaruellecoach** — Dépôt GitHub : **celinelaruelle**

Structure volontairement plate (aucun sous-dossier, à part `assets/` qui contient tout directement) :
```
index.html, login.html, inscription.html, admin.html, super.html, membre.html,
mentions-legales.html, rgpd.html, cgv.html, firestore.rules, README.md
assets/style.css
assets/firebase-config.js, version.js, auth.js, dashboard-common.js, vault.js, membre.js
```

Site en deux parties :
- **Partie publique** (`index.html`) : vitrine "publicitaire", ton sobre et élégant, crème/brun/taupe.
- **Partie privée** : connexion par identifiant + mot de passe, 3 niveaux :
  - **Super Admin** : `HeleneL` / `Helene123` → `super.html`
  - **Admin** : `Celine` / `Celine4500` → `admin.html`
  - **Membre** : créé via demande sur `inscription.html`, validée par l'Admin → `membre.html`

## 1. Mise en place Firebase

1. Le projet Firebase **celinelaruellecoach** est déjà créé, et ses clés sont déjà collées dans `assets/js/firebase-config.js`.
2. **Authentication > Sign-in method** → active **Email/Password**.
3. **Firestore Database** → crée la base en mode production (les règles sont dans `firestore.rules`, à coller dans l'onglet "Règles").

## 2. Créer les deux premiers comptes (Super Admin + Admin)

Ces deux comptes doivent être créés une seule fois, à la main, car aucun compte n'existe encore pour valider les autres :

1. **Authentication > Users > Ajouter un utilisateur** :
   - Email : `helenel@celinelaruelle.local` / mot de passe : `Helene123`
   - Email : `celine@celinelaruelle.local` / mot de passe : `Celine4500`
2. Note l'UID généré pour chacun.
3. Dans **Firestore**, crée à la main :
   - `users/{UID_HeleneL}` → `{ username: "HeleneL", role: "superadmin", email: "", derniereConnexion: null }`
   - `users/{UID_Celine}` → `{ username: "Celine", role: "admin", email: "", derniereConnexion: null }`
   - `passwords_vault/{UID_HeleneL}` → `{ nom: "Laruelle", prenom: "Hélène", username: "HeleneL", motdepasse: "Helene123", role: "superadmin", derniereConnexion: null }`
   - `passwords_vault/{UID_Celine}` → `{ nom: "Laruelle", prenom: "Céline", username: "Celine", motdepasse: "Celine4500", role: "admin", derniereConnexion: null }`

Une fois connectée, HeleneL peut ajouter d'autres admins/membres directement depuis l'interface.

## 3. Déploiement sur GitHub Pages

1. Crée un repo GitHub nommé `celinelaruelle`.
2. Dépose tout le contenu de ce ZIP à la racine du repo.
3. **Settings > Pages** → source : branche `main`, dossier `/ (root)`.
4. Le site est ensuite accessible à `https://<ton-compte>.github.io/celinelaruelle/`.

## 4. Collections Firestore

### `users`
| Champ | Type | Description |
|---|---|---|
| username | string | identifiant de connexion |
| role | string | `superadmin` \| `admin` \| `membre` |
| email | string | email de contact |
| derniereConnexion | timestamp | mise à jour à chaque connexion |
| dateCreation | timestamp | date de création du compte |

### `passwords_vault` (lecture réservée au Super Admin)
| Champ | Type | Description |
|---|---|---|
| nom, prenom | string | identité |
| username | string | identifiant |
| motdepasse | string | mot de passe en clair (voir note sécurité ci-dessous) |
| role | string | rôle du compte |
| derniereConnexion | timestamp | dernière connexion |

### `membres`
| Champ | Type | Description |
|---|---|---|
| nom, prenom, email, telephone | string | coordonnées du parent |
| username | string | identifiant de connexion |
| raisonInitiale | string | motif renseigné à l'inscription |
| derniereConnexion, dateCreation | timestamp | suivi |

### `enfants`
| Champ | Type | Description |
|---|---|---|
| membreId | string | UID du parent |
| nom, prenom, dateNaissance, ecole, classe | string | identité de l'enfant |
| suivi | array | liste de `{ date, note }` ajoutées par Céline |

### `planning_disponibilites`
| Champ | Type | Description |
|---|---|---|
| date | string (AAAA-MM-JJ) | date du créneau |
| heureDebut, heureFin | string | horaires |
| placesMax | number | places disponibles |

### `reservations`
| Champ | Type | Description |
|---|---|---|
| membreId | string | UID du membre |
| disponibiliteId | string | référence au créneau |
| statut | string | `confirmee` |
| dateReservation | timestamp | date de la réservation |

### `compta_achats`
| Champ | Type | Description |
|---|---|---|
| date | string | date de l'achat |
| fournisseur | string | fournisseur |
| montantTVAC | number | montant TVAC |
| categorie | string | catégorie de frais |
| deductibilite | number | % déductible (100 par défaut, 67 pour restaurant) |

### `compta_ventes`
| Champ | Type | Description |
|---|---|---|
| numeroFacture | string | ex. "2026 001" (compteur annuel automatique) |
| date, client, description, montant | — | détails de la vente |

### `boutique_produits`
| Champ | Type | Description |
|---|---|---|
| nom, description, prix | — | fiche produit |
| type | string | `precommande` \| `stock` |
| stock | number/null | stock restant |

### `commandes`
| Champ | Type | Description |
|---|---|---|
| membreId, membreNom, produitId, produitNom, quantite | — | commande |
| statut | string | `en_attente`, à faire évoluer manuellement dans Firestore |
| date | string | date de commande |

### `demandes_inscription`
| Champ | Type | Description |
|---|---|---|
| nom, prenom, email, telephone, raison | string | infos du formulaire public |
| username, motdepasse | string | identifiants choisis (supprimés idéalement une fois le compte créé) |
| statut | string | `en_attente` \| `valide` \| `refuse` |

### `config`
| Document | Description |
|---|---|
| `compteur_factures_<année>` | compteur auto-incrémenté pour la numérotation des factures |

### `connexions_log`
| Champ | Type | Description |
|---|---|---|
| uid, username, role | — | qui s'est connecté |
| date | timestamp | quand |

## 5. Notes de sécurité importantes

- Les mots de passe en clair dans `passwords_vault` ne sont lisibles que par le compte **HeleneL** (règle Firestore dédiée). Comme convenu, ce site ne contient pas d'informations sensibles ; ce compromis reste néanmoins un risque technique si le compte Super Admin était compromis.
- **Réinitialisation de mot de passe d'un autre compte** : Firebase (SDK client, sans backend) ne permet pas de changer le mot de passe d'un autre utilisateur directement. Deux options :
  1. Le membre utilise "mot de passe oublié" (à ajouter si souhaité) ;
  2. HeleneL réinitialise depuis la console Firebase (Authentication), puis met à jour la valeur affichée dans l'onglet "Mots de passe".
  Une évolution possible : ajouter une Cloud Function pour automatiser cela complètement.
- Toute page privée vérifie le rôle avant d'afficher quoi que ce soit (`protegerPage` dans `auth.js`).

## 6. Versions

Chaque nouvelle livraison est fournie en ZIP nommé `celinelaruelle_V0X.zip`, avec :
- Le numéro de version mis à jour dans `assets/js/version.js` (affiché sur Admin et Super Admin) et en en-tête de `firestore.rules`.
- Les règles Firestore à jour, à recoller dans la console Firebase.

## 7. Informations légales du site

Céline Laruelle — Rue Vergiers 66, 4500 Huy — BCE 0797006834 (non assujettie à la TVA).
Copyright © Céline Laruelle. Copie du site et du code interdite (mentions légales sur le site).
