// src/utils/emailService.js
import emailjs from "@emailjs/browser";
import QRCode from "qrcode";

/**
 * Generate an offline QR Code Data URL from a pass URL
 * @param {string} text
 * @returns {Promise<string>}
 */
export const generateQrDataUrl = async (text) => {
  try {
    return await QRCode.toDataURL(text, {
      width: 320,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.error("Failed to generate QR data URL:", err);
    return "";
  }
};

/**
 * Dispatches a digital gate pass email via EmailJS
 *
 * @param {Object} options
 * @param {Object} options.emailConfig - { serviceId, templateId, publicKey }
 * @param {Object} options.brandingConfig - { orgTitle, subtitle, entryNotes, accentColor }
 * @param {string} options.eventName
 * @param {string} options.eventDate
 * @param {string} [options.eventTime]
 * @param {string} [options.venue]
 * @param {string} options.guestName
 * @param {string} options.guestEmail
 * @param {string} options.guestContact
 * @param {string} options.seatLabel - e.g. "Row F - Seat 12"
 * @param {string} options.passUrl - Web pass URL
 * @param {string} [options.qrDataUrl] - Base64 QR code image
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const sendGatePassEmail = async ({
  emailConfig = {},
  brandingConfig = {},
  eventName = "Auditorium Event",
  eventDate = "",
  eventTime = "",
  venue = "GNDEC Main Auditorium, Ludhiana",
  guestName = "",
  guestEmail = "",
  guestContact = "",
  seatLabel = "",
  passUrl = "",
  qrDataUrl = "",
}) => {
  const serviceId =
    emailConfig.serviceId ||
    import.meta.env.VITE_EMAILJS_SERVICE_ID ||
    "service_og3ze6m";
  const templateId =
    emailConfig.templateId ||
    import.meta.env.VITE_EMAILJS_TEMPLATE_ID ||
    "template_xbboh6j";
  const publicKey =
    emailConfig.publicKey ||
    import.meta.env.VITE_EMAILJS_PUBLIC_KEY ||
    "PzNJuoItwBZtKTwOG";

  if (!serviceId || !templateId || !publicKey) {
    return {
      success: false,
      error: "EmailJS credentials not configured.",
    };
  }

  const orgName = brandingConfig.orgTitle || "Cultural Committee GNDEC";
  const formattedTime = eventTime ? ` at ${eventTime}` : "";
  const entryNotes =
    brandingConfig.entryNotes ||
    "Please report 15 minutes before the event starts and present your digital QR pass at the entrance.";

  // Plain-text formatted ticket message for templates using {{message}}
  const messageBody = `
🎟️ OFFICIAL AUDITORIUM GATE PASS
----------------------------------------
Organization: ${orgName}
Event: ${eventName}
Date & Time: ${eventDate}${formattedTime}
Venue: ${venue}

SEAT ALLOCATION: ${seatLabel}
ATTENDEE: ${guestName} (${guestContact})

ACCESS PASS LINK:
${passUrl}

ENTRY GUIDELINES:
${entryNotes}
----------------------------------------
Please present this pass or its QR code at the gate desk for fast-track entry.
`.trim();

  const templateParams = {
    to_name: guestName,
    to_email: guestEmail,
    email: guestEmail,
    recipient_email: guestEmail,
    event_name: eventName,
    event_date: eventDate,
    event_time: eventTime || "Scheduled Time",
    venue,
    seat_label: seatLabel,
    student_name: guestName,
    student_contact: guestContact,
    pass_url: passUrl,
    qr_code: qrDataUrl,
    organization_name: orgName,
    entry_notes: entryNotes,
    message: messageBody,
  };

  try {
    const response = await emailjs.send(
      serviceId,
      templateId,
      templateParams,
      publicKey,
    );
    return {
      success: true,
      response,
    };
  } catch (err) {
    console.error("EmailJS dispatch failed:", err);
    return {
      success: false,
      error: err?.text || err?.message || "Failed to send email.",
    };
  }
};
