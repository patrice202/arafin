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
  query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// Comptes administrateurs (peuvent tout modifier : annonce, contacts, fiches des membres)
const ADMIN_EMAILS = ["antoniosaintilmond1@gmail.com", "daniellegros02@gmail.com"];

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
  const email = $("login-email").value.trim();
  if (!email) {
    $("login-msg").textContent = "Entre ton adresse email ci-dessus, puis clique à nouveau sur « Mot de passe oublié ».";
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    $("login-msg").style.color = "var(--green-800)";
    $("login-msg").textContent = "✅ Email envoyé à " + email + " — clique le lien reçu pour choisir un nouveau mot de passe.";
  } catch (err) {
    $("login-msg").style.color = "#b91c1c";
    $("login-msg").textContent = erreurFR(err);
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
$("ma-photo").addEventListener("change", async () => {
  const fichier = $("ma-photo").files[0];
  if (!fichier) return;
  try {
    photoEnAttente = await reduireImage(fichier);
    majApercuPhoto(photoEnAttente);
    $("fiche-msg").textContent = "Photo prête — clique « Enregistrer ma fiche » pour la publier.";
  } catch (e) {
    $("fiche-msg").textContent = "Impossible de lire cette image.";
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