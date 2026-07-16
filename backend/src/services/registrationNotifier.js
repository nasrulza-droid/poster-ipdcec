import nodemailer from "nodemailer";

function asBoolean(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "true";
}

function parseRecipients(raw) {
  return String(raw || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function createRegistrationNotifier() {
  const smtpUser = String(process.env.SMTP_USER || "").trim();
  const smtpPass = String(process.env.SMTP_PASS || "").trim();
  const recipients = parseRecipients(process.env.REGISTRATION_ALERT_RECIPIENTS);

  if (!smtpUser || !smtpPass || recipients.length === 0) {
    console.warn("[REGISTRATION_EMAIL] disabled because SMTP or recipient config is incomplete.");
    return async () => {};
  }

  const host = String(process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = asBoolean(process.env.SMTP_SECURE) || port === 465;
  const senderName = String(process.env.SMTP_SENDER_NAME || "IPDCEC Registration Alert").trim();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return async function notifyRegistration(registration) {
    const subject = `[IPDCEC] New Registration ${registration.id}`;
    const text = [
      "A new participant registration has been submitted.",
      "",
      `Registration ID: ${registration.id}`,
      `Submitted At: ${registration.submitted_at}`,
      `Participant Type: ${registration.participant_type}`,
      `Leader Name: ${registration.leader_name}`,
      `Member 2: ${registration.member_2 || "-"}`,
      `Member 3: ${registration.member_3 || "-"}`,
      `Email: ${registration.email}`,
      `WhatsApp: ${registration.whatsapp}`,
      `School: ${registration.school_name}`,
      `Country: ${registration.country}`,
      `Poster Title: ${registration.poster_title}`,
      `Subtheme: ${registration.subtheme}`,
    ].join("\n");

    await transporter.sendMail({
      from: `"${senderName}" <${smtpUser}>`,
      to: recipients.join(", "),
      subject,
      text,
    });
  };
}
