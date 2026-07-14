const TOKEN_KEY = "ipdcec_admin_jwt";
const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");

const uiText = {
  missingApi: isEnglish
    ? "API base URL is not configured. Set data-api-base-url on the html tag."
    : "API base URL belum dikonfigurasi. Isi data-api-base-url pada tag html.",
  wrongCredentials: isEnglish ? "Invalid email or password." : "Email atau password tidak valid.",
  loading: isEnglish ? "Loading data..." : "Memuat data...",
  loadFailed: isEnglish ? "Failed to load registrations." : "Gagal memuat data pendaftaran.",
  deleteConfirm: isEnglish ? "Delete this entry?" : "Hapus data ini?",
  unknownStatus: isEnglish ? "Unknown" : "Tidak diketahui",
  loginRequired: isEnglish ? "Login session expired. Please sign in again." : "Sesi login habis. Silakan masuk lagi.",
  csvFile: isEnglish ? "ipdcec-registrations-en.csv" : "ipdcec-registrations.csv",
};

const statusKeys = ["Baru", "Terverifikasi", "Lolos Administrasi", "Ditolak"];
const statusLabels = {
  Baru: isEnglish ? "New" : "Baru",
  Terverifikasi: isEnglish ? "Verified" : "Terverifikasi",
  "Lolos Administrasi": isEnglish ? "Admin Passed" : "Lolos Administrasi",
  Ditolak: isEnglish ? "Rejected" : "Ditolak",
};

const loginSection = document.getElementById("admin-login");
const dashboardSection = document.getElementById("admin-dashboard");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const tableBody = document.getElementById("admin-table-body");
const emptyLabel = document.getElementById("admin-empty");
const searchInput = document.getElementById("search-input");
const filterStatus = document.getElementById("filter-status");

let cachedEntries = [];

function getApiBaseUrl() {
  return (document.documentElement.dataset.apiBaseUrl || "").trim().replace(/\/$/, "");
}

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString(isEnglish ? "en-US" : "id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function labelStatus(status) {
  return statusLabels[status] || uiText.unknownStatus;
}

async function apiRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error(uiText.missingApi);
  }

  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    throw new Error(uiText.loginRequired);
  }

  return response;
}

function calculateStats(entries) {
  const stats = {
    total: entries.length,
    baru: 0,
    verifikasi: 0,
    ditolak: 0,
  };

  entries.forEach((entry) => {
    if (entry.status === "Baru") {
      stats.baru += 1;
    }
    if (entry.status === "Terverifikasi" || entry.status === "Lolos Administrasi") {
      stats.verifikasi += 1;
    }
    if (entry.status === "Ditolak") {
      stats.ditolak += 1;
    }
  });

  document.getElementById("stat-total").textContent = String(stats.total);
  document.getElementById("stat-baru").textContent = String(stats.baru);
  document.getElementById("stat-verifikasi").textContent = String(stats.verifikasi);
  document.getElementById("stat-ditolak").textContent = String(stats.ditolak);
}

function getFilteredEntries() {
  const searchTerm = (searchInput?.value || "").trim().toLowerCase();
  const selectedStatus = filterStatus?.value || "all";

  return cachedEntries
    .slice()
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    .filter((entry) => {
      const matchesStatus = selectedStatus === "all" || entry.status === selectedStatus;
      if (!matchesStatus) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const joined = [
        entry.leader_name,
        entry.email,
        entry.whatsapp,
        entry.school_name,
        entry.country,
        entry.poster_title,
        entry.subtheme,
      ]
        .join(" ")
        .toLowerCase();

      return joined.includes(searchTerm);
    });
}

function renderTable() {
  const entries = getFilteredEntries();
  calculateStats(cachedEntries);

  if (!entries.length) {
    tableBody.innerHTML = "";
    emptyLabel.hidden = false;
    return;
  }

  emptyLabel.hidden = true;
  tableBody.innerHTML = entries
    .map((entry) => {
      const teamInfo = entry.participant_type === "Team"
        ? `${escapeHtml(entry.participant_type)}<br><small>${escapeHtml(entry.member_2 || "-")} | ${escapeHtml(entry.member_3 || "-")}</small>`
        : escapeHtml(entry.participant_type || "Individual");

      return `
        <tr>
          <td>${escapeHtml(formatDate(entry.submitted_at))}</td>
          <td>
            <strong>${escapeHtml(entry.leader_name)}</strong><br>
            <small>${teamInfo}</small>
          </td>
          <td>
            ${escapeHtml(entry.email)}<br>
            <small>${escapeHtml(entry.whatsapp)}</small>
          </td>
          <td>
            ${escapeHtml(entry.school_name)}<br>
            <small>${escapeHtml(entry.country)}</small>
          </td>
          <td>
            ${escapeHtml(entry.subtheme)}<br>
            <small>${escapeHtml(entry.poster_title)}</small>
          </td>
          <td>
            <select data-action="status" data-id="${escapeHtml(entry.id)}">
              ${statusKeys
                .map((status) => `<option value="${status}" ${entry.status === status ? "selected" : ""}>${labelStatus(status)}</option>`)
                .join("")}
            </select>
          </td>
          <td>
            <button data-action="delete" data-id="${escapeHtml(entry.id)}" type="button">${isEnglish ? "Delete" : "Hapus"}</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function refreshEntries() {
  if (emptyLabel) {
    emptyLabel.hidden = false;
    emptyLabel.textContent = uiText.loading;
  }

  const response = await apiRequest("/api/registrations/admin");
  if (!response.ok) {
    throw new Error(uiText.loadFailed);
  }

  cachedEntries = await response.json();

  if (emptyLabel) {
    emptyLabel.textContent = isEnglish
      ? "No registration data stored yet."
      : "Belum ada data pendaftaran tersimpan.";
  }

  renderTable();
}

async function updateStatus(id, status) {
  const response = await apiRequest(`/api/registrations/admin/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(uiText.loadFailed);
  }

  await refreshEntries();
}

async function deleteEntry(id) {
  const response = await apiRequest(`/api/registrations/admin/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(uiText.loadFailed);
  }

  await refreshEntries();
}

async function exportCsv() {
  const response = await apiRequest("/api/registrations/admin/export.csv");
  if (!response.ok) {
    throw new Error(uiText.loadFailed);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = uiText.csvFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showDashboard() {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
}

function showLogin(message = "") {
  loginSection.hidden = false;
  dashboardSection.hidden = true;
  loginStatus.textContent = message;
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "";

  try {
    const email = document.getElementById("admin-email")?.value?.trim() || "";
    const password = document.getElementById("admin-password")?.value || "";

    const response = await apiRequest("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(uiText.wrongCredentials);
    }

    const payload = await response.json();
    if (!payload.token) {
      throw new Error(uiText.wrongCredentials);
    }

    setToken(payload.token);
    showDashboard();
    await refreshEntries();
  } catch (error) {
    loginStatus.textContent = error.message || uiText.wrongCredentials;
  }
});

searchInput?.addEventListener("input", renderTable);
filterStatus?.addEventListener("change", renderTable);

document.getElementById("export-csv")?.addEventListener("click", async () => {
  try {
    await exportCsv();
  } catch (error) {
    if (emptyLabel) {
      emptyLabel.hidden = false;
      emptyLabel.textContent = error.message || uiText.loadFailed;
    }
  }
});

document.getElementById("logout-admin")?.addEventListener("click", () => {
  clearToken();
  showLogin();
});

tableBody?.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === "status" && id) {
    try {
      await updateStatus(id, target.value);
    } catch (error) {
      if (emptyLabel) {
        emptyLabel.hidden = false;
        emptyLabel.textContent = error.message || uiText.loadFailed;
      }
    }
  }
});

tableBody?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === "delete" && id) {
    const ok = window.confirm(uiText.deleteConfirm);
    if (!ok) {
      return;
    }

    try {
      await deleteEntry(id);
    } catch (error) {
      if (emptyLabel) {
        emptyLabel.hidden = false;
        emptyLabel.textContent = error.message || uiText.loadFailed;
      }
    }
  }
});

if (getToken()) {
  showDashboard();
  refreshEntries().catch((error) => {
    showLogin(error.message || uiText.loginRequired);
  });
} else {
  showLogin();
}
