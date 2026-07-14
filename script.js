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
const isEnglish = document.documentElement.lang.toLowerCase().startsWith("en");

const uiText = {
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
};

function getApiBaseUrl() {
  const configured = document.documentElement.dataset.apiBaseUrl || "";
  return configured.trim().replace(/\/$/, "");
}

async function submitToBackendApi(formElement) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return false;
  }

  const formData = new FormData(formElement);

  const response = await fetch(`${baseUrl}/api/registrations`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Backend API submission failed.");
  }

  return true;
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
        window.location.href = "success.html";
      }, 800);
    } catch (error) {
      if (formStatus) {
        const hasBackend = Boolean(getApiBaseUrl());
        formStatus.textContent = hasBackend ? uiText.backendFailed : uiText.fallback;
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
