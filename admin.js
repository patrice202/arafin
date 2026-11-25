// ============================================================
//  ARAFIN — Espace Conseil (comptes individuels Firebase)
//  Chaque membre du conseil se connecte avec SON email et SON
//  mot de passe (Firebase Authentication), modifie SA fiche
//  (photo + bio) et peut changer son mot de passe lui-même.
//  Les modifications sont publiées immédiatement (Firestore).
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc,
  addDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Comptes administrateurs (peuvent tout modifier : annonce, contacts, fiches des membres)
const ADMIN_EMAILS = ["antoniosaintilmond1@gmail.com", "daniellegros02@gmail.com"];
// Emails des 5 membres du Conseil (seuls comptes autorisés dans l'Espace Conseil)
const EMAILS_AUTORISES = [
  "antoniosaintilmond1@gmail.com",
  "daniellegros02@gmail.com",
  "oliviersoifaite07@gmail.com",
  "handydolphe7@gmail.com",
  "alcidekenny009@gmail.com"
];
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let utilisateur = null;   // utilisateur Firebase connecté
let membres = [];         // [{ id, nom, role, ordre, email, photo, bio }]
let maFiche = null;       // fiche du membre connecté (ou null)
let photoEnAttente = null; // nouvelle photo (data URL) pas encore enregistrée

const $ = id => document.getElementById(id);
const estAdmin = () =>
  utilisateur && ADMIN_EMAILS.includes((utilisateur.email || "").toLowerCase());

function slugDepuisNom(nom) {
  return nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/\s+/g, "-");
}

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
  // GARDE D'ACCÈS : seuls les emails des membres du Conseil peuvent recevoir un lien
  if (!EMAILS_AUTORISES.includes(email)) {
    const cle = "arafin_tentatives_" + email;
    const n = (parseInt(localStorage.getItem(cle) || "0", 10) || 0) + 1;
    try { localStorage.setItem(cle, String(n)); } catch (err) {}
    msg.style.color = "#b91c1c";
    msg.textContent = "❌ Adresse non reconnue : cet email ne fait pas partie des membres du Conseil d'Administration. Accès refusé." + (n > 2 ? " Le Conseil d'Administration a été alerté." : "");
    // ALERTE SÉCURITÉ : à la 3e tentative, un email part à TOUS les membres du Conseil
    if (n === 3) {
      try {
        if (typeof emailjs !== "undefined") {
          emailjs.init({ publicKey: "DQg0_UyzcRt_8VzNx" });
          const maintenant = new Date().toLocaleString("fr-FR");
          for (const membre of EMAILS_AUTORISES) {
            await emailjs.send("service_ftp46v9", "template_yppb0ss", {
              to_email: membre,
              name: "ALERTE SÉCURITÉ — tentative d'accès non autorisé",
              email: email,
              title: "Alerte sécurité Espace Conseil",
              message: "Une adresse email qui ne fait pas partie des membres du Conseil d'Administration essaie d'entrer dans l'Espace Conseil ARAFIN.\n\nAdresse suspecte : " + email + "\nTentatives : " + n + "\nDate et heure : " + maintenant + "\n\nNous avons besoin d'une aide immédiate. Si ce n'est aucun d'entre vous, prévenez le président, le vice-président ou le responsable informatique.",
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
onAuthStateChanged(auth, async user => {
  utilisateur = user;
  if (!user) {
    $("login-box").hidden = false;
    $("app-box").hidden = true;
    return;
  }
  $("login-box").hidden = true;
  $("app-box").hidden = false;
  $("user-email").textContent = user.email;
  $("mon-email").textContent = user.email;
  await chargerMembres();
  trouverMaFiche();
  chargerGalerieAdmin();
  if (estAdmin()) {
    $("admin-zone").hidden = false;
    await chargerSite();
    afficherMembresAdmin();
  } else {
    $("admin-zone").hidden = true;
  }
});

async function chargerMembres() {
  const snap = await getDocs(query(collection(db, "membres"), orderBy("ordre")));
  membres = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function trouverMaFiche() {
  const email = (utilisateur.email || "").toLowerCase();
  maFiche = membres.find(m => (m.email || "").toLowerCase() === email) || null;
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
// ALERTE : un membre a essayé de publier une image sensible — un email part
// automatiquement aux AUTRES membres du Conseil (modèle Contact Us, comme
// l'alerte des mots de passe). L'alerte ne bloque jamais le refus.
async function alerterConseilImageRefusee() {
  try {
    emailjs.init({ publicKey: "DQg0_UyzcRt_8VzNx" });
    const qui = (maFiche && maFiche.nom ? maFiche.nom : "Un membre") +
      " (" + (utilisateur ? utilisateur.email : "email inconnu") + ")";
    const dateHeure = new Date().toLocaleString("fr-FR");
    const texte = "ALERTE SÉCURITÉ — ARAFIN\n\n" + qui + " a essayé de publier une image détectée comme pornographique ou sensible dans l'Espace Conseil du site ARAFIN.\n\nL'image a été REFUSÉE automatiquement par le système de protection : elle n'a pas été enregistrée et n'apparaît pas sur le site.\n\nDate et heure : " + dateHeure + "\n\nNous avons besoin d'une aide immédiate : merci de vérifier avec ce membre ce qui s'est passé.\n\n— Système de protection ARAFIN";
    const autres = EMAILS_AUTORISES.filter(m => m !== (utilisateur ? utilisateur.email : ""));
    for (const membre of autres) {
      await emailjs.send("service_ftp46v9", "template_yppb0ss", {
        to_email: membre,
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
alerterConseilImageRefusee();
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
    await updateDoc(doc(db, "membres", maFiche.id), maj);
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
    // Alerte email au membre (EmailJS, même méthode que le formulaire de contact)
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

// ---------- Admin : annonce et contacts ----------
async function chargerSite() {
  try {
    const snap = await getDoc(doc(db, "site", "contenu"));
    if (snap.exists()) {
      const c = snap.data();
      $("f-annonce").value = c.annonce || "";
      $("f-adresse").value = c.adresse || "";
      $("f-email").value = c.email || "";
      $("f-whatsapp").value = c.whatsapp || "";
    }
  } catch (e) { /* le formulaire reste vide */ }
}

$("btn-save-site").addEventListener("click", async () => {
  try {
    await setDoc(doc(db, "site", "contenu"), {
      annonce: $("f-annonce").value,
      adresse: $("f-adresse").value,
      email: $("f-email").value.trim(),
      whatsapp: $("f-whatsapp").value.trim()
    }, { merge: true });
    $("site-msg").textContent = "✅ Enregistré — visible sur le site dès maintenant.";
  } catch (e) {
    $("site-msg").textContent = erreurFR(e);
  }
});

// ---------- Admin : liste des membres ----------
function afficherMembresAdmin() {
  const zone = $("membres-edit");
  zone.innerHTML = "";
  membres.forEach(m => {
    const div = document.createElement("div");
    div.className = "membre-edit";
    div.innerHTML = `
      ${m.photo ? `<img src="${m.photo}" alt="">` : ""}
      <label>Nom</label>
      <input type="text" data-f="nom" value="${(m.nom || "").replace(/"/g, "&quot;")}">
      <label>Rôle</label>
      <input type="text" data-f="role" value="${(m.role || "").replace(/"/g, "&quot;")}">
      <label>Ordre d'affichage (1 à 5)</label>
      <input type="number" data-f="ordre" min="1" max="20" value="${m.ordre || ""}">
      <label>Email de connexion du membre</label>
      <input type="email" data-f="email" value="${(m.email || "").replace(/"/g, "&quot;")}" placeholder="membre@email.com">
      <div class="admin-row">
        <button class="btn btn-green" data-save="${m.id}">💾 Enregistrer ce membre</button>
      </div>
      <p class="msg" data-msg="${m.id}"></p>`;
    zone.appendChild(div);
  });

  zone.querySelectorAll("button[data-save]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const bloc = btn.closest(".membre-edit");
      const id = btn.dataset.save;
      const champs = {};
      bloc.querySelectorAll("input[data-f]").forEach(inp => {
        champs[inp.dataset.f] = inp.dataset.f === "ordre"
          ? Number(inp.value) || 0
          : (inp.dataset.f === "email" ? inp.value.trim().toLowerCase() : inp.value);
      });
      const msgEl = bloc.querySelector(`[data-msg="${id}"]`);
      try {
        await updateDoc(doc(db, "membres", id), champs);
        Object.assign(membres.find(m => m.id === id), champs);
        msgEl.textContent = "✅ Enregistré.";
      } catch (e) {
        msgEl.textContent = erreurFR(e);
      }
    });
  });
}

// ---------- Admin : initialiser la base depuis data.js ----------
$("btn-seed").addEventListener("click", async () => {
  const msg = $("seed-msg");
  try {
    const snap = await getDocs(collection(db, "membres"));
    if (!snap.empty) {
      msg.textContent = "La base contient déjà des membres — initialisation inutile (rien n'a été écrasé).";
      return;
    }
    const EMAILS_CONSEIL = {
      "daniel-legros": "daniellegros02@gmail.com",
      "antonio-saintilmond": "antoniosaintilmond1@gmail.com",
      "olivier-soifaite": "oliviersoifaite07@gmail.com",
      "andy-adolphe": "handydolphe7@gmail.com",
      "kenny-alcide": "alcidekenny009@gmail.com"
    };
    const ecritures = [];
    ARAFIN_DATA.conseil.forEach((m, i) => {
      const slug = slugDepuisNom(m.nom);
      ecritures.push(setDoc(doc(db, "membres", slug), {
        nom: m.nom,
        role: m.role,
        ordre: i + 1,
        email: EMAILS_CONSEIL[slug] || "",
        photo: m.photo || "",
        bio: m.bio || ""
      }));
    });
    ecritures.push(setDoc(doc(db, "site", "contenu"), {
      annonce: ARAFIN_DATA.annonce || "",
      adresse: ARAFIN_DATA.contact.ville || "",
      email: ARAFIN_DATA.contact.email || "",
      whatsapp: ARAFIN_DATA.contact.telephone || ""
    }));
    await Promise.all(ecritures);
    await chargerMembres();
    await chargerSite();
    afficherMembresAdmin();
    trouverMaFiche();
    msg.textContent = "✅ Base initialisée depuis data.js, avec les emails des 5 membres déjà remplis. Vérifie la liste ci-dessus.";
  } catch (e) {
    msg.textContent = erreurFR(e);
  }
});
// ---------- Galerie du site (tous les membres du conseil) ----------
// Chaque membre peut publier des photos sur la page publique « Galerie ».
// La photo passe par la MÊME vérification automatique que les photos de
// profil (analyserImage) : un contenu sensible est refusé et déclenche
// l'alerte aux autres membres. Un membre ne peut supprimer que SES
// photos ; les administrateurs peuvent tout supprimer.
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
    if (!mien && !estAdmin()) return; // un membre ne gère que ses photos (les admins voient tout)
    affichees++;
    const ligne = document.createElement("div");
    ligne.className = "gal-admin-ligne";
    const date = p.date ? new Date(p.date).toLocaleDateString("fr-FR") : "";
    // Photo du membre, vieille de plus d'1 mois : suppression directe
    // impossible — il faut l'approbation du Président ou du Vice-Président.
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
// Le membre ne peut plus supprimer directement une photo de plus
// d'1 mois : sa demande part par email au Président et au
// Vice-Président, qui approuvent en supprimant eux-mêmes la photo
// depuis leur propre liste (ils voient toutes les photos).
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
    "Si vous refusez, prévenez simplement le membre.\n\n" +
    "— Espace Conseil ARAFIN";
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
      alerterConseilImageRefusee();
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
