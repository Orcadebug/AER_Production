import { motion } from "framer-motion";
import { Brain, FileText, Search, Zap, ArrowRight, Shield, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
<img src="/logo.png" alt="Aer" className="h-8 w-8" />
            <span className="text-2xl font-bold tracking-tight">Aer</span>
          </div>
          <Button
            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
            className="bg-[#8BA888] hover:bg-[#7A9777]"
            disabled={isLoading}
          >
            {isAuthenticated ? "Dashboard" : "Get Started"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-[#8BA888]/10 border border-[#8BA888]/20 rounded-full px-4 py-2 mb-8">
            <Zap className="h-4 w-4 text-[#8BA888]" />
            <span className="text-sm font-medium text-[#8BA888]">AI-Powered Context OS with MCP Integration</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Your Personal
            <span className="text-[#8BA888]"> Context </span>
            Operating System
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Connect any AI model—ChatGPT, Claude, Gemini—to your personal context. 
            Ask about your life, notes, or data, and get accurate answers powered by your encrypted knowledge base.
          </p>
          
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-[#8BA888] hover:bg-[#7A9777] text-lg px-8"
            >
              Start Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" onClick={() => navigate("/terms")}>
              Learn More
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-16 border-t">
        <h2 className="text-4xl font-bold tracking-tight text-center mb-10">Simple pricing</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="border rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-2">Free</h3>
            <p className="text-muted-foreground mb-4">Start building your encrypted knowledge base</p>
            <ul className="text-sm space-y-2 mb-6">
              <li>• AI search (30 Perplexity calls / month)</li>
              <li>• Notes, files, web captures</li>
              <li>• Basic tags and projects</li>
            </ul>
            <Button variant="outline" onClick={() => navigate("/auth")}>Get started</Button>
          </div>
          <div className="border rounded-xl p-6">
            <h3 className="text-xl font-semibold mb-2">Pro</h3>
            <div className="text-3xl font-bold mb-2">$9<span className="text-base font-normal">/mo</span></div>
            <p className="text-muted-foreground mb-4">Power user limits and priority AI</p>
            <ul className="text-sm space-y-2 mb-6">
              <li>• AI search (300 Perplexity calls / month)</li>
              <li>• Higher storage limits</li>
              <li>• Priority processing</li>
            </ul>
            <Button className="bg-[#8BA888] hover:bg-[#7A9777]" onClick={() => navigate("/auth")}>Upgrade</Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20 border-t">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight mb-4">Everything You Need</h2>
          <p className="text-xl text-muted-foreground">Built for scale, designed for simplicity</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {[
            {
              icon: Brain,
              title: "MCP Integration",
              description: "Connect any AI model to your context. ChatGPT, Claude, Gemini—they all get instant access to your personal knowledge base.",
            },
            {
              icon: Search,
              title: "AI-Powered Search",
              description: "Semantic search understands what you mean, not just what you type. Find anything instantly across all your contexts.",
            },
            {
              icon: FileText,
              title: "Universal Capture",
              description: "Notes, files, web content—capture everything in one place. PDFs, docs, and more supported with automatic tagging.",
            },
            {
              icon: Cloud,
              title: "Cloud Native",
              description: "Real-time sync across all devices. Your context is always up to date, everywhere, accessible to any connected AI.",
            },
            {
              icon: Shield,
              title: "Privacy First",
              description: "End-to-end encrypted. You control what AI models can access. Export or delete anytime. Full compliance ready.",
            },
            {
              icon: Zap,
              title: "Lightning Fast",
              description: "Built on modern serverless architecture. Scales effortlessly from 1 to millions of users with instant AI retrieval.",
            },
          ].map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="border rounded-lg p-6 hover:border-[#8BA888] transition-colors h-full">
                <feature.icon className="h-10 w-10 text-[#8BA888] mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 border-t">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-[#8BA888]/10 border border-[#8BA888]/20 rounded-2xl p-12 text-center max-w-4xl mx-auto"
        >
          <h2 className="text-4xl font-bold tracking-tight mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Give any AI model access to your personal context—securely and privately
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="bg-[#8BA888] hover:bg-[#7A9777] text-lg px-8"
          >
            Create Your Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground space-y-2">
          <p>© 2024 Aer. Built with modern cloud-native technology.</p>
          <div className="flex justify-center gap-4">
            <button onClick={() => navigate("/terms")} className="hover:text-primary underline">
              Terms of Service
            </button>
            <button onClick={() => navigate("/privacy")} className="hover:text-primary underline">
              Privacy Policy
            </button>
            <button onClick={() => navigate("/support")} className="hover:text-primary underline">
              Support
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}