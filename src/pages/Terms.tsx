import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Aer" className="h-8 w-8 cursor-pointer" onClick={() => navigate("/")} />
            <h1 className="text-2xl font-bold tracking-tight">Terms of Service</h1>
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

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using Aer ("the Service"), you accept and agree to be bound by the terms and provision of this agreement.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Aer is a personal context operating system that allows users to capture, organize, and retrieve notes, files, and web content using AI-powered search and organization tools.
          </p>

          <h2>3. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
          </p>

          <h2>4. User Content</h2>
          <p>
            You retain all rights to the content you upload to Aer. By uploading content, you grant us the right to store, process, and display your content solely for the purpose of providing the Service to you.
          </p>

          <h2>5. Privacy and Data Protection</h2>
          <p>
            Your use of the Service is also governed by our Privacy Policy. We take data protection seriously and implement industry-standard security measures to protect your information.
          </p>

          <h2>6. Prohibited Uses</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Upload or transmit any unlawful, harmful, or offensive content</li>
            <li>Violate any applicable laws or regulations</li>
            <li>Interfere with or disrupt the Service or servers</li>
            <li>Attempt to gain unauthorized access to any portion of the Service</li>
          </ul>

          <h2>7. Service Modifications</h2>
          <p>
            We reserve the right to modify or discontinue the Service at any time, with or without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuance of the Service.
          </p>

          <h2>8. Limitation of Liability</h2>
          <p>
            The Service is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service.
          </p>

          <h2>9. Data Deletion</h2>
          <p>
            You may delete your data at any time through the Settings page. Upon deletion, your data will be permanently removed from our servers within 30 days.
          </p>

          <h2>10. Changes to Terms</h2>
          <p>
            We reserve the right to update these Terms of Service at any time. We will notify users of any material changes via email or through the Service.
          </p>

          <h2>11. Contact Information</h2>
          <p>
            For questions about these Terms of Service, please contact us through our support channels.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
