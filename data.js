// ============================================================
//  ARAFIN — données du site (contenu modifiable via admin.html)
//  Ce fichier contient UNIQUEMENT des informations publiques.
//  Ne jamais y mettre : montants du capital, NIF/NINU,
//  détails du Pacte d'Associés ou tout document interne.
// ============================================================

const ARAFIN_DATA = {

  // Bandeau d'annonce en haut de la page d'accueil (laisser vide "" pour le cacher)
  annonce: "ARAFIN est en phase de lancement — nous construisons nos premiers partenariats avec les producteurs et les investisseurs.",

  // Coordonnées publiques (à compléter quand ARAFIN aura un email / téléphone officiel)
  contact: {
    ville: "Port-au-Prince, Haïti",
    email: "",        // ex : "contact@arafin.ht"
    telephone: ""     // ex : "+509 ...."
  },

  // Conseil d'administration (associés commandités, Acte Constitutif art. 6)
  // photo : chemin de l'image, ou "" pour afficher les initiales en attendant la photo
  conseil: [
    { nom: "Daniel Legros",        role: "Président",           photo: "images/daniel-legros.jpg" },
    { nom: "Antonio Saintilmond",  role: "Vice-Président",      photo: "images/antonio-saintilmond.jpg" },
    { nom: "Olivier Soifaite",     role: "Secrétaire Général",  photo: "images/olivier-soifaite.jpg" },
    { nom: "Andy Adolphe",         role: "Trésorier",           photo: "" },
  { nom: "Kenny Alcide",         role: "Conseiller Technique", photo: "images/kenny-alcide.jpg" }
],

// Associés fondateurs (associés commanditaires, Acte Constitutif)
associes: [
  { nom: "Djenika Neylan",                role: "Resp. des Ressources Humaines", photo: "" },
  { nom: "Styvenson Jerry Adler Baubrun", role: "Resp. Informatique",        photo: "" },
  { nom: "Dessailly Youvens Revangile",   role: "Comptable Adjoint",   photo: "" },
  { nom: "Wood-Alens K. B. Alexandre",    role: "Resp. de la Gestion",             photo: "" },
{ nom: "Berdentz Sajous",               role: "Directeur Marketing",           photo: "" },
{ nom: "Fatsendy Saint Pierre",         role: "Resp. des Affaires Juridiques", photo: "" }]
};