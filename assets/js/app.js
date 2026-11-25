const STATUS_CLASS = {
  "Concluído": "badge-concluido",
  "Em andamento": "badge-andamento",
  "Beta": "badge-beta",
  "Pausado": "badge-pausado",
};

function isSafeUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.startsWith("assets/") || trimmed.startsWith("./assets/")) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}

let allGames = [];

async function loadGames() {
  const grid = document.getElementById("gamesGrid");
  try {
    const res = await fetch(`data/traducoes.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allGames = Array.isArray(data) ? data : [];
    renderGames();
  } catch (err) {
    grid.innerHTML = "";
    const box = createEl("div", "empty-state");
    box.appendChild(createEl("h2", "", "Erro ao carregar traduções"));
    box.appendChild(createEl("p", "", "Tente recarregar a página em alguns instantes."));
    grid.appendChild(box);
  }
}

function renderGames() {
  const grid = document.getElementById("gamesGrid");
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const statusFilter = document.getElementById("statusFilter").value;

  const filtered = allGames.filter((item) => {
    const matchText =
      !query ||
      (item.titulo || "").toLowerCase().includes(query) ||
      (item.descricao || "").toLowerCase().includes(query);
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    return matchText && matchStatus;
  });

  grid.innerHTML = "";

  if (filtered.length === 0) {
    const box = createEl("div", "empty-state");
    box.style.gridColumn = "1 / -1";
    box.appendChild(createEl("h2", "", allGames.length === 0 ? "Nenhuma tradução publicada ainda" : "Nenhum resultado encontrado"));
    box.appendChild(
      createEl(
        "p",
        "",
        allGames.length === 0
          ? "Acesse o Painel Admin para cadastrar a primeira tradução."
          : "Tente buscar por outro nome ou limpar os filtros."
      )
    );
    grid.appendChild(box);
    return;
  }

  for (const game of filtered) {
    const card = createEl("article", "game-card");
    card.tabIndex = 0;

    const coverWrap = createEl("div", "cover-wrap");
    if (isSafeUrl(game.capa)) {
      const img = createEl("img");
      img.src = game.capa;
      img.alt = `Capa de ${game.titulo || "jogo"}`;
      img.loading = "lazy";
      coverWrap.appendChild(img);
    } else {
      coverWrap.appendChild(createEl("div", "cover-placeholder", game.titulo || "Sem capa"));
    }

    const badgeCls = STATUS_CLASS[game.status] || "badge-beta";
    coverWrap.appendChild(createEl("span", `badge cover-badge ${badgeCls}`, game.status || "Em andamento"));
    card.appendChild(coverWrap);

    const body = createEl("div", "card-body");
    body.appendChild(createEl("h2", "card-title", game.titulo || "Sem título"));

    const meta = createEl("div", "card-meta");
    meta.appendChild(createEl("span", "", game.versao || "v1.0"));
    const prog = Math.max(0, Math.min(100, Number(game.progresso ?? 100)));
    meta.appendChild(createEl("span", "", `${prog}%`));
    body.appendChild(meta);

    const bar = createEl("div", "progress-bar");
    const fill = createEl("div", "progress-fill");
    fill.style.width = `${prog}%`;
    bar.appendChild(fill);
    body.appendChild(bar);

    body.appendChild(createEl("p", "card-desc", game.descricao || "Sem descrição."));
    card.appendChild(body);

    const open = () => openModal(game);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    grid.appendChild(card);
  }
}

function openModal(game) {
  const backdrop = document.getElementById("gameModal");
  const coverBox = document.getElementById("modalCover");
  coverBox.innerHTML = "";
  if (isSafeUrl(game.capa)) {
    const img = createEl("img");
    img.src = game.capa;
    img.alt = `Capa de ${game.titulo || "jogo"}`;
    coverBox.appendChild(img);
  } else {
    coverBox.appendChild(createEl("div", "cover-placeholder", game.titulo || "Sem capa"));
  }

  document.getElementById("modalTitle").textContent = game.titulo || "Sem título";

  const badge = document.getElementById("modalBadge");
  badge.className = `badge ${STATUS_CLASS[game.status] || "badge-beta"}`;
  badge.textContent = game.status || "Em andamento";

  document.getElementById("modalVersao").textContent = game.versao || "v1.0";
  document.getElementById("modalProgresso").textContent = `${Math.max(0, Math.min(100, Number(game.progresso ?? 100)))}%`;
  document.getElementById("modalPlataforma").textContent = game.plataforma || "PC";
  document.getElementById("modalAutor").textContent = game.autor || "NexTraduções";

  document.getElementById("modalDesc").textContent = game.descricao || "Sem descrição informada.";
  document.getElementById("modalInstall").textContent = game.instalacao || "Extraia o conteúdo do patch na pasta raiz do jogo.";

  const dlBtn = document.getElementById("modalDownload");
  if (isSafeUrl(game.downloadUrl)) {
    dlBtn.href = game.downloadUrl;
    dlBtn.textContent = game.mirror ? `Baixar Patch (${game.mirror})` : "Baixar Patch";
    dlBtn.classList.remove("hidden");
  } else {
    dlBtn.classList.add("hidden");
  }

  backdrop.classList.add("open");
}

function closeModal() {
  document.getElementById("gameModal").classList.remove("open");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchInput").addEventListener("input", renderGames);
  document.getElementById("statusFilter").addEventListener("change", renderGames);
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("gameModal").addEventListener("click", (e) => {
    if (e.target.id === "gameModal") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
  loadGames();
});