import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";
import { alphabet, generateRandomString } from "oslo/crypto";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  generateVerificationToken() {
    return generateRandomString(6, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY environment variable is not set");
      }

      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "Aer <onboarding@resend.dev>",
        to: email,
        subject: `Your verification code for Aer`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your Verification Code</h2>
            <p>Your verification code is:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
              ${token}
            </div>
            <p>This code will expire in 15 minutes.</p>
            <p>If you didn't request this code, you can safely ignore this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px;">This email was sent by Aer</p>
          </div>
        `,
      });
    } catch (error) {
      console.error("Resend email error:", error);
      throw new Error(`Failed to send verification email: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});