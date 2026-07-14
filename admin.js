const STORAGE_KEY = "ipdcec_registrations_v1";
const ADMIN_SESSION_KEY = "ipdcec_admin_authed";
const ADMIN_PASSWORD = "ipdcec-admin-2026";

const loginSection = document.getElementById("admin-login");
const dashboardSection = document.getElementById("admin-dashboard");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const tableBody = document.getElementById("admin-table-body");
const emptyLabel = document.getElementById("admin-empty");
const searchInput = document.getElementById("search-input");
const filterStatus = document.getElementById("filter-status");

function getEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
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
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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
  const searchTerm = (searchInput.value || "").trim().toLowerCase();
  const selectedStatus = filterStatus.value;

  return getEntries()
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
  calculateStats(getEntries());

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
              <option value="Baru" ${entry.status === "Baru" ? "selected" : ""}>Baru</option>
              <option value="Terverifikasi" ${entry.status === "Terverifikasi" ? "selected" : ""}>Terverifikasi</option>
              <option value="Lolos Administrasi" ${entry.status === "Lolos Administrasi" ? "selected" : ""}>Lolos Administrasi</option>
              <option value="Ditolak" ${entry.status === "Ditolak" ? "selected" : ""}>Ditolak</option>
            </select>
          </td>
          <td>
            <button data-action="delete" data-id="${escapeHtml(entry.id)}" type="button">Hapus</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function updateStatus(id, status) {
  const entries = getEntries();
  const updated = entries.map((entry) => {
    if (entry.id === id) {
      return { ...entry, status, updated_at: new Date().toISOString() };
    }
    return entry;
  });
  setEntries(updated);
  renderTable();
}

function deleteEntry(id) {
  const entries = getEntries();
  const updated = entries.filter((entry) => entry.id !== id);
  setEntries(updated);
  renderTable();
}

function convertToCsv(rows) {
  const headers = [
    "id",
    "submitted_at",
    "status",
    "participant_type",
    "leader_name",
    "member_2",
    "member_3",
    "email",
    "whatsapp",
    "school_name",
    "country",
    "poster_title",
    "subtheme",
    "files",
  ];

  const lines = [headers.join(",")];

  rows.forEach((row) => {
    const values = headers.map((key) => {
      const value = key === "files" ? (row.files || []).join(" | ") : (row[key] || "");
      const safe = String(value).replaceAll('"', '""');
      return `"${safe}"`;
    });
    lines.push(values.join(","));
  });

  return lines.join("\n");
}

function exportCsv() {
  const entries = getEntries().sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  const csv = convertToCsv(entries);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ipdcec-registrations.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showDashboard() {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  renderTable();
}

function showLogin() {
  loginSection.hidden = false;
  dashboardSection.hidden = true;
}

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const password = document.getElementById("admin-password").value;

  if (password !== ADMIN_PASSWORD) {
    loginStatus.textContent = "Password salah.";
    return;
  }

  sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
  loginStatus.textContent = "";
  showDashboard();
});

searchInput?.addEventListener("input", renderTable);
filterStatus?.addEventListener("change", renderTable);

document.getElementById("export-csv")?.addEventListener("click", exportCsv);
document.getElementById("logout-admin")?.addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  showLogin();
});

tableBody?.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === "status" && id) {
    updateStatus(id, target.value);
  }
});

tableBody?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;

  if (action === "delete" && id) {
    const ok = window.confirm("Hapus data ini dari admin panel?");
    if (ok) {
      deleteEntry(id);
    }
  }
});

if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") {
  showDashboard();
} else {
  showLogin();
}
