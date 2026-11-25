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
    }))
  };
}
 
// ---------- Données en ligne : Firestore ----------
async function donneesFirestore() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
 
  const [snapMembres, snapSite] = await Promise.all([
    getDocs(query(collection(db, "membres"), orderBy("ordre"))),
    getDoc(doc(db, "site", "contenu"))
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
    })
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
    contactHTML += `<p>Les coordonnées directes seront publiées très bientôt — en attendant, contactez un membre du conseil d'administration: administration@arafin.com</p>`;
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
// ---------- Formulaire de contact (EmailJS) ----------
(function () {
  if (window.__arafinFormeLie) return;
  window.__arafinFormeLie = true;
  const form = document.getElementById("contact-form");
  if (!form || typeof emailjs === "undefined") return;
  const CLE_PUBLIQUE = "DQg0_UyzcRt_8VzNx";
  const SERVICE_ID = "service_ftp46v9";
  const TEMPLATE_ID = "template_yppb0ss";
  emailjs.init({ publicKey: CLE_PUBLIQUE });
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const msg = document.getElementById("form-msg");
    const bouton = form.querySelector("button[type=submit]");
    const nom = form.elements["nom"].value.trim();
    const email = form.elements["email"].value.trim();
    const tel = form.elements["telephone"].value.trim();
    let message = form.elements["message"].value.trim();
    if (tel) message += "\n\nTéléphone : " + tel;
    bouton.disabled = true;
    msg.textContent = "Envoi en cours…";
    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
        to_email: "arafinhaiti@gmail.com",
        name: nom,
        email: email,
        message: message,
        time: new Date().toLocaleString("fr-FR")
      });
      msg.textContent = "✅ Merci ! Votre message a bien été envoyé — nous vous répondrons bientôt.";
      form.reset();
    } catch (err) {
      msg.textContent = "❌ L'envoi a échoué. Réessayez, ou écrivez-nous directement à info@arafinhaiti.com.";
    }
    bouton.disabled = false;
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
