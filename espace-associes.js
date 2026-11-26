// ============================================================
//  ARAFIN — Espace Associés (comptes individuels Firebase)
//  Chaque associé fondateur se connecte avec SON email et SON
//  mot de passe (Firebase Authentication), modifie SA fiche
//  (photo + bio) et peut publier des photos dans la galerie.
//  Les modifications sont publiées immédiatement (Firestore).
//  Accès : la porte PIN (admin.html) envoie ici avec le PIN des
//  associés ; sans le passage par la porte, retour à admin.html.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, updateDoc,
  addDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Comptes administrateurs (Président + Vice-Président) : destinataires
// des alertes de sécurité et des demandes de suppression de la galerie.
const ADMIN_EMAILS = ["antoniosaintilmond1@gmail.com", "daniellegros02@gmail.com"];
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let utilisateur = null;   // utilisateur Firebase connecté
let associes = [];        // [{ id, nom, role, ordre, email, photo, bio }]
let maFiche = null;       // fiche de l'associé connecté (ou null)
let photoEnAttente = null; // nouvelle photo (data URL) pas encore enregistrée

const $ = id => document.getElementById(id);
const estAdmin = () =>
  utilisateur && ADMIN_EMAILS.includes((utilisateur.email || "").toLowerCase());

// ---------- Messages d'erreur en français ----------
function erreurFR(e) {
  const codes = {
    "auth/invalid-email": "Adresse email invalide.",
    "auth/user-not-found": "Aucun compte avec cette adresse email.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
    "auth/too-many-requests": "Trop de tentatives. Réessaie dans quelques minutes.",
    "auth/network-request-failed": "Problème de connexion internet. Vérifie ta connexion puis réessaie.",
    "auth/weak-password": "Mot de passe trop faible : 6 caractères minimum.",
    "auth/requires-recent-login": "Reconnecte-toi puis réessaie (sécurité).",
    "permission-denied": "Action non autorisée pour ce compte.",
    "auth/missing-email": "Entre ton adresse email d'abord."
  };
  return codes[e && e.code] || ("Erreur : " + (e && e.message ? e.message : e));
}

// ---------- Connexion ----------
$("btn-login").addEventListener("click", async () => {
  const email = $("login-email").value.trim();
  const mdp = $("login-mdp").value;
  $("login-msg").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email, mdp);
  } catch (e) {
    $("login-msg").textContent = erreurFR(e);
  }
});
$("login-mdp").addEventListener("keydown", e => {
  if (e.key === "Enter") $("btn-login").click();
});

$("lien-oublie").addEventListener("click", async e => {
  e.preventDefault();
  const email = $("login-email").value.trim().toLowerCase();
  const msg = $("login-msg");
  if (!email) {
    msg.style.color = "#b91c1c";
    msg.textContent = "Entre ton adresse email ci-dessus, puis clique à nouveau sur « Mot de passe oublié ».";
    return;
  }
  // GARDE D'ACCÈS : seuls les emails des associés fondateurs (collection
  // Firestore « associes ») peuvent recevoir un lien de réinitialisation.
  let reconnu = false;
  try {
    const snap = await getDocs(collection(db, "associes"));
    reconnu = snap.docs.some(d => (d.data().email || "").toLowerCase() === email);
  } catch (err) { reconnu = false; }
  if (!reconnu) {
    const cle = "arafin_tentatives_as_" + email;
    const n = (parseInt(localStorage.getItem(cle) || "0", 10) || 0) + 1;
    try { localStorage.setItem(cle, String(n)); } catch (err) {}
    msg.style.color = "#b91c1c";
    msg.textContent = "❌ Adresse non reconnue : cet email ne fait pas partie des associés fondateurs. Accès refusé." + (n > 2 ? " Le Président et le Vice-Président ont été alertés." : "");
    // ALERTE SÉCURITÉ : à la 3e tentative, un email part aux 2 administrateurs
    if (n === 3) {
      try {
        if (typeof emailjs !== "undefined") {
          emailjs.init({ publicKey: "DQg0_UyzcRt_8VzNx" });
          const maintenant = new Date().toLocaleString("fr-FR");
          for (const admin of ADMIN_EMAILS) {
            await emailjs.send("service_ftp46v9", "template_yppb0ss", {
              to_email: admin,
              name: "ALERTE SÉCURITÉ — tentative d'accès non autorisé",
              email: email,
              title: "Alerte sécurité Espace Associés",
              message: "Une adresse email qui ne fait pas partie des associés fondateurs essaie d'entrer dans l'Espace Associés ARAFIN.\n\nAdresse suspecte : " + email + "\nTentatives : " + n + "\nDate et heure : " + maintenant + "\n\nNous avons besoin d'une aide immédiate. Si ce n'est aucun des associés, prévenez le président ou le vice-président.",
              time: maintenant
            });
          }
        }
      } catch (err) { /* l'alerte ne doit jamais bloquer le refus d'accès */ }
    }
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    msg.style.color = "var(--green-800)";
    msg.textContent = "✅ Email envoyé à " + email + " — clique le lien reçu pour choisir un nouveau mot de passe.";
  } catch (err) {
    msg.style.color = "#b91c1c";
    msg.textContent = erreurFR(err);
  }
});

$("btn-logout").addEventListener("click", () => signOut(auth));

// ---------- État de connexion ----------
// Sans le passage par la porte PIN (admin.html, PIN des associés)
// et sans session déjà ouverte, on renvoie à la porte.
onAuthStateChanged(auth, async user => {
  utilisateur = user;
  if (!user) {
    $("app-box").hidden = true;
    if (sessionStorage.getItem("arafin_pin_associes") === "1") {
      $("login-box").hidden = false;
    } else {
      window.location.href = "admin.html";
    }
    return;
  }
  $("login-box").hidden = true;
  $("app-box").hidden = false;
  $("user-email").textContent = user.email;
  $("mon-email").textContent = user.email;
  await chargerAssocies();
  trouverMaFiche();
  chargerGalerieAdmin();
});

async function chargerAssocies() {
  const snap = await getDocs(query(collection(db, "associes"), orderBy("ordre")));
  associes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function trouverMaFiche() {
  const email = (utilisateur.email || "").toLowerCase();
  maFiche = associes.find(m => (m.email || "").toLowerCase() === email) || null;
  if (maFiche) {
    $("ma-fiche-box").hidden = false;
    $("non-associe-box").hidden = true;
    $("mon-nom").textContent = maFiche.nom;
    $("mon-role").textContent = maFiche.role;
    $("ma-bio").value = maFiche.bio || "";
    photoEnAttente = null;
    majApercuPhoto(maFiche.photo);
  } else {
    $("ma-fiche-box").hidden = true;
    $("non-associe-box").hidden = false;
  }
}

function majApercuPhoto(photo) {
  const img = $("ma-photo-apercu");
  if (photo) { img.src = photo; img.hidden = false; }
  else { img.hidden = true; img.removeAttribute("src"); }
}

// ---------- Ma fiche : photo + bio ----------
// PROTECTION DU SITE : chaque photo est analysée par une IA locale (NSFWJS)
// AVANT d'être acceptée. Une image pornographique ou sensible est refusée
// et n'arrive jamais sur le site. Modèle hébergé à la racine du site (model.json).
let modeleNSFW = null;
async function analyserImage(fichier) {
  // Renvoie true si l'image est acceptable, false si contenu sensible détecté.
  if (typeof nsfwjs === "undefined") throw new Error("analyse indisponible");
  if (!modeleNSFW) modeleNSFW = await nsfwjs.load("./");
  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const resultats = await modeleNSFW.classify(img);
    const score = {};
    resultats.forEach(r => { score[r.className] = r.probability; });
    const risque = (score["Porn"] || 0) + (score["Hentai"] || 0);
    const sexy = score["Sexy"] || 0;
    return !(risque >= 0.60 || sexy >= 0.90);
  } finally {
    URL.revokeObjectURL(url);
  }
}
// ALERTE : un associé a essayé de publier une image sensible — un email
// part automatiquement au Président et au Vice-Président (modèle Contact
// Us, comme les autres alertes). L'alerte ne bloque jamais le refus.
async function alerterAdminsImageRefusee() {
  try {
    emailjs.init({ publicKey: "DQg0_UyzcRt_8VzNx" });
    const qui = (maFiche && maFiche.nom ? maFiche.nom : "Un associé") +
      " (" + (utilisateur ? utilisateur.email : "email inconnu") + ")";
    const dateHeure = new Date().toLocaleString("fr-FR");
    const texte = "ALERTE SÉCURITÉ — ARAFIN\n\n" + qui + " a essayé de publier une image détectée comme pornographique ou sensible dans l'Espace Associés du site ARAFIN.\n\nL'image a été REFUSÉE automatiquement par le système de protection : elle n'a pas été enregistrée et n'apparaît pas sur le site.\n\nDate et heure : " + dateHeure + "\n\nNous avons besoin d'une aide immédiate : merci de vérifier avec cet associé ce qui s'est passé.\n\n— Système de protection ARAFIN";
    for (const admin of ADMIN_EMAILS) {
      await emailjs.send("service_ftp46v9", "template_yppb0ss", {
        to_email: admin,
        name: "ALERTE SÉCURITÉ — image sensible refusée",
        email: utilisateur ? utilisateur.email : "",
        title: "Alerte sécurité — image refusée",
        message: texte,
        time: dateHeure
      });
    }
  } catch (e) { /* l'alerte ne doit jamais bloquer le refus */ }
}

$("ma-photo").addEventListener("change", async () => {
  const fichier = $("ma-photo").files[0];
  if (!fichier) return;
  $("fiche-msg").textContent = "Analyse de sécurité de l'image en cours…";
  try {
    const acceptable = await analyserImage(fichier);
    if (!acceptable) {
      photoEnAttente = null;
      $("ma-photo").value = "";
      $("fiche-msg").textContent = "❌ Image refusée : un contenu sensible (pornographie ou image inappropriée) a été détecté. Le site ARAFIN ne publie pas ce type d'image — choisis une autre photo.";
      alerterAdminsImageRefusee();
      return;
    }
    photoEnAttente = await reduireImage(fichier);
    majApercuPhoto(photoEnAttente);
    $("fiche-msg").textContent = "Photo vérifiée et prête — clique « Enregistrer ma fiche » pour la publier.";
  } catch (e) {
    photoEnAttente = null;
    $("fiche-msg").textContent = "L'analyse de sécurité n'a pas pu se faire (connexion ?). Par protection, aucune image n'est acceptée sans vérification — réessaie dans un instant.";
  }
});

// Réduit l'image à 900 px max et la convertit en JPEG (data URL)
function reduireImage(fichier) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const MAX = 900;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      let dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      // Garde-fou : un document Firestore est limité à ~1 Mo
      let qualite = 0.7;
      while (dataUrl.length > 900000 && qualite >= 0.4) {
        dataUrl = canvas.toDataURL("image/jpeg", qualite);
        qualite -= 0.15;
      }
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = url;
  });
}

$("btn-save-fiche").addEventListener("click", async () => {
  if (!maFiche) return;
  const maj = { bio: $("ma-bio").value };
  if (photoEnAttente) maj.photo = photoEnAttente;
  try {
    await updateDoc(doc(db, "associes", maFiche.id), maj);
    Object.assign(maFiche, maj);
    photoEnAttente = null;
    $("fiche-msg").textContent = "✅ Fiche enregistrée — elle est visible sur le site dès maintenant.";
  } catch (e) {
    $("fiche-msg").textContent = erreurFR(e);
  }
});

// ---------- Mon compte : changer le mot de passe ----------
$("btn-change-mdp").addEventListener("click", async () => {
  const actuel = $("mdp-actuel").value;
  const nouveau = $("mdp-nouveau").value;
  const confirme = $("mdp-confirme").value;
  const msg = $("compte-msg");
  msg.style.color = "#b91c1c";
  if (nouveau.length < 6) { msg.textContent = "Le nouveau mot de passe doit avoir au moins 6 caractères."; return; }
  if (nouveau !== confirme) { msg.textContent = "Les deux nouveaux mots de passe ne correspondent pas."; return; }
  try {
    const cred = EmailAuthProvider.credential(utilisateur.email, actuel);
    await reauthenticateWithCredential(utilisateur, cred);
    await updatePassword(utilisateur, nouveau);
    $("mdp-actuel").value = $("mdp-nouveau").value = $("mdp-confirme").value = "";
    msg.style.color = "var(--green-800)";
    msg.textContent = "✅ Mot de passe changé. Utilise le nouveau à ta prochaine connexion.";
    // Alerte email à l'associé (EmailJS, même méthode que le formulaire de contact)
    try {
      if (typeof emailjs !== "undefined") {
        emailjs.init({ publicKey: "DQg0_UyzcRt_8VzNx" });
        const heureActuelle = new Date().getHours();
        const salutation = (heureActuelle >= 18 || heureActuelle < 5) ? "Bonsoir" : "Bonjour";
        await emailjs.send("service_ftp46v9", "template_humfg23", {
          to_email: utilisateur.email,
          date_heure: new Date().toLocaleString("fr-FR"),
          salutation: salutation
        });
        msg.textContent += " Alerte email envoyée.";
      }
    } catch (e) {
      msg.textContent += " (Alerte email non envoyée : " + (e && e.text ? e.text : e) + ")";
    }
  } catch (e) {
    msg.textContent = erreurFR(e);
  }
});

// ---------- Galerie du site (tous les associés fondateurs) ----------
// Chaque associé peut publier des photos sur la page publique
// « Galerie ». La photo passe par la MÊME vérification automatique
// que les photos de profil (analyserImage) : un contenu sensible est
// refusé et déclenche l'alerte aux administrateurs. Un associé ne
// peut supprimer que SES photos, et seulement pendant 30 jours ;
// passé 1 mois, il demande l'approbation du Président ou du
// Vice-Président. Les administrateurs peuvent tout supprimer.
function echapperGal(txt) {
  return String(txt ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

let galeriePhotos = [];

async function chargerGalerieAdmin() {
  try {
    const snap = await getDocs(query(collection(db, "galerie"), orderBy("date", "desc")));
    galeriePhotos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    galeriePhotos = [];
  }
  afficherGalerieAdmin();
}

function afficherGalerieAdmin() {
  const zone = $("gal-liste");
  if (!zone) return;
  zone.innerHTML = "";
  const TRENTE_JOURS = 30 * 24 * 3600 * 1000;
  let affichees = 0;
  galeriePhotos.forEach(p => {
    const mien = utilisateur && p.auteur === utilisateur.email;
    if (!mien && !estAdmin()) return; // un associé ne gère que ses photos (les admins voient tout)
    affichees++;
    const ligne = document.createElement("div");
    ligne.className = "gal-admin-ligne";
    const date = p.date ? new Date(p.date).toLocaleDateString("fr-FR") : "";
    // Photo de l'associé, vieille de plus d'1 mois : suppression
    // directe impossible — il faut l'approbation du Président ou
    // du Vice-Président.
    const tropVieille = mien && !estAdmin() && p.date
      && (Date.now() - p.date > TRENTE_JOURS);
    ligne.innerHTML =
      `<img src="${echapperGal(p.photo)}" alt="">` +
      `<div><strong>${echapperGal(p.legende || "Sans légende")}</strong><br>` +
      `<small>${echapperGal(p.auteurNom || p.auteur)} — ${date}</small>` +
      (tropVieille
        ? `<br><small style="color:#a33">Photo de plus d'1 mois : la suppression demande l'accord du Président ou du Vice-Président.</small>`
        : ``) +
      `</div>`;
    const btn = document.createElement("button");
    btn.className = "btn btn-outline";
    btn.style.cssText = "color:var(--vert)!important;padding:8px 14px;font-size:.88rem";
    if (tropVieille) {
      btn.textContent = "Demander la suppression";
      btn.addEventListener("click", () => demanderSuppressionGalerie(p));
    } else {
      btn.textContent = "Supprimer";
      btn.addEventListener("click", async () => {
        if (!confirm("Supprimer cette photo de la galerie ?")) return;
        try {
          await deleteDoc(doc(db, "galerie", p.id));
          chargerGalerieAdmin();
        } catch (e) {
          $("gal-msg").textContent = "Suppression impossible (" + erreurFR(e) + ").";
        }
      });
    }
    ligne.appendChild(btn);
    zone.appendChild(ligne);
  });
  if (!affichees) {
    zone.innerHTML = "<p style='color:#777;margin:10px 0 0'>Aucune photo à gérer pour le moment — les tiennes apparaîtront ici.</p>";
  }
}

// ---------- Galerie : demande de suppression (> 1 mois) ----------
// L'associé ne peut plus supprimer directement une photo de plus
// d'1 mois : sa demande part par email au Président et au
// Vice-Président, qui approuvent en supprimant eux-mêmes la photo
// depuis leur Espace Conseil (ils voient toutes les photos).
async function demanderSuppressionGalerie(p) {
  const msg = $("gal-msg");
  const nomMembre = (maFiche && maFiche.nom) || utilisateur.email;
  const datePub = p.date ? new Date(p.date).toLocaleDateString("fr-FR") : "";
  const texte =
    "Bonjour,\n\n" +
    nomMembre + " (" + utilisateur.email + ") demande la suppression d'une de ses photos " +
    "dans la galerie du site ARAFIN.\n\n" +
    "Photo : « " + (p.legende || "Sans légende") + " » — publiée le " + datePub + ".\n\n" +
    "Cette photo a plus d'1 mois : selon les règles de la galerie, sa suppression " +
    "nécessite l'approbation du Président ou du Vice-Président.\n\n" +
    "POUR APPROUVER : connectez-vous à l'Espace Conseil (https://arafinhaiti.com/admin.html), " +
    "zone « Galerie du site », et supprimez cette photo depuis votre liste.\n" +
    "Si vous refusez, prévenez simplement l'associé.\n\n" +
    "— Espace Associés ARAFIN";
  msg.textContent = "Envoi de la demande…";
  try {
    emailjs.init({ publicKey: "DQg0_UyzcRt_8VzNx" });
    for (const admin of ADMIN_EMAILS) {
      await emailjs.send("service_ftp46v9", "template_yppb0ss", {
        to_email: admin,
        name: "DEMANDE DE SUPPRESSION — photo de la galerie",
        email: utilisateur.email,
        title: "Galerie ARAFIN — approbation de suppression demandée",
        message: texte,
        time: new Date().toLocaleString("fr-FR")
      });
    }
    msg.textContent = "✅ Demande envoyée au Président et au Vice-Président. L'un d'eux supprimera la photo s'il approuve.";
  } catch (e) {
    msg.textContent = "La demande n'a pas pu être envoyée. Réessaie dans un instant.";
  }
}

$("btn-gal-publier").addEventListener("click", async () => {
  const fichier = $("gal-photo").files[0];
  const msg = $("gal-msg");
  if (!fichier) { msg.textContent = "Choisis d'abord une photo."; return; }
  msg.textContent = "Analyse de sécurité de l'image en cours…";
  try {
    const acceptable = await analyserImage(fichier);
    if (!acceptable) {
      $("gal-photo").value = "";
      msg.textContent = "❌ Image refusée : un contenu sensible (pornographie ou image inappropriée) a été détecté. La galerie ARAFIN ne publie pas ce type d'image.";
      alerterAdminsImageRefusee();
      return;
    }
    msg.textContent = "Publication en cours…";
    const dataUrl = await reduireImage(fichier);
    await addDoc(collection(db, "galerie"), {
      photo: dataUrl,
      legende: $("gal-legende").value.trim().slice(0, 200),
      auteur: utilisateur.email,
      auteurNom: (maFiche && maFiche.nom) || utilisateur.email,
      date: Date.now()
    });
    $("gal-photo").value = "";
    $("gal-legende").value = "";
    msg.textContent = "✅ Photo publiée dans la galerie du site.";
    chargerGalerieAdmin();
  } catch (e) {
    msg.textContent = "La publication n'a pas pu se faire (" + erreurFR(e) + "). Réessaie dans un instant.";
  }
});