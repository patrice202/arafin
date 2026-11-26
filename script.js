// ARAFIN — affichage public
// Source principale : Firestore (collection « membres » + document « site/contenu »).
// Si Firestore est vide ou injoignable, on retombe sur data.js (ARAFIN_DATA).
// + animations d'apparition au défilement
 
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc, getDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
 
function echapper(txt) {
  return String(txt ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
 
function initiales(nom) {
  return nom.split(" ").map(m => m[0]).slice(0, 2).join("").toUpperCase();
}
 
// ---------- Données de secours : data.js ----------
function donneesSecours() {
  return {
    annonce: ARAFIN_DATA.annonce || "",
    contact: {
      adresse: ARAFIN_DATA.contact.ville || "",
      email: ARAFIN_DATA.contact.email || "",
      whatsapp: ARAFIN_DATA.contact.telephone || ""
    },
    conseil: (ARAFIN_DATA.conseil || []).map(m => ({
  nom: m.nom, role: m.role, photo: m.photo || "", bio: m.bio || ""
})),
associes: (ARAFIN_DATA.associes || []).map(m => ({
  nom: m.nom, role: m.role, photo: m.photo || "", bio: m.bio || ""
}))
  };
}
 
// ---------- Données en ligne : Firestore ----------
async function donneesFirestore() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
 
  const [snapMembres, snapSite, snapAssocies] = await Promise.all([
  getDocs(query(collection(db, "membres"), orderBy("ordre"))),
  getDoc(doc(db, "site", "contenu")),
  getDocs(query(collection(db, "associes"), orderBy("ordre")))
]);
 
  if (snapMembres.empty) return null; // base pas encore initialisée → data.js
 
  const contenu = snapSite.exists() ? snapSite.data() : {};
  return {
    annonce: contenu.annonce || "",
    contact: {
      adresse: contenu.adresse || "",
      email: contenu.email || "",
      whatsapp: contenu.whatsapp || ""
    },
    conseil: snapMembres.docs.map(d => {
  const m = d.data();
  return { nom: m.nom || "", role: m.role || "", photo: m.photo || "", bio: m.bio || "" };
}),
associes: (() => {
  // Fusion : la liste complète vient de data.js (les 6 associés) ;
  // Firestore écrase la fiche des associés déjà activés (photo et
  // bio à jour depuis leur Espace Associés) et ajoute ceux qui ne
  // sont pas encore dans data.js. Sans ça, dès qu'un seul associé
  // est activé dans Firestore, les autres disparaissent du site.
  const base = (ARAFIN_DATA.associes || []).map(m => ({
    nom: m.nom, role: m.role, photo: m.photo || "", bio: m.bio || ""
  }));
  snapAssocies.docs.forEach(d => {
    const m = d.data();
    const fiche = { nom: m.nom || "", role: m.role || "", photo: m.photo || "", bio: m.bio || "" };
    const i = base.findIndex(b => b.nom.toLowerCase() === fiche.nom.toLowerCase());
    if (i >= 0) {
      base[i] = {
        nom: fiche.nom || base[i].nom,
        role: fiche.role || base[i].role,
        photo: fiche.photo || base[i].photo,
        bio: fiche.bio
      };
    } else {
      base.push(fiche);
    }
  });
  return base;
})()
  };
}
 
// ---------- Affichage ----------
function afficher(data) {
  // Bandeau d'annonce
  const annonceEl = document.getElementById("annonce");
  if (data.annonce && data.annonce.trim() !== "") {
    annonceEl.innerHTML = data.annonce;
    annonceEl.hidden = false;
  }
 
  // Conseil d'administration
  const grid = document.getElementById("conseil-grid");
  grid.innerHTML = "";
  data.conseil.forEach((m, i) => {
    const div = document.createElement("div");
    div.className = "membre reveal";
    div.style.transitionDelay = (i * 90) + "ms";
    const aPhoto = m.photo && m.photo.trim() !== "";
    const photo = aPhoto
      ? `<img src="${echapper(m.photo)}" alt="Photo de ${echapper(m.nom)}">`
      : `<div class="initiales">${echapper(initiales(m.nom))}</div>`;
    const attente = aPhoto ? "" : `<span class="attente">Photo à venir</span>`;
const morceaux = (m.bio || "").split(/\n|•/).map(s => s.trim()).filter(s => s !== "");
let bio = "";
if (morceaux.length > 1) {
  bio = `<ul class="bio-list">${morceaux.map(s => `<li>${echapper(s)}</li>`).join("")}</ul>`;
} else if (morceaux.length === 1) {
  bio = `<p class="bio">${echapper(morceaux[0])}</p>`;
}
    div.innerHTML = `${photo}<h3>${echapper(m.nom)}</h3><p class="role">${echapper(m.role)}</p>${attente}${bio}`;
    grid.appendChild(div);
  });
 // Associés fondateurs (Firestore, sinon data.js)
const gridA = document.getElementById("associes-grid");
if (gridA) {
  gridA.innerHTML = "";
  (data.associes || []).forEach((m, i) => {
    const div = document.createElement("div");
    div.className = "membre membre-associe reveal";
    div.style.transitionDelay = (i * 90) + "ms";
    const aPhoto = m.photo && m.photo.trim() !== "";
    const photo = aPhoto
      ? `<img src="${echapper(m.photo)}" alt="Photo de ${echapper(m.nom)}">`
      : `<div class="initiales">${echapper(initiales(m.nom))}</div>`;
    const attente = aPhoto ? "" : `<span class="attente">Photo à venir</span>`;
    const morceauxA = (m.bio || "").split(/\n|•/).map(s => s.trim()).filter(s => s !== "");
    let bioA = "";
    if (morceauxA.length > 1) {
      bioA = `<ul class="bio-list">${morceauxA.map(s => `<li>${echapper(s)}</li>`).join("")}</ul>`;
    } else if (morceauxA.length === 1) {
      bioA = `<p class="bio">${echapper(morceauxA[0])}</p>`;
    }
    div.innerHTML = `${photo}<h3>${echapper(m.nom)}</h3><p class="role">${echapper(m.role)}</p>${attente}${bioA}`;
    gridA.appendChild(div);
  });
}


  // Contact
  const contactEl = document.getElementById("contact-infos");
  let contactHTML = "";
  if (data.contact.adresse) contactHTML += `<p>📍 <strong>${echapper(data.contact.adresse)}</strong></p>`;
if (data.contact.email) {
  data.contact.email.split(",").forEach(partie => {
    const e = partie.trim();
    if (e) contactHTML += `<p>✉️ <a href="mailto:${echapper(e)}">${echapper(e)}</a></p>`;
  });
}
  if (data.contact.whatsapp) {
    const chiffres = data.contact.whatsapp.replace(/\D/g, "");
    contactHTML += chiffres
      ? `<p>📞 <a href="https://wa.me/${chiffres}">${echapper(data.contact.whatsapp)}</a> (WhatsApp)</p>`
      : `<p>📞 <strong>${echapper(data.contact.whatsapp)}</strong></p>`;
  }
  if (!data.contact.email && !data.contact.whatsapp) {
    contactHTML += `<p>Les coordonnées directes seront publiées très bientôt — en attendant, contactez un membre du conseil d'administration: administration@arafinhaiti.com</p>`;
  }
  contactEl.innerHTML = contactHTML;
 
  activerAnimations();
}
 
// Animations : les éléments .reveal apparaissent en douceur quand on arrive dessus
function activerAnimations() {
  const observateur = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        observateur.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(el => observateur.observe(el));
}
 
// ---------- Démarrage ----------
(async () => {
  let data = null;
  try {
    data = await donneesFirestore();
  } catch (e) {
    data = null; // Firestore injoignable → data.js
  }
  afficher(data || donneesSecours());
})();
// ---------- Mosaïque du hero : 5 photos ----------
(function () {
  const box = document.getElementById("mz");
  if (!box) return;
  const imgs = box.querySelectorAll(".mz-tile img");
  const pool = [
    "images/suivi-cultures.jpg", "images/jeunes-plants.jpg", "images/parcelle-soleil.jpg",
    "images/elevage-chevreau.jpg", "images/troupeau-chevres.jpg"
  ];
  let start = 0, timer = null;
  pool.forEach(s => { const i = new Image(); i.src = s; });
  function montrer() {
    imgs.forEach((img, k) => { img.src = pool[(start + k) % pool.length]; });
  }
  function tourner(sens) {
    box.classList.add("fading");
    setTimeout(() => {
      start = (start + sens + pool.length) % pool.length;
      montrer();
      box.classList.remove("fading");
    }, 360);
  }
  function relancer() { clearInterval(timer); timer = setInterval(() => tourner(1), 6000); }
  box.querySelector(".mz-next").addEventListener("click", () => { tourner(1); relancer(); });
  box.querySelector(".mz-prev").addEventListener("click", () => { tourner(-1); relancer(); });
  let x0 = null;
  box.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) { tourner(dx < 0 ? 1 : -1); relancer(); }
    x0 = null;
  }, { passive: true });
  relancer();
})();
// ---------- Formulaire de contact (EmailJS) — vérification de l'email de l'expéditeur ----------
// Le message n'arrive à l'équipe QUE si l'expéditeur prouve qu'il possède
// l'adresse email saisie, en entrant le code reçu à cette adresse.
(function () {
  if (window.__arafinFormeLie) return;
  window.__arafinFormeLie = true;
  const form = document.getElementById("contact-form");
  if (!form || typeof emailjs === "undefined") return;
  const CLE_PUBLIQUE = "DQg0_UyzcRt_8VzNx";
  const SERVICE_ID = "service_ftp46v9";
  const TEMPLATE_ID = "template_yppb0ss";
  emailjs.init({ publicKey: CLE_PUBLIQUE });
  const msg = document.getElementById("form-msg");
  const zone = document.getElementById("verif-zone");
  const champCode = document.getElementById("verif-code");
  const btnVerifier = document.getElementById("btn-verifier");
  const btnRenvoyer = document.getElementById("btn-renvoyer");
  let enAttente = null; // { nom, email, message, code, expiration, essais }

  function nouveauCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

  async function envoyerCode() {
    enAttente.code = nouveauCode();
    enAttente.expiration = Date.now() + 10 * 60 * 1000; // valable 10 minutes
    enAttente.essais = 0;
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email: enAttente.email,
      name: "ARAFIN — Vérification de votre adresse email",
      email: enAttente.email,
      title: "Code de vérification ARAFIN",
      message: "Bonjour " + enAttente.nom + ",\n\nVous avez demandé à envoyer un message à l'équipe ARAFIN via le site arafinhaiti.com. Pour prouver que cette adresse email est bien la vôtre, voici votre code de vérification :\n\nCODE : " + enAttente.code + "\n\nRetournez sur le site et entrez ce code pour transmettre votre message. Le code est valable 10 minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email : sans le code, aucun message ne sera transmis à l'équipe.\n\n— ARAFIN · ARTI Agro Finance",
      time: new Date().toLocaleString("fr-FR")
    });
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const bouton = form.querySelector("button[type=submit]");
    const nom = form.elements["nom"].value.trim();
    const email = form.elements["email"].value.trim().toLowerCase();
    const tel = form.elements["telephone"].value.trim();
    let message = form.elements["message"].value.trim();
    if (tel) message += "\n\nTéléphone : " + tel;
    bouton.disabled = true;
    msg.textContent = "Envoi du code de vérification…";
    try {
      enAttente = { nom: nom, email: email, message: message };
      await envoyerCode();
      if (zone) zone.hidden = false;
      msg.textContent = "📧 Un code de vérification vient d'être envoyé à " + email + ". Entrez-le ci-dessous pour transmettre votre message à notre équipe. (Vérifiez aussi vos spams.)";
      if (champCode) champCode.focus();
    } catch (err) {
      msg.textContent = "❌ L'envoi du code a échoué. Vérifiez votre adresse email, ou écrivez-nous directement à info@arafinhaiti.com.";
      enAttente = null;
    }
    bouton.disabled = false;
  });

  if (btnVerifier) btnVerifier.addEventListener("click", async function () {
    if (!enAttente) return;
    const saisi = champCode.value.trim();
    if (Date.now() > enAttente.expiration) {
      msg.textContent = "⏰ Ce code a expiré (10 minutes). Cliquez sur « Renvoyer le code » pour en recevoir un nouveau.";
      return;
    }
    if (saisi !== enAttente.code) {
      enAttente.essais++;
      if (enAttente.essais >= 3) {
        enAttente = null;
        if (zone) zone.hidden = true;
        msg.textContent = "❌ Trop de codes incorrects. Pour votre sécurité, recommencez le formulaire.";
      } else {
        msg.textContent = "❌ Code incorrect (essai " + enAttente.essais + "/3). Vérifiez l'email reçu et réessayez.";
      }
      return;
    }
    btnVerifier.disabled = true;
    msg.textContent = "Code correct — transmission de votre message…";
    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        to_email: "arafinhaiti@gmail.com",
        name: enAttente.nom,
        email: enAttente.email,
        message: enAttente.message,
        time: new Date().toLocaleString("fr-FR")
      });
      msg.textContent = "✅ Merci ! Votre adresse est vérifiée et votre message a bien été transmis à notre équipe — nous vous répondrons bientôt.";
      form.reset();
      if (zone) zone.hidden = true;
      champCode.value = "";
      enAttente = null;
    } catch (err) {
      msg.textContent = "❌ La transmission a échoué. Réessayez, ou écrivez-nous directement à info@arafinhaiti.com.";
    }
    btnVerifier.disabled = false;
  });

  if (btnRenvoyer) btnRenvoyer.addEventListener("click", async function () {
    if (!enAttente) return;
    btnRenvoyer.disabled = true;
    try {
      await envoyerCode();
      msg.textContent = "📧 Un nouveau code vient d'être envoyé à " + enAttente.email + ".";
    } catch (err) {
      msg.textContent = "❌ L'envoi du nouveau code a échoué. Réessayez dans un instant.";
    }
    btnRenvoyer.disabled = false;
  });
})();
// ===== v4 FLUIDITÉ : ombre du header, retour en haut, menu mobile, section active =====
(() => {
  const header = document.querySelector(".header");
  const toTop = document.getElementById("to-top");
  const onScroll = () => {
    const y = window.scrollY || 0;
    if (header) header.classList.toggle("scrolled", y > 10);
    if (toTop) toTop.classList.toggle("show", y > 600);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  const burger = document.getElementById("nav-burger");
  const nav = document.querySelector(".nav");
  if (burger && nav) {
    burger.addEventListener("click", () => {
      const ouvert = nav.classList.toggle("open");
      burger.classList.toggle("open", ouvert);
      burger.setAttribute("aria-expanded", ouvert ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
      nav.classList.remove("open");
      burger.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    }));
  }

  const liens = {};
  document.querySelectorAll(".nav a[href^='#']").forEach((a) => { liens[a.getAttribute("href").slice(1)] = a; });
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && liens[e.target.id]) {
        Object.values(liens).forEach((a) => a.classList.remove("active"));
        liens[e.target.id].classList.add("active");
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  ["apropos", "approche", "services", "conseil", "contact"].forEach((id) => {
    const s = document.getElementById(id);
    if (s) spy.observe(s);
  });
})();
