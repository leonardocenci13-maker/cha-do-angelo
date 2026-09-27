import { firebaseConfig, ADMIN_EMAILS } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let isAdmin = false;
let products = [];
let claims = [];
let editingProductId = null;
let activeClaimProduct = null;

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const loginBtn = $("login-btn");
const logoutBtn = $("logout-btn");
const userInfo = $("user-info");
const authSection = $("auth-section");
const tabs = $("tabs");
const appEl = $("app");
const adminTabBtn = $("admin-tab-btn");
const productsGrid = $("products-grid");
const emptyGuest = $("empty-guest");
const adminProductsList = $("admin-products-list");
const productForm = $("product-form");
const groupCheckbox = $("p-group");
const qtyField = $("qty-field");
const cancelEditBtn = $("cancel-edit");
const formTitle = $("form-title");

// ---------- Auth ----------
loginBtn.addEventListener("click", () => {
  signInWithPopup(auth, provider).catch((err) => toast("Erro ao entrar: " + err.message));
});
logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    isAdmin = ADMIN_EMAILS.includes(user.email);
    loginBtn.hidden = true;
    userInfo.hidden = false;
    $("user-photo").src = user.photoURL || "";
    $("user-name").textContent = user.displayName + (isAdmin ? " (pais)" : "");
    tabs.hidden = false;
    appEl.hidden = false;
    adminTabBtn.hidden = !isAdmin;
    listenProducts();
    listenClaims();
  } else {
    loginBtn.hidden = false;
    userInfo.hidden = true;
    tabs.hidden = true;
    appEl.hidden = true;
  }
});

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.hidden) return;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
  });
});

// ---------- Firestore listeners ----------
function listenProducts() {
  const q = query(collection(db, "products"), orderBy("createdAt", "asc"));
  onSnapshot(q, (snap) => {
    products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderGuestView();
    renderAdminView();
  });
}

function listenClaims() {
  onSnapshot(collection(db, "claims"), (snap) => {
    claims = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderGuestView();
    renderAdminView();
  });
}

// ---------- Helpers ----------
function claimsFor(productId) {
  return claims.filter((c) => c.productId === productId);
}
function claimedQty(productId) {
  return claimsFor(productId).reduce((sum, c) => sum + (c.quantity || 1), 0);
}
function myClaim(productId) {
  if (!currentUser) return null;
  return claims.find((c) => c.productId === productId && c.uid === currentUser.uid);
}
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => (t.hidden = true), 3000);
}

// ---------- Guest view ----------
function renderGuestView() {
  productsGrid.innerHTML = "";
  emptyGuest.hidden = products.length > 0;

  products.forEach((p) => {
    const needed = p.groupAllowed ? (p.quantityNeeded || 1) : 1;
    const got = p.groupAllowed ? claimedQty(p.id) : (claimsFor(p.id).length > 0 ? 1 : 0);
    const full = got >= needed;
    const mine = myClaim(p.id);

    const card = document.createElement("div");
    card.className = "product-card";

    const img = p.imageUrl
      ? `<img class="product-img" src="${escapeAttr(p.imageUrl)}" alt="">`
      : `<div class="product-img placeholder">🎁</div>`;

    let statusPill = "";
    if (mine) statusPill = `<span class="status-pill mine">Você vai dar ✅</span>`;
    else if (full) statusPill = `<span class="status-pill taken">Já garantido 💚</span>`;
    else statusPill = `<span class="status-pill">Disponível</span>`;

    let progressHtml = "";
    if (p.groupAllowed) {
      const pct = Math.min(100, Math.round((got / needed) * 100));
      progressHtml = `
        <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
        <div class="progress-label">${got} de ${needed} confirmados</div>`;
    }

    const visibleContributors = claimsFor(p.id).filter(
      (c) => c.public || (currentUser && c.uid === currentUser.uid) || isAdmin
    );
    const anonCount = claimsFor(p.id).length - visibleContributors.length;
    let contribHtml = "";
    if (claimsFor(p.id).length > 0) {
      const names = visibleContributors.map((c) => escapeHtml(c.name.split(" ")[0]));
      if (anonCount > 0) names.push(`${anonCount} anônimo(s)`);
      contribHtml = `<div class="contributors">Quem já confirmou: ${names.join(", ")}</div>`;
    }

    card.innerHTML = `
      ${img}
      <div class="product-body">
        ${statusPill}
        <h3>${escapeHtml(p.name)}</h3>
        ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
        ${p.link ? `<a class="product-link" href="${escapeAttr(p.link)}" target="_blank" rel="noopener">Ver na loja ↗</a>` : ""}
        ${progressHtml}
        ${contribHtml}
      </div>
      <div class="product-footer"></div>
    `;

    const footer = card.querySelector(".product-footer");
    const btn = document.createElement("button");
    btn.className = "btn " + (mine ? "btn-danger" : "btn-primary");
    btn.textContent = mine ? "Ver / cancelar meu presente" : (full ? "Ver detalhes" : "🎁 Vou presentear");
    btn.addEventListener("click", () => openClaimModal(p));
    footer.appendChild(btn);

    productsGrid.appendChild(card);
  });
}

// ---------- Claim modal ----------
const modal = $("claim-modal");
$("modal-close").addEventListener("click", closeModal);
$("modal-cancel-claim").addEventListener("click", async () => {
  const mine = myClaim(activeClaimProduct.id);
  if (mine) {
    await deleteDoc(doc(db, "claims", mine.id));
    toast("Presente cancelado.");
  }
  closeModal();
});

function openClaimModal(product) {
  activeClaimProduct = product;
  const needed = product.groupAllowed ? (product.quantityNeeded || 1) : 1;
  const got = product.groupAllowed ? claimedQty(product.id) : (claimsFor(product.id).length > 0 ? 1 : 0);
  const remaining = Math.max(0, needed - got);
  const mine = myClaim(product.id);

  $("modal-title").textContent = product.name;
  $("modal-qty-row").hidden = !product.groupAllowed;
  $("modal-qty").max = mine ? remaining + (mine.quantity || 1) : remaining;
  $("modal-qty").value = mine ? (mine.quantity || 1) : Math.min(1, remaining || 1);
  $("modal-public").checked = mine ? mine.public !== false : true;
  $("modal-cancel-claim").hidden = !mine;
  $("modal-confirm").textContent = mine ? "Atualizar" : "Confirmar presente";

  if (!mine && remaining <= 0) {
    $("modal-remaining").textContent = "Este presente já foi totalmente garantido, mas você ainda pode confirmar se quiser ajudar do mesmo jeito 💚";
  } else if (product.groupAllowed) {
    $("modal-remaining").textContent = `Faltam ${remaining} unidade(s) de ${needed}.`;
  } else {
    $("modal-remaining").textContent = "";
  }

  modal.hidden = false;
}
function closeModal() {
  modal.hidden = true;
  activeClaimProduct = null;
}

$("modal-confirm").addEventListener("click", async () => {
  if (!currentUser || !activeClaimProduct) return;
  const qty = activeClaimProduct.groupAllowed ? Math.max(1, parseInt($("modal-qty").value) || 1) : 1;
  const isPublic = $("modal-public").checked;
  const claimId = `${activeClaimProduct.id}_${currentUser.uid}`;

  await setDoc(doc(db, "claims", claimId), {
    productId: activeClaimProduct.id,
    uid: currentUser.uid,
    name: currentUser.displayName,
    email: currentUser.email,
    quantity: qty,
    public: isPublic,
    createdAt: Date.now()
  });

  toast("Presente confirmado! Obrigado 💚");
  closeModal();
});

// ---------- Admin: form ----------
groupCheckbox.addEventListener("change", () => {
  qtyField.style.display = groupCheckbox.checked ? "flex" : "none";
});
qtyField.style.display = "none";

cancelEditBtn.addEventListener("click", resetForm);

function resetForm() {
  editingProductId = null;
  productForm.reset();
  qtyField.style.display = "none";
  formTitle.textContent = "➕ Adicionar presente";
  cancelEditBtn.hidden = true;
}

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const data = {
    name: $("p-name").value.trim(),
    description: $("p-desc").value.trim(),
    link: $("p-link").value.trim(),
    imageUrl: $("p-image").value.trim(),
    groupAllowed: groupCheckbox.checked,
    quantityNeeded: groupCheckbox.checked ? Math.max(1, parseInt($("p-qty").value) || 1) : 1
  };

  if (!data.name) return;

  if (editingProductId) {
    await updateDoc(doc(db, "products", editingProductId), data);
    toast("Presente atualizado!");
  } else {
    data.createdAt = Date.now();
    await addDoc(collection(db, "products"), data);
    toast("Presente adicionado!");
  }
  resetForm();
});

// ---------- Admin: list ----------
function renderAdminView() {
  if (!isAdmin) return;
  adminProductsList.innerHTML = "";

  products.forEach((p) => {
    const row = document.createElement("div");
    row.className = "admin-product-row";

    const productClaims = claimsFor(p.id);
    const claimText = productClaims.length
      ? productClaims.map((c) => `${escapeHtml(c.name)}${c.quantity > 1 ? ` (${c.quantity})` : ""}${c.public ? "" : " 🔒"}`).join(", ")
      : "Ninguém confirmou ainda";

    row.innerHTML = `
      <div class="info">
        <h4>${escapeHtml(p.name)} ${p.groupAllowed ? `(grupo — ${claimedQty(p.id)}/${p.quantityNeeded || 1})` : ""}</h4>
        <p>${escapeHtml(p.description || "")}</p>
        <div class="claim-list">🎁 ${claimText}</div>
      </div>
      <div class="admin-row-actions"></div>
    `;

    const actions = row.querySelector(".admin-row-actions");
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-ghost btn-small";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", () => startEdit(p));

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger btn-small";
    delBtn.textContent = "Excluir";
    delBtn.addEventListener("click", () => deleteProduct(p));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    adminProductsList.appendChild(row);
  });
}

function startEdit(p) {
  editingProductId = p.id;
  $("p-name").value = p.name || "";
  $("p-desc").value = p.description || "";
  $("p-link").value = p.link || "";
  $("p-image").value = p.imageUrl || "";
  groupCheckbox.checked = !!p.groupAllowed;
  qtyField.style.display = p.groupAllowed ? "flex" : "none";
  $("p-qty").value = p.quantityNeeded || 1;
  formTitle.textContent = "✏️ Editar presente";
  cancelEditBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteProduct(p) {
  if (!confirm(`Excluir "${p.name}"? Isso também removerá as confirmações desse presente.`)) return;
  const relatedClaims = await getDocs(query(collection(db, "claims"), where("productId", "==", p.id)));
  await Promise.all(relatedClaims.docs.map((d) => deleteDoc(doc(db, "claims", d.id))));
  await deleteDoc(doc(db, "products", p.id));
  toast("Presente excluído.");
}

// ---------- utils ----------
function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}
