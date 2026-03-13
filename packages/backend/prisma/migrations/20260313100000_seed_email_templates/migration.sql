-- Seed 5 default email templates for document workflow notifications.
-- Uses ON CONFLICT DO NOTHING so this migration is idempotent.

INSERT INTO "FND_EMAIL_TEMPLATES" (
  "id", "code", "name", "subject", "body_html", "variables", "is_active", "created_at", "updated_at"
) VALUES
(
  gen_random_uuid(),
  'document_submission',
  'Document Submission Notification',
  '{{documentType}} #{{documentNumber}} Submitted for Review',
  '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:Inter,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#111b2e;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:#2E3192;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">{{orgName}}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#ffffff;font-size:18px;font-weight:600;">Document Submitted for Review</h2>
          <p style="margin:0 0 12px;color:#d1d5db;font-size:14px;line-height:1.6;">
            A <strong style="color:#80D1E9;">{{documentType}}</strong> has been submitted and requires your review.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;">
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;width:140px;">Document Number</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">#{{documentNumber}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Document Type</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{documentType}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Date</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{date}}</td></tr>
          </table>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">Please log in to review and take action on this document.</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.1);">
          <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.5;">This is an automated notification from {{orgName}}. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>',
  '["orgName","documentType","documentNumber","date"]',
  true,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'document_approval',
  'Document Approval Notification',
  '{{documentType}} #{{documentNumber}} Approved',
  '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:Inter,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#111b2e;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:#2E3192;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">{{orgName}}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#34d399;font-size:18px;font-weight:600;">Document Approved</h2>
          <p style="margin:0 0 12px;color:#d1d5db;font-size:14px;line-height:1.6;">
            <strong style="color:#80D1E9;">{{documentType}}</strong> <strong style="color:#ffffff;">#{{documentNumber}}</strong> has been approved.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;">
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;width:140px;">Document Number</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">#{{documentNumber}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Document Type</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{documentType}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Approved By</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{approverName}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Date</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{date}}</td></tr>
          </table>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">The document is now approved and ready for the next stage in the workflow.</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.1);">
          <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.5;">This is an automated notification from {{orgName}}. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>',
  '["orgName","documentType","documentNumber","approverName","date"]',
  true,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'document_rejection',
  'Document Rejection Notification',
  '{{documentType}} #{{documentNumber}} Rejected',
  '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:Inter,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#111b2e;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:#2E3192;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">{{orgName}}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 16px;color:#ef4444;font-size:18px;font-weight:600;">Document Rejected</h2>
          <p style="margin:0 0 12px;color:#d1d5db;font-size:14px;line-height:1.6;">
            <strong style="color:#80D1E9;">{{documentType}}</strong> <strong style="color:#ffffff;">#{{documentNumber}}</strong> has been rejected.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;">
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;width:140px;">Document Number</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">#{{documentNumber}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Document Type</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{documentType}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Rejected By</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{rejectorName}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Reason</td>
                <td style="padding:8px 0;color:#fca5a5;font-size:13px;font-weight:500;">{{reason}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Date</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{date}}</td></tr>
          </table>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">Please review the rejection reason and resubmit the document with the necessary corrections.</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.1);">
          <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.5;">This is an automated notification from {{orgName}}. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>',
  '["orgName","documentType","documentNumber","rejectorName","reason","date"]',
  true,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'sla_breach',
  'SLA Breach Notification',
  'SLA Breach: {{documentType}} #{{documentNumber}}',
  '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:Inter,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#111b2e;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:#2E3192;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">{{orgName}}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <div style="display:inline-block;background-color:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:8px 16px;margin-bottom:16px;">
            <span style="color:#fca5a5;font-size:13px;font-weight:600;">SLA BREACH ALERT</span>
          </div>
          <h2 style="margin:0 0 16px;color:#f59e0b;font-size:18px;font-weight:600;">Service Level Agreement Breached</h2>
          <p style="margin:0 0 12px;color:#d1d5db;font-size:14px;line-height:1.6;">
            <strong style="color:#80D1E9;">{{documentType}}</strong> <strong style="color:#ffffff;">#{{documentNumber}}</strong> has exceeded its SLA deadline and requires immediate attention.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;">
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;width:140px;">Document Number</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">#{{documentNumber}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Document Type</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{documentType}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">SLA Deadline</td>
                <td style="padding:8px 0;color:#fca5a5;font-size:13px;font-weight:500;">{{slaDeadline}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Current Status</td>
                <td style="padding:8px 0;color:#f59e0b;font-size:13px;font-weight:500;">{{status}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Date</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{date}}</td></tr>
          </table>
          <p style="margin:24px 0 0;color:#fca5a5;font-size:13px;font-weight:500;">Please take immediate action to resolve this breach.</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.1);">
          <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.5;">This is an automated notification from {{orgName}}. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>',
  '["orgName","documentType","documentNumber","slaDeadline","status","date"]',
  true,
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'escalation',
  'Document Escalation Notification',
  '{{documentType}} #{{documentNumber}} Escalated',
  '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0a1628;font-family:Inter,system-ui,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a1628;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#111b2e;border-radius:12px;overflow:hidden;">
        <tr><td style="background-color:#2E3192;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">{{orgName}}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <div style="display:inline-block;background-color:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:8px 16px;margin-bottom:16px;">
            <span style="color:#fbbf24;font-size:13px;font-weight:600;">ESCALATION NOTICE</span>
          </div>
          <h2 style="margin:0 0 16px;color:#f59e0b;font-size:18px;font-weight:600;">Document Escalated</h2>
          <p style="margin:0 0 12px;color:#d1d5db;font-size:14px;line-height:1.6;">
            <strong style="color:#80D1E9;">{{documentType}}</strong> <strong style="color:#ffffff;">#{{documentNumber}}</strong> has been escalated to your attention and requires priority review.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;width:100%;">
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;width:140px;">Document Number</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">#{{documentNumber}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Document Type</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{documentType}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Escalated From</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{escalatedFrom}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Reason</td>
                <td style="padding:8px 0;color:#fbbf24;font-size:13px;font-weight:500;">{{reason}}</td></tr>
            <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Date</td>
                <td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:500;">{{date}}</td></tr>
          </table>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">Please log in to review and take action on this escalated document promptly.</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.1);">
          <p style="margin:0;color:#6b7280;font-size:11px;line-height:1.5;">This is an automated notification from {{orgName}}. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>',
  '["orgName","documentType","documentNumber","escalatedFrom","reason","date"]',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("code") DO NOTHING;
