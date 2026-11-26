const STATUS_CLASS = {
  "Concluído": "badge-concluido",
  "Em andamento": "badge-andamento",
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

function resolveCover(url) {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("assets/")) return `../${trimmed}`;
  if (trimmed.startsWith("./assets/")) return `../${trimmed.slice(2)}`;
  return trimmed;
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("id");

  const loading = document.getElementById("loadingState");
  const notFound = document.getElementById("notFoundState");
  const content = document.getElementById("gameContent");

  if (!gameId) {
    loading.classList.add("hidden");
    notFound.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`../data/traducoes.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    const game = Array.isArray(list) ? list.find((g) => g.id === gameId) : null;

    if (!game) {
      loading.classList.add("hidden");
      notFound.classList.remove("hidden");
      return;
    }

    document.title = `${game.titulo || "Jogo"} — NexTraduções`;

    const coverBox = document.getElementById("gameCover");
    coverBox.innerHTML = "";
    if (isSafeUrl(game.capa)) {
      const resolved = resolveCover(game.capa);
      document.getElementById("gameHeroBg").style.backgroundImage = `url("${resolved.replace(/"/g, '\\"')}")`;
      const img = document.createElement("img");
      img.src = resolved;
      img.alt = `Capa de ${game.titulo || "jogo"}`;
      coverBox.appendChild(img);
    } else {
      const ph = document.createElement("div");
      ph.className = "cover-placeholder";
      ph.textContent = game.titulo || "Sem capa";
      coverBox.appendChild(ph);
    }

    const status = game.status === "Concluído" ? "Concluído" : "Em andamento";
    const badge = document.getElementById("gameBadge");
    badge.className = `badge ${STATUS_CLASS[status] || "badge-andamento"}`;
    badge.textContent = status;

    const genre = document.getElementById("gameGenre");
    if (game.genero) {
      genre.textContent = game.genero;
    } else {
      genre.classList.add("hidden");
    }

    document.getElementById("gameTitle").textContent = game.titulo || "Sem título";
    document.getElementById("gameVersao").textContent = game.versao || "v1.0";
    document.getElementById("gameProgresso").textContent = `${Math.max(0, Math.min(100, Number(game.progresso ?? 100)))}%`;
    document.getElementById("gamePlataforma").textContent = game.plataforma || "PC";
    document.getElementById("gameAutor").textContent = game.autor || "NexTraduções";
    document.getElementById("gameData").textContent = game.atualizadoEm || "—";

    const actions = document.getElementById("gameActions");
    actions.innerHTML = "";
    if (isSafeUrl(game.downloadUrl)) {
      const dl = document.createElement("a");
      dl.className = "btn btn-primary";
      dl.href = game.downloadUrl;
      dl.target = "_blank";
      dl.rel = "noopener noreferrer";
      dl.textContent = game.mirror ? `Baixar Patch (${game.mirror})` : "Baixar Patch";
      actions.appendChild(dl);
    } else {
      const notice = document.createElement("div");
      notice.className = "wip-notice";
      notice.textContent = "Tradução em andamento — patch ainda não disponível para download.";
      actions.appendChild(notice);
    }

    if (isSafeUrl(game.lojaUrl)) {
      const store = document.createElement("a");
      store.className = "btn";
      store.href = game.lojaUrl;
      store.target = "_blank";
      store.rel = "noopener noreferrer";
      store.textContent = "Página do Jogo";
      actions.appendChild(store);
    }

    document.getElementById("gameDesc").textContent = game.descricao || "Nenhuma descrição informada.";
    document.getElementById("gameInstall").textContent =
      game.instalacao ||
      (isSafeUrl(game.downloadUrl)
        ? "Extraia o conteúdo do patch na pasta raiz do jogo."
        : "As instruções serão publicadas assim que o patch for lançado.");

    loading.classList.add("hidden");
    content.classList.remove("hidden");
  } catch {
    loading.classList.add("hidden");
    notFound.classList.remove("hidden");
  }
});