import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
<img src="/logo.png" alt="Aer" className="h-8 w-8 cursor-pointer" onClick={() => navigate("/")} />
            <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="prose prose-neutral dark:prose-invert max-w-none"
        >
          <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <h2>1. Information We Collect</h2>
          <p>We collect information that you provide directly to us, including:</p>
          <ul>
            <li>Account information (email address)</li>
            <li>Content you create (notes, uploaded files, web captures)</li>
            <li>Organization data (projects, tags)</li>
            <li>Usage data (search queries, feature usage)</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve the Service</li>
            <li>Process and complete transactions</li>
            <li>Send you technical notices and support messages</li>
            <li>Respond to your comments and questions</li>
            <li>Develop new features and functionality</li>
          </ul>

          <h2>3. Data Storage and Security</h2>
          <p>
            Your data is stored securely using industry-standard encryption. We use Convex as our database provider, which implements enterprise-grade security measures including:
          </p>
          <ul>
            <li>Encryption in transit (TLS/SSL)</li>
            <li>Encryption at rest</li>
            <li>Regular security audits</li>
            <li>Access controls and authentication</li>
          </ul>

          <h2>4. Data Sharing</h2>
          <p>
            We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
          </p>
          <ul>
            <li>With your consent</li>
            <li>To comply with legal obligations</li>
            <li>To protect our rights and prevent fraud</li>
            <li>With service providers who assist in operating the Service (under strict confidentiality agreements)</li>
          </ul>

          <h2>5. Your Data Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Delete your data (via Settings page)</li>
            <li>Export your data (Markdown or JSON format)</li>
            <li>Object to data processing</li>
          </ul>

          <h2>6. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. When you delete your data or account, we will permanently remove it from our servers within 30 days.
          </p>

          <h2>7. Cookies and Tracking</h2>
          <p>
            We use essential cookies to maintain your session and provide the Service. We do not use third-party tracking or advertising cookies.
          </p>

          <h2>8. Third-Party Services</h2>
          <p>Our Service integrates with:</p>
          <ul>
            <li>Convex (database and backend)</li>
            <li>Resend (email delivery for authentication)</li>
            <li>Vercel (hosting)</li>
          </ul>
          <p>These services have their own privacy policies governing their use of your information.</p>

          <h2>9. Children's Privacy</h2>
          <p>
            The Service is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13.
          </p>

          <h2>10. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for such transfers.
          </p>

          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.
          </p>

          <h2>12. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or our data practices, please contact us through our support channels.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
