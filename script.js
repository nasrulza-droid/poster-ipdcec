const deadlineNode = document.querySelector(".countdown");

function setCountdown() {
  if (!deadlineNode) {
    return;
  }

  const targetTime = new Date(deadlineNode.dataset.deadline).getTime();
  const now = Date.now();
  const diff = targetTime - now;

  const dayEl = document.getElementById("days");
  const hourEl = document.getElementById("hours");
  const minuteEl = document.getElementById("minutes");
  const secondEl = document.getElementById("seconds");

  if (diff <= 0) {
    dayEl.textContent = "00";
    hourEl.textContent = "00";
    minuteEl.textContent = "00";
    secondEl.textContent = "00";
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  dayEl.textContent = String(days).padStart(2, "0");
  hourEl.textContent = String(hours).padStart(2, "0");
  minuteEl.textContent = String(minutes).padStart(2, "0");
  secondEl.textContent = String(seconds).padStart(2, "0");
}

setCountdown();
setInterval(setCountdown, 1000);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
      }
    });
  },
  { threshold: 0.18 }
);

document.querySelectorAll(".reveal").forEach((node) => {
  observer.observe(node);
});

const registrationForm = document.getElementById("registration-form");
const formStatus = document.getElementById("form-status");
const teamFields = document.getElementById("team-fields");
const memberTwoInput = registrationForm?.querySelector('input[name="member_2"]');
const participantTypeOptions = registrationForm?.querySelectorAll('input[name="participant_type"]');
const participantAuthBox = document.getElementById("participant-auth");
const participantAuthStatus = document.getElementById("participant-auth-status");
const participantRegisterForm = document.getElementById("participant-register-form");
const participantLoginForm = document.getElementById("participant-login-form");
const participantSession = document.getElementById("participant-session");
const participantSessionText = document.getElementById("participant-session-text");
const participantLogoutBtn = document.getElementById("participant-logout");
const registrationFieldsLock = document.getElementById("registration-fields-lock");
const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");
const participantTokenKey = "ipdcecParticipantToken";

const uiText = {
  registerSending: isEnglish ? "Creating account..." : "Membuat akun...",
  registerSuccess: isEnglish ? "Account created. Continue by logging in." : "Akun berhasil dibuat. Lanjutkan dengan login.",
  loginSending: isEnglish ? "Signing in..." : "Masuk...",
  loginSuccess: isEnglish ? "Login successful. You can now fill in competition data." : "Login berhasil. Sekarang kamu bisa mengisi data lomba.",
  loggedInAs: isEnglish ? "Logged in as" : "Masuk sebagai",
  logout: isEnglish ? "Logout" : "Keluar",
  mustLogin: isEnglish
    ? "Please register and login first before filling out the competition form."
    : "Silakan daftar akun dan login dulu sebelum mengisi formulir lomba.",
  authUnavailable: isEnglish
    ? "Participant authentication requires backend API. Set data-api-base-url first."
    : "Autentikasi peserta butuh backend API. Isi data-api-base-url terlebih dulu.",
  sending: isEnglish ? "Submitting registration..." : "Mengirim pendaftaran...",
  sendingButton: isEnglish ? "Submitting..." : "Mengirim...",
  sendButton: isEnglish ? "Submit Registration" : "Kirim Pendaftaran",
  success: isEnglish
    ? "Registration submitted successfully. Please check committee email verification updates."
    : "Pendaftaran berhasil dikirim. Silakan cek email panitia untuk verifikasi masuk.",
  fallback: isEnglish
    ? "Fast mode failed. Retrying with standard form submission..."
    : "Koneksi mode cepat gagal. Mencoba kirim ulang dengan mode formulir standar...",
  backendFailed: isEnglish
    ? "Submission to secured API failed. Please try again in a moment."
    : "Pengiriman ke API aman gagal. Silakan coba beberapa saat lagi.",
  unauthorizedSubmit: isEnglish
    ? "Session is missing or expired. Please login again."
    : "Sesi tidak ada atau kedaluwarsa. Silakan login ulang.",
};

function getApiBaseUrl() {
  const configured = document.documentElement.dataset.apiBaseUrl || "";
  return configured.trim().replace(/\/$/, "");
}

function getNormalizedEmail(rawEmail) {
  return String(rawEmail || "").trim().toLowerCase();
}

async function submitToBackendApi(formElement) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return false;
  }

  const participantToken = sessionStorage.getItem(participantTokenKey) || "";
  if (!participantToken) {
    throw new Error("UNAUTHORIZED_PARTICIPANT");
  }

  const formData = new FormData(formElement);

  const response = await fetch(`${baseUrl}/api/registrations`, {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${participantToken}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("UNAUTHORIZED_PARTICIPANT");
  }

  if (!response.ok) {
    throw new Error("Backend API submission failed.");
  }

  return true;
}

function setParticipantAuthStatus(message) {
  if (participantAuthStatus) {
    participantAuthStatus.textContent = message || "";
  }
}

function setRegistrationLocked(locked) {
  if (!registrationFieldsLock) {
    return;
  }

  registrationFieldsLock.disabled = locked;
  registrationFieldsLock.classList.toggle("is-locked", locked);
}

function clearParticipantSession() {
  sessionStorage.removeItem(participantTokenKey);
  sessionStorage.removeItem("ipdcecParticipantEmail");
  sessionStorage.removeItem("ipdcecParticipantName");
}

function setParticipantSession(user, token) {
  sessionStorage.setItem(participantTokenKey, token);
  sessionStorage.setItem("ipdcecParticipantEmail", String(user.email || ""));
  sessionStorage.setItem("ipdcecParticipantName", String(user.full_name || ""));
}

function renderParticipantSession() {
  const email = sessionStorage.getItem("ipdcecParticipantEmail") || "";
  const fullName = sessionStorage.getItem("ipdcecParticipantName") || "";
  const isLoggedIn = Boolean(sessionStorage.getItem(participantTokenKey));

  if (!participantSession || !participantSessionText) {
    return;
  }

  participantSession.hidden = !isLoggedIn;
  if (isLoggedIn) {
    const displayName = fullName || email;
    participantSessionText.textContent = `${uiText.loggedInAs}: ${displayName}`;
    setRegistrationLocked(false);
  } else {
    participantSessionText.textContent = "";
    setRegistrationLocked(true);
  }
}

async function validateParticipantSession() {
  const baseUrl = getApiBaseUrl();
  const token = sessionStorage.getItem(participantTokenKey) || "";
  if (!token) {
    clearParticipantSession();
    renderParticipantSession();
    return;
  }

  if (!baseUrl) {
    clearParticipantSession();
    renderParticipantSession();
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/auth/participant/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("invalid session");
    }

    const payload = await response.json();
    const user = payload?.user || {};
    sessionStorage.setItem("ipdcecParticipantEmail", String(user.email || ""));
    sessionStorage.setItem("ipdcecParticipantName", String(user.full_name || ""));
  } catch {
    clearParticipantSession();
  }

  renderParticipantSession();
}

async function handleParticipantRegister(event) {
  event.preventDefault();
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    setParticipantAuthStatus(uiText.authUnavailable);
    return;
  }

  const formData = new FormData(event.currentTarget);
  const fullName = String(formData.get("full_name") || "").trim();
  const email = getNormalizedEmail(formData.get("email"));
  const password = String(formData.get("password") || "");

  setParticipantAuthStatus(uiText.registerSending);

  try {
    const response = await fetch(`${baseUrl}/api/auth/participant/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setParticipantAuthStatus(payload.message || uiText.backendFailed);
      return;
    }

    setParticipantAuthStatus(uiText.registerSuccess);
    participantRegisterForm?.reset();
  } catch {
    setParticipantAuthStatus(uiText.backendFailed);
  }
}

async function handleParticipantLogin(event) {
  event.preventDefault();
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    setParticipantAuthStatus(uiText.authUnavailable);
    return;
  }

  const formData = new FormData(event.currentTarget);
  const email = getNormalizedEmail(formData.get("email"));
  const password = String(formData.get("password") || "");

  setParticipantAuthStatus(uiText.loginSending);

  try {
    const response = await fetch(`${baseUrl}/api/auth/participant/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setParticipantAuthStatus(payload.message || uiText.backendFailed);
      return;
    }

    setParticipantSession(payload.user || {}, payload.token || "");
    renderParticipantSession();
    setParticipantAuthStatus(uiText.loginSuccess);
    participantLoginForm?.reset();
  } catch {
    setParticipantAuthStatus(uiText.backendFailed);
  }
}

function handleParticipantLogout() {
  clearParticipantSession();
  renderParticipantSession();
  setParticipantAuthStatus(uiText.mustLogin);
}

function syncParticipantType() {
  if (!participantTypeOptions || !teamFields) {
    return;
  }

  const selectedType = document.querySelector('input[name="participant_type"]:checked')?.value;
  const isTeam = selectedType === "Team";

  teamFields.hidden = !isTeam;
  if (memberTwoInput) {
    memberTwoInput.required = isTeam;
  }
}

participantTypeOptions?.forEach((option) => {
  option.addEventListener("change", syncParticipantType);
});

syncParticipantType();

if (registrationForm) {
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (participantAuthBox && !sessionStorage.getItem(participantTokenKey)) {
      if (formStatus) {
        formStatus.textContent = uiText.mustLogin;
      }
      return;
    }

    if (formStatus) {
      formStatus.textContent = uiText.sending;
    }

    const submitButton = registrationForm.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = uiText.sendingButton;
    }

    try {
      const hasBackend = Boolean(getApiBaseUrl());
      if (hasBackend) {
        await submitToBackendApi(registrationForm);
      } else {
        const formData = new FormData(registrationForm);
        const response = await fetch(registrationForm.action, {
          method: "POST",
          body: formData,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Submission failed.");
        }
      }

      if (formStatus) {
        formStatus.textContent = uiText.success;
      }

      registrationForm.reset();
      syncParticipantType();
      setTimeout(() => {
        window.location.href = isEnglish ? "success-en.html" : "success.html";
      }, 800);
    } catch (error) {
      if (formStatus) {
        const hasBackend = Boolean(getApiBaseUrl());
        if (hasBackend && error instanceof Error && error.message === "UNAUTHORIZED_PARTICIPANT") {
          formStatus.textContent = uiText.unauthorizedSubmit;
        } else {
          formStatus.textContent = hasBackend ? uiText.backendFailed : uiText.fallback;
        }
      }

      if (!getApiBaseUrl()) {
        // Fallback: use native form submission for environments where fetch/CORS is blocked.
        setTimeout(() => {
          registrationForm.submit();
        }, 500);
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = uiText.sendButton;
      }
    }
  });
}

if (participantRegisterForm) {
  participantRegisterForm.addEventListener("submit", handleParticipantRegister);
}

if (participantLoginForm) {
  participantLoginForm.addEventListener("submit", handleParticipantLogin);
}

if (participantLogoutBtn) {
  participantLogoutBtn.textContent = uiText.logout;
  participantLogoutBtn.addEventListener("click", handleParticipantLogout);
}

if (participantAuthBox) {
  if (!getApiBaseUrl()) {
    setParticipantAuthStatus(uiText.authUnavailable);
    setRegistrationLocked(true);
    validateParticipantSession();
  } else {
    setParticipantAuthStatus(uiText.mustLogin);
    validateParticipantSession();
  }
}
