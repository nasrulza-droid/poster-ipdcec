const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");

const title = document.getElementById("admin-status-title");
const desc = document.getElementById("admin-status-desc");
const list = document.getElementById("admin-status-list");

const content = {
  en: {
    title: "Admin Panel Disabled for Security",
    desc:
      "This public static page no longer handles admin login or participant data. A secured backend admin system is required.",
    items: [
      "Client-side passwords and localStorage are not secure for production.",
      "Admin access should use server-side authentication and role checks.",
      "Registration data must be stored in a protected database.",
    ],
  },
  id: {
    title: "Panel Admin Dinonaktifkan Demi Keamanan",
    desc:
      "Halaman statis publik ini tidak lagi menangani login admin atau data peserta. Dibutuhkan sistem admin backend yang aman.",
    items: [
      "Password di sisi klien dan localStorage tidak aman untuk produksi.",
      "Akses admin harus memakai autentikasi sisi server dan pemeriksaan role.",
      "Data pendaftaran wajib disimpan di database yang terlindungi.",
    ],
  },
};

const selected = isEnglish ? content.en : content.id;

if (title) {
  title.textContent = selected.title;
}

if (desc) {
  desc.textContent = selected.desc;
}

if (list) {
  list.innerHTML = selected.items.map((item) => `<li>${item}</li>`).join("");
}
