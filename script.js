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
      formStatus.textContent = "Mengirim pendaftaran...";
    }

    const submitButton = registrationForm.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Mengirim...";
    }

    try {
      const formData = new FormData(registrationForm);
      const response = await fetch(registrationForm.action, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Pengiriman gagal.");
      }

      if (formStatus) {
        formStatus.textContent = "Pendaftaran berhasil dikirim. Silakan cek email panitia untuk verifikasi masuk.";
      }

      registrationForm.reset();
      syncParticipantType();
      setTimeout(() => {
        window.location.href = "success.html";
      }, 800);
    } catch (error) {
      if (formStatus) {
        formStatus.textContent = "Koneksi mode cepat gagal. Mencoba kirim ulang dengan mode formulir standar...";
      }

      // Fallback: use native form submission for environments where fetch/CORS is blocked.
      setTimeout(() => {
        registrationForm.submit();
      }, 500);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Kirim Pendaftaran";
      }
    }
  });
}
