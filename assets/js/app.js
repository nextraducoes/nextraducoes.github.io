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
let activeStatus = "all";

async function loadGames() {
  const grid = document.getElementById("gamesGrid");
  try {
    const res = await fetch(`data/traducoes.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allGames = Array.isArray(data) ? data : [];
    updateStats();
    updateHero();
    renderGames();
  } catch {
    grid.innerHTML = "";
    const box = createEl("div", "empty-state");
    box.style.gridColumn = "1 / -1";
    box.appendChild(createEl("h2", "", "Erro ao carregar traduções"));
    box.appendChild(createEl("p", "", "Tente recarregar a página em alguns instantes."));
    grid.appendChild(box);
  }
}

function updateStats() {
  const total = allGames.length;
  const done = allGames.filter((g) => g.status === "Concluído" || Number(g.progresso) === 100).length;
  const wip = allGames.filter((g) => g.status === "Em andamento" || g.status === "Beta").length;

  document.getElementById("statTotal").textContent = String(total);
  document.getElementById("statDone").textContent = String(done);
  document.getElementById("statWip").textContent = String(wip);
}

function updateHero() {
  if (allGames.length === 0) return;

  const featured = allGames.find((g) => g.destaque === true) || allGames[0];
  document.getElementById("heroBadgeText").textContent = featured.destaque
    ? "Destaque da Equipe"
    : "Lançamento Recente";
  document.getElementById("heroTitle").textContent = featured.titulo || "Tradução em Destaque";
  document.getElementById("heroDesc").textContent =
    featured.descricao || "Confira a ficha técnica completa e baixe o patch de tradução para PC.";

  const bg = document.getElementById("heroBg");
  const poster = document.getElementById("heroPoster");
  poster.innerHTML = "";

  if (isSafeUrl(featured.capa)) {
    bg.style.backgroundImage = `url("${featured.capa.replace(/"/g, '\\"')}")`;
    const img = createEl("img");
    img.src = featured.capa;
    img.alt = `Capa de ${featured.titulo || "jogo"}`;
    poster.appendChild(img);
    poster.classList.remove("hidden");
  } else {
    bg.style.backgroundImage = "";
    poster.classList.add("hidden");
  }

  const actions = document.getElementById("heroActions");
  actions.innerHTML = "";

  if (isSafeUrl(featured.downloadUrl)) {
    const dl = createEl("a", "btn btn-primary", featured.mirror ? `Baixar Patch (${featured.mirror})` : "Baixar Patch");
    dl.href = featured.downloadUrl;
    dl.target = "_blank";
    dl.rel = "noopener noreferrer";
    actions.appendChild(dl);
  }

  const detailsBtn = createEl("button", "btn", "Ver Ficha Técnica");
  detailsBtn.type = "button";
  detailsBtn.addEventListener("click", () => openModal(featured));
  actions.appendChild(detailsBtn);
}

function renderGames() {
  const grid = document.getElementById("gamesGrid");
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const genreFilter = document.getElementById("genreFilter").value;
  const sortBy = document.getElementById("sortFilter").value;

  const filtered = allGames.filter((item) => {
    const matchText =
      !query ||
      (item.titulo || "").toLowerCase().includes(query) ||
      (item.descricao || "").toLowerCase().includes(query) ||
      (item.autor || "").toLowerCase().includes(query);
    const matchStatus = activeStatus === "all" || item.status === activeStatus;
    const matchGenre = genreFilter === "all" || (item.genero || "Outro") === genreFilter;
    return matchText && matchStatus && matchGenre;
  });

  if (sortBy === "az") {
    filtered.sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "", "pt-BR"));
  } else if (sortBy === "progress") {
    filtered.sort((a, b) => Number(b.progresso ?? 0) - Number(a.progresso ?? 0));
  }

  grid.innerHTML = "";

  if (filtered.length === 0) {
    const box = createEl("div", "empty-state");
    box.style.gridColumn = "1 / -1";
    box.appendChild(
      createEl(
        "h2",
        "",
        allGames.length === 0 ? "Nenhuma tradução publicada ainda" : "Nenhum jogo encontrado"
      )
    );
    box.appendChild(
      createEl(
        "p",
        "",
        allGames.length === 0
          ? "Acesse o Painel Admin para cadastrar a primeira tradução."
          : "Tente buscar por outro nome ou limpar os filtros selecionados."
      )
    );
    grid.appendChild(box);
    return;
  }

  filtered.forEach((game, idx) => {
    const card = createEl("article", "game-card");
    card.tabIndex = 0;
    card.style.animationDelay = `${Math.min(idx * 60, 420)}ms`;

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

    coverWrap.appendChild(createEl("div", "cover-gradient"));

    const badgeCls = STATUS_CLASS[game.status] || "badge-beta";
    coverWrap.appendChild(createEl("span", `badge cover-badge ${badgeCls}`, game.status || "Em andamento"));

    const prog = Math.max(0, Math.min(100, Number(game.progresso ?? 100)));
    const bottomMeta = createEl("div", "cover-bottom-meta");
    bottomMeta.appendChild(createEl("span", "", game.genero || "PC"));
    bottomMeta.appendChild(createEl("span", "", `${game.versao || "v1.0"} • ${prog}%`));
    coverWrap.appendChild(bottomMeta);

    card.appendChild(coverWrap);

    const info = createEl("div", "card-info");
    info.appendChild(createEl("h3", "card-title", game.titulo || "Sem título"));
    info.appendChild(createEl("p", "card-sub", game.autor || "NexTraduções"));
    card.appendChild(info);

    const open = () => openModal(game);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    grid.appendChild(card);
  });
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

  const genreBadge = document.getElementById("modalGenre");
  if (game.genero) {
    genreBadge.textContent = game.genero;
    genreBadge.classList.remove("hidden");
  } else {
    genreBadge.classList.add("hidden");
  }

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

  const storeBtn = document.getElementById("modalStore");
  if (isSafeUrl(game.lojaUrl)) {
    storeBtn.href = game.lojaUrl;
    storeBtn.classList.remove("hidden");
  } else {
    storeBtn.classList.add("hidden");
  }

  backdrop.classList.add("open");
}

function closeModal() {
  document.getElementById("gameModal").classList.remove("open");
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", renderGames);
  document.getElementById("genreFilter").addEventListener("change", renderGames);
  document.getElementById("sortFilter").addEventListener("change", renderGames);

  document.querySelectorAll("#statusPills .pill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#statusPills .pill-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeStatus = btn.dataset.status || "all";
      renderGames();
    });
  });

  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("gameModal").addEventListener("click", (e) => {
    if (e.target.id === "gameModal") closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  loadGames();
});