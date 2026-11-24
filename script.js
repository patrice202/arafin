// ARAFIN — affichage public : lit data.js (+ modifications locales de l'admin)
// + animations d'apparition au défilement
 
function chargerDonnees() {
  try {
    const local = localStorage.getItem("arafin-data");
    if (local) return JSON.parse(local);
  } catch (e) { /* on garde data.js */ }
  return ARAFIN_DATA;
}
 
function initiales(nom) {
  return nom.split(" ").map(m => m[0]).slice(0, 2).join("").toUpperCase();
}
 
const data = chargerDonnees();
 
// Bandeau d'annonce
const annonceEl = document.getElementById("annonce");
if (data.annonce && data.annonce.trim() !== "") {
  annonceEl.textContent = data.annonce;
  annonceEl.hidden = false;
}
 
// Conseil d'administration
const grid = document.getElementById("conseil-grid");
data.conseil.forEach((m, i) => {
  const div = document.createElement("div");
  div.className = "membre reveal";
  div.style.transitionDelay = (i * 90) + "ms";
  const aPhoto = m.photo && m.photo.trim() !== "";
  const photo = aPhoto
    ? `<img src="${m.photo}" alt="Photo de ${m.nom}">`
    : `<div class="initiales">${initiales(m.nom)}</div>`;
  const attente = aPhoto ? "" : `<span class="attente">Photo à venir</span>`;
  div.innerHTML = `${photo}<h3>${m.nom}</h3><p class="role">${m.role}</p>${attente}`;
  grid.appendChild(div);
});
 
// Contact
const contactEl = document.getElementById("contact-infos");
let contactHTML = `<p>📍 <strong>${data.contact.ville}</strong></p>`;
if (data.contact.email) contactHTML += `<p>✉️ <a href="mailto:${data.contact.email}">${data.contact.email}</a></p>`;
if (data.contact.telephone) contactHTML += `<p>📞 <strong>${data.contact.telephone}</strong></p>`;
if (!data.contact.email && !data.contact.telephone) {
  contactHTML += `<p>Les coordonnées directes seront publiées très bientôt en attendant, contactez un membre du conseil d'administration.</p>`;
}
contactEl.innerHTML = contactHTML;
 
// Animations : les éléments .reveal apparaissent en douceur quand on arrive dessus
const observateur = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add("visible");
      observateur.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach(el => observateur.observe(el));
