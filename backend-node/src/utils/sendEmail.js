import nodemailer from "nodemailer";

// ===== Nodemailer Transporter =====
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ===== Shared email wrapper =====
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorkHub</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 50%,#1e40af 100%);padding:36px 40px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:rgba(255,255,255,0.2);border-radius:12px;padding:10px 12px;vertical-align:middle;">
                    <img src="https://img.icons8.com/fluency/48/monitor.png" alt="WorkHub" width="26" height="26" style="display:block;" />
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">WorkHub</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding:36px 40px 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid #e5e7eb;padding-top:24px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">
                      This email was sent by <strong style="color:#6b7280;">WorkHub</strong>
                    </p>
                    <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">
                      The unified platform for collaboration & productivity
                    </p>
                    <p style="margin:0;font-size:12px;color:#d1d5db;">
                      © ${new Date().getFullYear()} WorkHub Technologies Inc. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ===== Email Verification (OTP) =====
export const sendVerificationEmail = async (email, fullName, otp) => {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">
      Verify your email
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hi <strong style="color:#374151;">${fullName}</strong>, welcome to WorkHub! 🎉<br/>
      Use the verification code below to activate your account.
    </p>

    <!-- OTP Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border:2px dashed #93c5fd;border-radius:16px;padding:24px 48px;">
            <tr>
              <td align="center">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#3b82f6;text-transform:uppercase;letter-spacing:2px;">
                  Verification Code
                </p>
                <p style="margin:0;font-size:40px;font-weight:800;color:#1d4ed8;letter-spacing:12px;font-family:'Courier New',monospace;">
                  ${otp}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Info -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border-left:4px solid #facc15;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <tr>
        <td>
          <p style="margin:0;font-size:13px;color:#854d0e;line-height:1.5;">
            ⏱️ This code will expire in <strong>10 minutes</strong>.<br/>
            If you didn't create an account on WorkHub, please ignore this email.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;color:#9ca3af;text-align:center;">
      Having trouble? Contact us at <a href="mailto:support@workhub.com" style="color:#3b82f6;text-decoration:none;">support@workhub.com</a>
    </p>
  `;

  await transporter.sendMail({
    from: `"WorkHub" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${otp} is your WorkHub verification code`,
    html: baseTemplate(content),
  });
};

// ===== Password Reset =====
export const sendResetPasswordEmail = async (email, fullName, resetLink) => {
  const content = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">
      Reset your password
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hi <strong style="color:#374151;">${fullName}</strong>,<br/>
      We received a request to reset the password for your WorkHub account. Click the button below to create a new password.
    </p>

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <a href="${resetLink}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 48px;border-radius:12px;box-shadow:0 4px 14px rgba(59,130,246,0.4);">
            Reset Password
          </a>
        </td>
      </tr>
    </table>

    <!-- Alternative link -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <tr>
        <td>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">
            Or copy this link:
          </p>
          <p style="margin:0;font-size:12px;color:#3b82f6;word-break:break-all;line-height:1.5;">
            <a href="${resetLink}" style="color:#3b82f6;text-decoration:none;">${resetLink}</a>
          </p>
        </td>
      </tr>
    </table>

    <!-- Warning -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <tr>
        <td>
          <p style="margin:0;font-size:13px;color:#991b1b;line-height:1.5;">
            ⚠️ This link will expire in <strong>15 minutes</strong>.<br/>
            If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;color:#9ca3af;text-align:center;">
      Need help? Contact us at <a href="mailto:support@workhub.com" style="color:#3b82f6;text-decoration:none;">support@workhub.com</a>
    </p>
  `;

  await transporter.sendMail({
    from: `"WorkHub" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your WorkHub password",
    html: baseTemplate(content),
  });
};
