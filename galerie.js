// ARAFIN — page Galerie publique
// Les photos sont publiées par les membres du Conseil depuis l'Espace
// Conseil (collection Firestore « galerie »), après vérification
// automatique de chaque image. Ici : lecture seule + visionneuse.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

function echapper(txt) {
  return String(txt ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- Visionneuse plein écran ----------
const lb = document.getElementById("lightbox");
function ouvrirLB(p) {
  document.getElementById("lb-img").src = p.photo;
  document.getElementById("lb-legende").textContent = p.legende || "";
  const date = p.date ? new Date(p.date).toLocaleDateString("fr-FR") : "";
  document.getElementById("lb-meta").textContent =
    "📷 " + (p.auteurNom || "") + (date ? " — " + date : "");
  lb.hidden = false;
}
document.getElementById("lb-close").addEventListener("click", () => { lb.hidden = true; });
lb.addEventListener("click", e => { if (e.target === lb) lb.hidden = true; });
document.addEventListener("keydown", e => { if (e.key === "Escape") lb.hidden = true; });

// ---------- Chargement des photos ----------
(async function charger() {
  const grid = document.getElementById("galerie-grid");
  const vide = document.getElementById("galerie-vide");
  let photos = [];
  try {
    const snap = await getDocs(query(collection(db, "galerie"), orderBy("date", "desc")));
    photos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    photos = [];
  }
  if (!photos.length) { vide.hidden = false; return; }
  vide.hidden = true;
  photos.forEach((p, i) => {
    const fig = document.createElement("figure");
    fig.className = "galerie-item reveal";
    fig.style.transitionDelay = (i % 8 * 60) + "ms";
    const date = p.date ? new Date(p.date).toLocaleDateString("fr-FR") : "";
    const legende = echapper(p.legende || "");
    fig.innerHTML =
      `<img src="${echapper(p.photo)}" alt="${legende || "Photo ARAFIN"}" loading="lazy">` +
      `<figcaption>${legende}<small>📷 ${echapper(p.auteurNom || "")}${date ? " — " + date : ""}</small></figcaption>`;
    fig.addEventListener("click", () => ouvrirLB(p));
    grid.appendChild(fig);
  });
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
})();
