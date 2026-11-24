// ============================================================
//  ARAFIN — Espace Conseil (admin)
//  ⚠️ CHANGE LE MOT DE PASSE ICI avant de publier le site.
//  C'est un verrou léger : il protège la page d'édition sur un
//  site statique, ce n'est pas une sécurité bancaire.
// ============================================================
const MOT_DE_PASSE = "Arafin@2026";
 
let data; // copie de travail des données
 
function chargerDonnees() {
  try {
    const local = localStorage.getItem("arafin-data");
    if (local) return JSON.parse(local);
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(ARAFIN_DATA)); // copie modifiable
}
 
// ---------- Connexion ----------
document.getElementById("btn-login").addEventListener("click", () => {
  const saisie = document.getElementById("mdp").value;
  if (saisie === MOT_DE_PASSE) {
    document.getElementById("login-box").hidden = true;
    document.getElementById("editor-box").hidden = false;
    data = chargerDonnees();
    remplirFormulaire();
  } else {
    document.getElementById("login-msg").textContent = "Mot de passe incorrect.";
  }
});
document.getElementById("mdp").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btn-login").click();
});
 
// ---------- Formulaire ----------
function remplirFormulaire() {
  document.getElementById("f-annonce").value = data.annonce || "";
  document.getElementById("f-ville").value = data.contact.ville || "";
  document.getElementById("f-email").value = data.contact.email || "";
  document.getElementById("f-tel").value = data.contact.telephone || "";
  afficherMembres();
}
 
function afficherMembres() {
  const zone = document.getElementById("membres-edit");
  zone.innerHTML = "";
  data.conseil.forEach((m, i) => {
    const div = document.createElement("div");
    div.className = "membre-edit";
    div.innerHTML = `
      ${m.photo ? `<img src="${m.photo}" alt="">` : ""}
      <label>Nom</label>
      <input type="text" data-champ="nom" data-i="${i}" value="${m.nom}">
      <label>Rôle</label>
      <input type="text" data-champ="role" data-i="${i}" value="${m.role}">
      <label>Photo</label>
      <input type="file" accept="image/*" data-photo="${i}">
      <div class="admin-row">
        <button class="btn btn-danger" data-supprimer="${i}">Retirer ce membre</button>
      </div>`;
    zone.appendChild(div);
  });
 
  // Nom / rôle : mise à jour en direct
  zone.querySelectorAll("input[data-champ]").forEach(inp => {
    inp.addEventListener("input", () => {
      data.conseil[Number(inp.dataset.i)][inp.dataset.champ] = inp.value;
    });
  });
 
  // Photo : lue et rangée dans les données (voyage dans data.js)
  zone.querySelectorAll("input[data-photo]").forEach(inp => {
    inp.addEventListener("change", () => {
      const fichier = inp.files[0];
      if (!fichier) return;
      const lecteur = new FileReader();
      lecteur.onload = () => {
        data.conseil[Number(inp.dataset.photo)].photo = lecteur.result;
        afficherMembres();
        document.getElementById("save-msg").textContent = "Photo ajoutée — clique « Enregistrer » puis « Télécharger data.js ».";
      };
      lecteur.readAsDataURL(fichier);
    });
  });
 
  // Retirer un membre
  zone.querySelectorAll("button[data-supprimer]").forEach(btn => {
    btn.addEventListener("click", () => {
      data.conseil.splice(Number(btn.dataset.supprimer), 1);
      afficherMembres();
    });
  });
}
 
document.getElementById("btn-ajouter").addEventListener("click", () => {
  data.conseil.push({ nom: "Nouveau membre", role: "Rôle", photo: "" });
  afficherMembres();
});
 
// ---------- Enregistrer / Publier / Réinitialiser ----------
function lireChamps() {
  data.annonce = document.getElementById("f-annonce").value;
  data.contact.ville = document.getElementById("f-ville").value;
  data.contact.email = document.getElementById("f-email").value;
  data.contact.telephone = document.getElementById("f-tel").value;
}
 
document.getElementById("btn-save").addEventListener("click", () => {
  lireChamps();
  localStorage.setItem("arafin-data", JSON.stringify(data));
  document.getElementById("save-msg").textContent = "✅ Enregistré sur cet ordinateur. Ouvre la page d'accueil pour voir le résultat.";
});
 
document.getElementById("btn-download").addEventListener("click", () => {
  lireChamps();
  localStorage.setItem("arafin-data", JSON.stringify(data));
  const contenu = "// ARAFIN — données du site (généré depuis l'Espace Conseil le " +
    new Date().toLocaleDateString("fr-FR") + ")\n" +
    "const ARAFIN_DATA = " + JSON.stringify(data, null, 2) + ";\n";
  const blob = new Blob([contenu], { type: "text/javascript" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "data.js";
  a.click();
  URL.revokeObjectURL(a.href);
  document.getElementById("save-msg").textContent = "⬇️ data.js téléchargé — remplace l'ancien data.js sur GitHub pour publier.";
});
 
document.getElementById("btn-reset").addEventListener("click", () => {
  if (confirm("Tout réinitialiser ? Les modifications non publiées seront perdues.")) {
    localStorage.removeItem("arafin-data");
    data = JSON.parse(JSON.stringify(ARAFIN_DATA));
    remplirFormulaire();
    document.getElementById("save-msg").textContent = "Réinitialisé.";
  }
});