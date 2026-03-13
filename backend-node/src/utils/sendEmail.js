import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logoPath = path.resolve(__dirname, "../assets/WorkHub_logo_blue_background.png");


const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorkHub</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0213;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0213;padding:40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color:rgba(255, 255, 255, 0.02);border-radius:24px;overflow:hidden;box-shadow:0 8px 32px rgba(192, 38, 211, 0.15);border:1px solid rgba(255,255,255,0.08);">
          
          <!-- Header (Dark Theme) -->
          <tr>
            <td style="padding:40px 40px 20px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center">
                    <img src="cid:workhublogo" alt="WorkHub Logo" width="56" height="56" style="display:block;border-radius:14px;box-shadow:0 4px 15px rgba(0, 0, 0, 0.5);" />
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <span style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.02em;">WorkHub</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding:20px 40px 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid rgba(255,255,255,0.1);padding-top:24px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:13px;color:#a1a1aa;">
                      This email was sent by <strong style="color:#e2e8f0;">WorkHub</strong>
                    </p>
                    <p style="margin:0 0 6px;font-size:12px;color:#a1a1aa;">
                      The unified platform for collaboration & productivity
                    </p>
                    <p style="margin:0;font-size:12px;color:#71717a;">
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


export const sendVerificationEmail = async (email, fullName, otp) => {
  const content = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;text-align:center;">
      Verify your email
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#e2e8f0;line-height:1.6;text-align:center;">
      Hi <strong style="color:#ffffff;">${fullName}</strong>, welcome to WorkHub! 🎉<br/>
      Use the verification code below to activate your account.
    </p>

    <!-- OTP Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:2px dashed rgba(168,85,247,0.4);border-radius:16px;padding:24px 48px;">
            <tr>
              <td align="center">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#a855f7;text-transform:uppercase;letter-spacing:2px;">
                  Verification Code
                </p>
                <p style="margin:0;font-size:40px;font-weight:800;color:#ffffff;letter-spacing:12px;font-family:'Courier New',monospace;">
                  ${otp}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Info -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(217,70,239,0.1);border-left:4px solid #d946ef;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <tr>
        <td>
          <p style="margin:0;font-size:13px;color:#fdf4ff;line-height:1.5;">
            ⏱️ This code will expire in <strong>10 minutes</strong>.<br/>
            If you didn't create an account on WorkHub, please ignore this email.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;color:#a1a1aa;text-align:center;">
      Having trouble? Contact us at <a href="mailto:support@workhub.com" style="color:#a855f7;text-decoration:none;">support@workhub.com</a>
    </p>
  `;

  await transporter.sendMail({
    from: `"WorkHub" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `${otp} is your WorkHub verification code`,
    html: baseTemplate(content),
    attachments: [
      {
        filename: "WorkHub_logo_blue_background.png",
        path: logoPath,
        cid: "workhublogo",
      },
    ],
  });
};


export const sendResetPasswordEmail = async (email, fullName, resetLink) => {
  const content = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;text-align:center;">
      Reset your password
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#e2e8f0;line-height:1.6;text-align:center;">
      Hi <strong style="color:#ffffff;">${fullName}</strong>,<br/>
      We received a request to reset the password for your WorkHub account. Click the button below to create a new password.
    </p>

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td align="center">
          <a href="${resetLink}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#6d28d9 0%,#c026d3 100%);color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 48px;border-radius:12px;box-shadow:0 4px 14px rgba(192,38,211,0.4);">
            Reset Password
          </a>
        </td>
      </tr>
    </table>

    <!-- Alternative link -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border-radius:8px;padding:14px 16px;margin-bottom:24px;border:1px solid rgba(255,255,255,0.05);">
      <tr>
        <td>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:1px;">
            Or copy this link:
          </p>
          <p style="margin:0;font-size:12px;color:#a855f7;word-break:break-all;line-height:1.5;">
            <a href="${resetLink}" style="color:#a855f7;text-decoration:none;">${resetLink}</a>
          </p>
        </td>
      </tr>
    </table>

    <!-- Warning -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(239,68,68,0.1);border-left:4px solid #ef4444;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <tr>
        <td>
          <p style="margin:0;font-size:13px;color:#fca5a5;line-height:1.5;">
            ⚠️ This link will expire in <strong>15 minutes</strong>.<br/>
            If you didn't request a password reset, please ignore this email or contact support.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:14px;color:#a1a1aa;text-align:center;">
      Need help? Contact us at <a href="mailto:support@workhub.com" style="color:#a855f7;text-decoration:none;">support@workhub.com</a>
    </p>
  `;

  await transporter.sendMail({
    from: `"WorkHub" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your WorkHub password",
    html: baseTemplate(content),
    attachments: [
      {
        filename: "WorkHub_logo_blue_background.png",
        path: logoPath,
        cid: "workhublogo",
      },
    ],
  });
};
