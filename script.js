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
    annonceEl.textContent = data.annonce;
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
  if (data.contact.email) contactHTML += `<p>✉️ <a href="mailto:${echapper(data.contact.email)}">${echapper(data.contact.email)}</a></p>`;
  if (data.contact.whatsapp) {
    const chiffres = data.contact.whatsapp.replace(/\D/g, "");
    contactHTML += chiffres
      ? `<p>📞 <a href="https://wa.me/${chiffres}">${echapper(data.contact.whatsapp)}</a> (WhatsApp)</p>`
      : `<p>📞 <strong>${echapper(data.contact.whatsapp)}</strong></p>`;
  }
  if (!data.contact.email && !data.contact.whatsapp) {
    contactHTML += `<p>Les coordonnées directes seront publiées très bientôt — en attendant, contactez un membre du conseil d'administration.</p>`;
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
// ---------- Mosaïque du hero : rotation par thème ----------
(function () {
  const box = document.getElementById("mz");
  if (!box) return;
  const tiles = box.querySelectorAll(".mz-tile");
  // Chaque tuile garde son thème : les photos tournent sans changer de place.
  const pools = [
    ["images/paysan.jpg", "images/recolte-riz.jpg"],                    // Les producteurs
    ["images/motoculteur-orange.jpg", "images/motoculteur-rouge.jpg"], // La mécanisation
    ["images/champ.jpg"],                                               // La terre
    ["images/recolte-riz.jpg", "images/paysan.jpg"],                    // Les récoltes
    ["images/tricycle-bleu.jpg", "images/tricycle-rouge.jpg"],          // Le transport
    ["images/motoculteur-rouge.jpg", "images/tricycle-bleu.jpg"],       // Les équipements
    ["images/hero.jpg", "images/champ.jpg"]                             // Les marchés
  ];
  const pos = pools.map(() => 0);
  pools.flat().forEach(s => { const i = new Image(); i.src = s; });
  let timer = null;
  function tourner(sens) {
    box.classList.add("fading");
    setTimeout(() => {
      tiles.forEach((tile, k) => {
        const p = pools[k];
        if (!p || p.length < 2) return;
        pos[k] = (pos[k] + sens + p.length) % p.length;
        tile.querySelector("img").src = p[pos[k]];
      });
      box.classList.remove("fading");
    }, 360);
  }
  function relancer() { clearInterval(timer); timer = setInterval(() => tourner(1), 7000); }
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
