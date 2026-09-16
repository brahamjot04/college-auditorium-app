/**
 * Default HTML gate pass template and variable metadata for EmailJS.
 * This template can be customized in the EmailJS dashboard.
 */

export const EMAIL_PASS_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Digital Gate Pass - {{event_name}}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    td {
      padding: 0;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f1f5f9;
      padding: 30px 10px;
    }
    .main-card {
      background-color: #ffffff;
      margin: 0 auto;
      max-width: 580px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #ffffff;
      padding: 5px 14px;
      border-radius: 30px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .event-title {
      font-size: 24px;
      font-weight: 800;
      margin: 0 0 6px 0;
      line-height: 1.25;
      color: #ffffff;
    }
    .org-title {
      font-size: 14px;
      color: #bfdbfe;
      margin: 0;
      font-weight: 500;
    }
    .content-body {
      padding: 30px 24px;
    }
    .greeting {
      font-size: 16px;
      color: #334155;
      margin: 0 0 20px 0;
      line-height: 1.5;
    }
    .seat-hero {
      background-color: #eff6ff;
      border: 2px dashed #3b82f6;
      border-radius: 16px;
      padding: 20px;
      text-align: center;
      margin-bottom: 25px;
    }
    .seat-label-title {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #2563eb;
      margin: 0 0 4px 0;
    }
    .seat-label-val {
      font-size: 26px;
      font-weight: 900;
      color: #1e3a8a;
      margin: 0;
    }
    .details-table {
      width: 100%;
      margin-bottom: 25px;
    }
    .details-row td {
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
    }
    .details-label {
      color: #64748b;
      font-weight: 600;
      width: 35%;
    }
    .details-value {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .qr-container {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px 20px;
      text-align: center;
      margin-bottom: 25px;
    }
    .qr-title {
      font-size: 13px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 14px 0;
    }
    .qr-image {
      background: #ffffff;
      padding: 10px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      display: inline-block;
      max-width: 180px;
      width: 100%;
      height: auto;
    }
    .qr-note {
      font-size: 12px;
      color: #64748b;
      margin: 12px 0 0 0;
    }
    .btn-container {
      text-align: center;
      margin-bottom: 25px;
    }
    .btn-pass {
      display: inline-block;
      background: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 15px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .guidelines-box {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 25px;
    }
    .guidelines-title {
      font-size: 13px;
      font-weight: 700;
      color: #92400e;
      margin: 0 0 4px 0;
    }
    .guidelines-text {
      font-size: 12.5px;
      color: #b45309;
      margin: 0;
      line-height: 1.45;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-card">
      
      <!-- Header -->
      <div class="header">
        <div class="badge">Official Gate Pass</div>
        <h1 class="event-title">{{event_name}}</h1>
        <p class="org-title">{{organization_name}}</p>
      </div>

      <!-- Main Body Content -->
      <div class="content-body">
        <p class="greeting">
          Hello <strong>{{to_name}}</strong>,<br>
          Your seat reservation for <strong>{{event_name}}</strong> has been confirmed. Below are your event access details and your digital QR admission pass:
        </p>

        <!-- Seat Highlight Card -->
        <div class="seat-hero">
          <div class="seat-label-title">Reserved Seat</div>
          <div class="seat-label-val">{{seat_label}}</div>
        </div>

        <!-- Event & Attendee Details -->
        <table class="details-table" role="presentation">
          <tr class="details-row">
            <td class="details-label">Date & Time</td>
            <td class="details-value">{{event_date}} • {{event_time}}</td>
          </tr>
          <tr class="details-row">
            <td class="details-label">Venue</td>
            <td class="details-value">{{venue}}</td>
          </tr>
          <tr class="details-row">
            <td class="details-label">Attendee Name</td>
            <td class="details-value">{{student_name}}</td>
          </tr>
          <tr class="details-row">
            <td class="details-label">Contact Number</td>
            <td class="details-value">{{student_contact}}</td>
          </tr>
        </table>

        <!-- QR Code Display -->
        <div class="qr-container">
          <div class="qr-title">Scan at Gate for Entry</div>
          <img src="{{qr_code}}" alt="QR Admission Pass" class="qr-image" width="180" height="180" />
          <p class="qr-note">Present this QR code on your mobile screen at the entrance check-in desk.</p>
        </div>

        <!-- Open Pass Button -->
        <div class="btn-container">
          <a href="{{pass_url}}" target="_blank" class="btn-pass">View Live Digital Pass</a>
        </div>

        <!-- Guidelines / Notes -->
        <div class="guidelines-box">
          <div class="guidelines-title">Gate Entry Instructions</div>
          <p class="guidelines-text">{{entry_notes}}</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p style="margin: 0 0 6px 0;">This is an automated access pass issued by {{organization_name}}.</p>
        <p style="margin: 0;">Please keep this email secure. Do not share your pass link or QR code with unauthorized persons.</p>
      </div>

    </div>
  </div>
</body>
</html>`;

export const EMAIL_TEMPLATE_VARIABLES = [
  { tag: "{{to_name}}", desc: "Attendee Full Name" },
  { tag: "{{to_email}}", desc: "Recipient Email Address" },
  { tag: "{{event_name}}", desc: "Title of Event" },
  { tag: "{{event_date}}", desc: "Date of Event" },
  { tag: "{{event_time}}", desc: "Time of Event" },
  { tag: "{{venue}}", desc: "Venue / Auditorium Name" },
  { tag: "{{seat_label}}", desc: "Reserved Seat Label (e.g. B-12)" },
  { tag: "{{student_name}}", desc: "Student / Attendee Name" },
  { tag: "{{student_contact}}", desc: "Attendee Contact Number" },
  { tag: "{{pass_url}}", desc: "Live Digital Gate Pass Web URL" },
  { tag: "{{qr_code}}", desc: "QR Code Data URL (Image Source)" },
  { tag: "{{organization_name}}", desc: "Committee / College Name" },
  { tag: "{{entry_notes}}", desc: "Gate Instructions & Guidelines" },
  { tag: "{{message}}", desc: "Custom Notification Message" },
];
