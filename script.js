import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

let tickets = [];
let currentUser = null;
let currentFilter = "Todos";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.classList.contains("login-page")) return;

  const saved = localStorage.getItem("currentUser");
  if (!saved) return window.location.href = "login.html";

  currentUser = JSON.parse(saved);

  $("#user-info").innerText =
    `${currentUser.name} - ${currentUser.role === "admin" ? "Administrador" : "Usuário"}`;

  // REMOVER RELATÓRIOS DO MENU PARA USUÁRIO
  if (currentUser.role !== "admin") {
    const rel = document.querySelector('[data-section="relatorios"]');
    rel?.remove();
  }

  // REMOVER FILTROS PROIBIDOS PARA USUÁRIO
  if (currentUser.role !== "admin") {
    document.querySelector('[data-filter="Em Andamento"]')?.remove();
    document.querySelector('[data-filter="Concluído"]')?.remove();
  }

  setupEvents();
  loadTickets();
});

function setupEvents() {
  $$("#sidebar .nav-item").forEach(li =>
    li.addEventListener("click", () => switchSection(li.dataset.section, li))
  );

  $("#new-ticket-btn")?.addEventListener("click", openModal);
  $("#open-new")?.addEventListener("click", openModal);
  $("#logout-btn")?.addEventListener("click", logout);

  $("#save-ticket")?.addEventListener("click", saveTicket);
  $("#cancel-ticket")?.addEventListener("click", closeModal);

  $("#search-ticket")?.addEventListener("input", renderTickets);
  $("#sort-ticket")?.addEventListener("change", renderTickets);

  $$("#tickets-section .filter-btn").forEach(btn =>
    btn.addEventListener("click", (e) => {
      $$(".filter-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.dataset.filter;
      renderTickets();
    })
  );

  $("#gerar-pdf")?.addEventListener("click", gerarPDF);
}

function logout() {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
}

// =========================
// CARREGAR TICKETS COM FILTRO DE USUÁRIO
// =========================
async function loadTickets() {
  let snap;

  if (currentUser.role === "admin") {
    snap = await getDocs(collection(window.db, "tickets"));
  } else {
    const q = query(
      collection(window.db, "tickets"),
      where("author", "==", currentUser.name)
    );
    snap = await getDocs(q);
  }

  tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderTickets();
  updateDashboard();
}

// =========================
// SALVAR TICKET
// =========================
async function saveTicket() {
  const title = $("#ticket-title").value.trim();
  const desc = $("#ticket-desc").value.trim();
  const priority = $("#ticket-priority").value;

  if (!title || !desc) return alert("Preencha todos os campos.");

  await addDoc(collection(window.db, "tickets"), {
    title,
    desc,
    priority,
    status: "Aberto",
    author: currentUser.name,
    date: new Date().toISOString(),
  });

  closeModal();
  await loadTickets();
  switchSection("tickets");
}

// =========================
// RENDERIZAR TICKETS
// =========================
function renderTickets() {
  const container = $("#tickets-container");
  const q = $("#search-ticket").value.toLowerCase();
  const sort = $("#sort-ticket").value;

  let list = tickets.filter(t => {
    const matchFilter = currentFilter === "Todos" || t.status === currentFilter;
    const matchSearch =
      t.title.toLowerCase().includes(q) ||
      t.desc.toLowerCase().includes(q);

    return matchFilter && matchSearch;
  });

  list.sort((a,b)=>
    sort==="newest"
      ? new Date(b.date)-new Date(a.date)
      : new Date(a.date)-new Date(b.date)
  );

  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `<div class="card">Nenhum ticket encontrado.</div>`;
    return;
  }

  list.forEach(t => {
    const div = document.createElement("div");
    div.className = "ticket";

    const isAdmin = currentUser.role === "admin";

    div.innerHTML = `
      <span class="priority priority-${t.priority}">${t.priority}</span>
      <h3>${t.title}</h3>
      <p>${t.desc}</p>

      <div class="meta">
        <span class="status status-${t.status.replace(" ","\\ ")}">${t.status}</span>
        • <small>${new Date(t.date).toLocaleString()}</small>
        <br><small>Criado por: ${t.author}</small>
      </div>

      ${
        isAdmin && t.status !== "Concluído"
        ? `<div class="actions">
             <button class="finish" data-id="${t.id}">Finalizar</button>
           </div>`
        : ""
      }
    `;

    container.appendChild(div);
  });

  if (currentUser.role === "admin") {
    $$(".finish").forEach(btn =>
      btn.addEventListener("click", async e => {
        const id = e.target.dataset.id;
        await updateDoc(doc(window.db, "tickets", id), { status: "Concluído" });
        await loadTickets();
      })
    );
  }
}

// =========================
// DASHBOARD
// =========================
function updateDashboard() {
  const c = { Aberto: 0, "Em Andamento": 0, Concluído: 0 };

  tickets.forEach(t => c[t.status]++);

  $("#count-aberto").innerText = c["Aberto"];
  $("#count-andamento").innerText = c["Em Andamento"];
  $("#count-concluido").innerText = c["Concluído"];
  $("#count-total").innerText = tickets.length;
}

// =========================
// MODAL
// =========================
function openModal() {
  $("#modal-title").innerText = "Novo Ticket";
  $("#ticket-title").value = "";
  $("#ticket-desc").value = "";
  $("#ticket-priority").value = "Baixa";
  $("#ticket-modal").classList.add("show");
}

function closeModal() {
  $("#ticket-modal").classList.remove("show");
}

// =========================
// TROCAR SEÇÃO
// =========================
function switchSection(section, element) {

  $$("#sidebar .nav-item").forEach(li => li.classList.remove("active"));
  element?.classList.add("active");

  $("#dashboard-section").classList.remove("active");
  $("#tickets-section").classList.remove("active");
  $("#relatorios-section").classList.remove("active");

  if (section === "dashboard") $("#dashboard-section").classList.add("active");
  if (section === "tickets") $("#tickets-section").classList.add("active");

  if (section === "relatorios" && currentUser.role === "admin")
    $("#relatorios-section").classList.add("active");

  $("#section-title").innerText =
    section === "dashboard" ? "Dashboard" :
    section === "tickets" ? "Tickets" :
    "Relatórios";
}

// =========================
// GERAR PDF (APENAS ADMIN)
// =========================
function gerarPDF() {
  if (currentUser.role !== "admin")
    return alert("Apenas administradores podem gerar relatórios.");

  if (tickets.length === 0)
    return alert("Nenhum ticket encontrado.");

  let texto = "RELATÓRIO DE TICKETS\n\n";

  tickets.forEach(t => {
    texto +=
      `Título: ${t.title}\n` +
      `Descrição: ${t.desc}\n` +
      `Status: ${t.status}\n` +
      `Prioridade: ${t.priority}\n` +
      `Autor: ${t.author}\n` +
      `Data: ${new Date(t.date).toLocaleString()}\n` +
      "-----------------------------------------\n";
  });

  const blob = new Blob([texto], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorio_tickets.pdf";
  a.click();
}
