const OWNER = "nextraducoes";
const REPO = "nextraducoes.github.io";
const DATA_PATH = "data/traducoes.json";
const TOKEN_KEY = "nextraducoes_gh_token";
const STATUS_CLASS = {
  "Concluído": "badge-concluido",
  "Em andamento": "badge-andamento",
  
  
};

let currentToken = "";
let gamesList = [];
let dataSha = "";
let editingId = null;
let selectedCoverFile = null;
let currentPreviewDataUrl = "";

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function base64ToUtf8(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo de imagem."));
    reader.readAsDataURL(file);
  });
}

function slugify(text) {
  return String(text || "jogo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "jogo";
}

function showAlert(msg, type = "success") {
  const box = document.getElementById("alertBox");
  box.textContent = msg;
  box.className = `alert ${type === "error" ? "alert-error" : "alert-success"}`;
  box.classList.remove("hidden");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideAlert() {
  document.getElementById("alertBox").classList.add("hidden");
}

async function ghFetch(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${currentToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.message) detail = errJson.message;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

async function verifyAndLoad(token) {
  currentToken = token.trim();
  const repoInfo = await ghFetch(`/repos/${OWNER}/${REPO}`);
  if (!repoInfo.permissions || !repoInfo.permissions.push) {
    throw new Error("Este token não tem permissão de escrita neste repositório.");
  }
  localStorage.setItem(TOKEN_KEY, currentToken);
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("adminSection").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");
  await fetchGamesFromApi();
  syncDownloadRequirement(); syncLivePreview();
}

async function fetchGamesFromApi() {
  const fileData = await ghFetch(`/repos/${OWNER}/${REPO}/contents/${DATA_PATH}?ref=main&t=${Date.now()}`);
  dataSha = fileData.sha;
  const decoded = base64ToUtf8(fileData.content);
  const parsed = JSON.parse(decoded);
  gamesList = Array.isArray(parsed) ? parsed : [];
  renderAdminList();
}

async function saveGamesToApi(message) {
  const latest = await ghFetch(`/repos/${OWNER}/${REPO}/contents/${DATA_PATH}?ref=main&t=${Date.now()}`);
  dataSha = latest.sha;

  const jsonStr = JSON.stringify(gamesList, null, 2) + "\n";
  const res = await ghFetch(`/repos/${OWNER}/${REPO}/contents/${DATA_PATH}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: utf8ToBase64(jsonStr),
      sha: dataSha,
      branch: "main",
    }),
  });
  dataSha = res.content.sha;
}

async function uploadCoverFile(file, title) {
  const extMatch = (file.name || "").match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "png";
  const filePath = `assets/capas/${slugify(title)}-${Date.now()}.${ext}`;
  const b64 = await fileToBase64(file);

  await ghFetch(`/repos/${OWNER}/${REPO}/contents/${filePath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `chore: upload cover ${filePath}`,
      content: b64,
      branch: "main",
    }),
  });
  return filePath;
}

function syncLivePreview() {
  const titulo = document.getElementById("titulo").value.trim() || "Nome do Jogo";
  const genero = document.getElementById("genero").value || "RPG";
  const status = document.getElementById("status").value || "Concluído";
  const prog = Math.max(0, Math.min(100, Number(document.getElementById("progresso").value || 0)));
  const versao = document.getElementById("versao").value.trim() || "v1.0";
  const autor = document.getElementById("autor").value.trim() || "NexTraduções";
  const desc = document.getElementById("descricao").value.trim() || "A descrição do projeto aparecerá aqui.";
  const capaUrl = document.getElementById("capaUrl").value.trim();

  document.getElementById("liveCardTitle").textContent = titulo;
  document.getElementById("liveCardGenre").textContent = genero;
  const stEl = document.getElementById("liveCardStatus");
  stEl.textContent = status;
  stEl.className = `badge cover-badge ${STATUS_CLASS[status] || "badge-beta"}`;
  document.getElementById("liveCardVersion").textContent = versao;
  document.getElementById("liveCardProgressText").textContent = `${prog}%`;
  document.getElementById("liveCardProgressBar").style.width = `${prog}%`;
  document.getElementById("liveCardDesc").textContent = desc;
  document.getElementById("liveCardAuthor").textContent = autor;

  const imgSrc = currentPreviewDataUrl || capaUrl;
  const liveImg = document.getElementById("liveCardImg");
  const livePh = document.getElementById("liveCardPlaceholder");
  if (imgSrc) {
    liveImg.src = imgSrc.startsWith("http") || imgSrc.startsWith("data:") ? imgSrc : `../${imgSrc}`;
    liveImg.classList.remove("hidden");
    livePh.classList.add("hidden");
  } else {
    liveImg.classList.add("hidden");
    livePh.classList.remove("hidden");
    livePh.textContent = titulo;
  }
}

function renderAdminList() {
  const container = document.getElementById("adminList");
  container.innerHTML = "";

  if (gamesList.length === 0) {
    const p = document.createElement("p");
    p.style.color = "var(--muted)";
    p.textContent = "Nenhuma tradução cadastrada ainda.";
    container.appendChild(p);
    return;
  }

  for (const game of gamesList) {
    const row = document.createElement("div");
    row.className = "admin-item";

    const left = document.createElement("div");
    left.className = "admin-item-left";

    if (game.capa) {
      const img = document.createElement("img");
      img.className = "admin-thumb";
      img.src = game.capa.startsWith("http") ? game.capa : `../${game.capa}`;
      img.alt = game.titulo || "Capa";
      left.appendChild(img);
    }

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = (game.destaque ? "★ " : "") + (game.titulo || "Sem título");
    info.appendChild(title);

    const sub = document.createElement("div");
    sub.style.fontSize = "0.82rem";
    sub.style.color = "var(--muted)";
    sub.textContent = `${game.status || "Em andamento"} • ${game.progresso ?? 100}% • ${game.versao || "v1.0"}${game.genero ? " • " + game.genero : ""}`;
    info.appendChild(sub);

    left.appendChild(info);
    row.appendChild(left);

    const actions = document.createElement("div");
    actions.className = "admin-item-actions";

    const openLink = document.createElement("a"); openLink.className = "btn btn-sm"; openLink.textContent = "Abrir"; openLink.href = `../jogo/?id=${encodeURIComponent(game.id)}`; openLink.target = "_blank"; actions.appendChild(openLink); const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-sm";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", () => loadIntoForm(game));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-sm btn-danger";
    delBtn.textContent = "Excluir";
    delBtn.addEventListener("click", () => deleteGame(game.id, game.titulo));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    row.appendChild(actions);

    container.appendChild(row);
  }
}

function loadIntoForm(game) {
  editingId = game.id;
  selectedCoverFile = null;
  currentPreviewDataUrl = "";
  document.getElementById("coverFile").value = "";
  document.getElementById("formHeading").textContent = `Editando: ${game.titulo}`;
  document.getElementById("submitBtn").textContent = "Salvar Alterações";
  document.getElementById("cancelEditBtn").classList.remove("hidden");

  document.getElementById("titulo").value = game.titulo || "";
  document.getElementById("genero").value = game.genero || "RPG";
  document.getElementById("status").value = game.status || "Concluído";
  document.getElementById("progresso").value = game.progresso ?? 100;
  document.getElementById("versao").value = game.versao || "";
  document.getElementById("plataforma").value = game.plataforma || "";
  document.getElementById("autor").value = game.autor || "";
  document.getElementById("lojaUrl").value = game.lojaUrl || "";
  document.getElementById("capaUrl").value = game.capa || "";
  document.getElementById("downloadUrl").value = game.downloadUrl || "";
  document.getElementById("mirror").value = game.mirror || "";
  document.getElementById("destaque").checked = Boolean(game.destaque);
  document.getElementById("descricao").value = game.descricao || "";
  document.getElementById("instalacao").value = game.instalacao || "";

  updateCoverPreview(game.capa || "");
  syncDownloadRequirement(); syncLivePreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  selectedCoverFile = null;
  currentPreviewDataUrl = "";
  document.getElementById("gameForm").reset();
  document.getElementById("progresso").value = 100;
  document.getElementById("plataforma").value = "PC (Steam / GOG / Epic)";
  document.getElementById("autor").value = "NexTraduções";
  document.getElementById("formHeading").textContent = "Nova Tradução";
  document.getElementById("submitBtn").textContent = "Publicar Tradução";
  document.getElementById("cancelEditBtn").classList.add("hidden");
  updateCoverPreview("");
  syncDownloadRequirement(); syncLivePreview();
}

function updateCoverPreview(src) {
  const img = document.getElementById("coverPreview");
  if (!src) {
    img.classList.add("hidden");
    img.removeAttribute("src");
    return;
  }
  img.src = src.startsWith("http") || src.startsWith("data:") ? src : `../${src}`;
  img.classList.remove("hidden");
}

async function deleteGame(id, titulo) {
  if (!confirm(`Tem certeza que deseja excluir "${titulo}"?`)) return;
  hideAlert();
  try {
    gamesList = gamesList.filter((g) => g.id !== id);
    await saveGamesToApi(`chore: remove translation ${titulo}`);
    renderAdminList();
    if (editingId === id) resetForm();
    showAlert(`"${titulo}" excluída! O site público atualizará em ~1 minuto.`);
  } catch (err) {
    showAlert(`Erro ao excluir: ${err.message}`, "error");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const saved = localStorage.getItem(TOKEN_KEY);
  if (saved) {
    try {
      await verifyAndLoad(saved);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  ["titulo", "genero", "status", "progresso", "versao", "autor", "descricao", "capaUrl"].forEach((id) => {
    document.getElementById(id).addEventListener("input", syncLivePreview);
    document.getElementById(id).addEventListener("change", () => { syncDownloadRequirement(); syncLivePreview(); });
  });

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();
    const token = document.getElementById("tokenInput").value;
    const btn = document.getElementById("loginBtn");
    btn.disabled = true;
    btn.textContent = "Verificando...";
    try {
      await verifyAndLoad(token);
      showAlert("Conectado com sucesso ao repositório!");
    } catch (err) {
      showAlert(`Falha na autenticação: ${err.message}`, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar no Painel";
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    currentToken = "";
    document.getElementById("adminSection").classList.add("hidden");
    document.getElementById("loginSection").classList.remove("hidden");
    document.getElementById("logoutBtn").classList.add("hidden");
    document.getElementById("tokenInput").value = "";
    hideAlert();
  });

  document.getElementById("coverFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    selectedCoverFile = file || null;
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        currentPreviewDataUrl = String(reader.result || "");
        updateCoverPreview(currentPreviewDataUrl);
        syncDownloadRequirement(); syncLivePreview();
      };
      reader.readAsDataURL(file);
    } else {
      currentPreviewDataUrl = "";
      updateCoverPreview(document.getElementById("capaUrl").value.trim());
      syncDownloadRequirement(); syncLivePreview();
    }
  });

  document.getElementById("capaUrl").addEventListener("input", (e) => {
    if (!selectedCoverFile) {
      updateCoverPreview(e.target.value.trim());
      syncDownloadRequirement(); syncLivePreview();
    }
  });

  document.getElementById("cancelEditBtn").addEventListener("click", resetForm);

  document.getElementById("gameForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();
    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "Publicando...";

    try {
      const titulo = document.getElementById("titulo").value.trim();
      let capa = document.getElementById("capaUrl").value.trim();

      if (selectedCoverFile) {
        btn.textContent = "Enviando capa...";
        capa = await uploadCoverFile(selectedCoverFile, titulo);
      }

      const isDestaque = document.getElementById("destaque").checked;
      if (isDestaque) {
        gamesList = gamesList.map((g) => ({ ...g, destaque: false }));
      }

      const entry = {
        id: editingId || `${slugify(titulo)}-${Date.now()}`,
        titulo,
        genero: document.getElementById("genero").value,
        status: document.getElementById("status").value,
        progresso: Number(document.getElementById("progresso").value || 0),
        versao: document.getElementById("versao").value.trim() || "v1.0",
        plataforma: document.getElementById("plataforma").value.trim() || "PC",
        autor: document.getElementById("autor").value.trim() || "NexTraduções",
        lojaUrl: document.getElementById("lojaUrl").value.trim(),
        capa,
        downloadUrl: document.getElementById("downloadUrl").value.trim(),
        mirror: document.getElementById("mirror").value.trim(),
        destaque: isDestaque,
        descricao: document.getElementById("descricao").value.trim(),
        instalacao: document.getElementById("instalacao").value.trim(),
        atualizadoEm: new Date().toISOString().slice(0, 10),
      };

      btn.textContent = "Salvando dados...";
      if (editingId) {
        const idx = gamesList.findIndex((g) => g.id === editingId);
        if (idx >= 0) gamesList[idx] = entry;
        else gamesList.unshift(entry);
        await saveGamesToApi(`feat: update translation ${titulo}`);
        showAlert(`"${titulo}" atualizada! O site público atualizará em ~1 minuto.`);
      } else {
        gamesList.unshift(entry);
        await saveGamesToApi(`feat: add translation ${titulo}`);
        showAlert(`"${titulo}" publicada! O site público atualizará em ~1 minuto.`);
      }

      resetForm();
      renderAdminList();
    } catch (err) {
      showAlert(`Erro ao salvar: ${err.message}`, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
});
function syncDownloadRequirement() {
  const status = document.getElementById("status").value;
  const input = document.getElementById("downloadUrl");
  const label = document.getElementById("downloadUrlLabel");
  if (!input || !label) return;
  if (status === "Em andamento") {
    input.required = false;
    label.textContent = "Link Externo de Download (opcional em andamento)";
  } else {
    input.required = true;
    label.textContent = "Link Externo de Download *";
  }
}