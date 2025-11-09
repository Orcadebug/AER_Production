import { motion } from "framer-motion";
import { 
  Monitor, Smartphone, Globe, ArrowRight, Shield, Search, 
  Upload, RefreshCw, Download, Chrome, Mail, Apple, 
  Zap, FileText, Brain, CheckCircle, X, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
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
          className="text-center max-w-5xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-[#8BA888]/10 border border-[#8BA888]/20 rounded-full px-4 py-2 mb-8">
            <Monitor className="h-4 w-4 text-[#8BA888]" />
            <span className="text-sm font-medium text-[#8BA888]">Browser + Cloud today • Desktop rolling out</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Your Context.
            <span className="text-[#8BA888]"> Every Platform.</span>
            <br />
            One Click Away.
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-4 max-w-3xl mx-auto">
            Your context is scattered: AI chats in browsers, files on desktop, notes everywhere. Nothing syncs. Nothing's searchable.
          </p>
          
          <p className="text-base text-muted-foreground mb-10 max-w-3xl mx-auto">
            Aer fixes this. Upload from desktop or browser. Search everything instantly. Access your encrypted vault on all platforms.
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
            <Button size="lg" variant="outline" className="text-lg px-8" onClick={() => navigate("/downloads")}>
              See Platforms
            </Button>
          </div>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-20 border-t">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight mb-4">How It Works</h2>
          <p className="text-xl text-muted-foreground">Three simple steps to organize your entire digital life</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              number: "1",
              title: "Upload Anywhere",
              description: "Desktop app for files & PDFs. Browser extension for AI chats. Works on Windows, Mac, Linux.",
              icon: Upload
            },
            {
              number: "2",
              title: "Search Everything",
              description: "Semantic search finds anything across all sources in 2 seconds. From your desktop or phone.",
              icon: Search
            },
            {
              number: "3",
              title: "Access Everywhere",
              description: "Same encrypted vault on all devices. Real-time sync. Works offline. Your keys only.",
              icon: RefreshCw
            },
          ].map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[#8BA888]/10 border border-[#8BA888]/20 mb-6 mx-auto">
                  <span className="text-2xl font-bold text-[#8BA888]">{step.number}</span>
                </div>
                <step.icon className="h-8 w-8 text-[#8BA888] mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Platform Features Section */}
      <section className="container mx-auto px-4 py-20 border-t">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight mb-4">One Tool. All Platforms.</h2>
          <p className="text-xl text-muted-foreground">Desktop, browser, and cloud working together</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="border rounded-lg p-8 hover:border-[#8BA888]/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-6">
              <Monitor className="h-6 w-6 text-[#8BA888]" />
              <h3 className="text-2xl font-semibold">Desktop Apps</h3>
            </div>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-[#8BA888] mt-0.5 flex-shrink-0" />
                <span>Drag-drop files & PDFs</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-[#8BA888] mt-0.5 flex-shrink-0" />
                <span>Bulk uploads with tagging</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-[#8BA888] mt-0.5 flex-shrink-0" />
                <span>Offline mode (coming soon)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-[#8BA888] mt-0.5 flex-shrink-0" />
                <span>Linux beta now; Windows/Mac coming soon</span>
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="border rounded-lg p-8 hover:border-[#8BA888]/50 transition-colors"
          >
            <div className="flex items-center gap-3 mb-6">
              <Chrome className="h-6 w-6 text-[#8BA888]" />
              <h3 className="text-2xl font-semibold">Browser Extensions</h3>
            </div>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-[#8BA888] mt-0.5 flex-shrink-0" />
                <span>Auto-save AI chats</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-[#8BA888] mt-0.5 flex-shrink-0" />
                <span>Capture webpages instantly</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-[#8BA888] mt-0.5 flex-shrink-0" />
                <span>Inject context into prompts</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-[#8BA888] mt-0.5 flex-shrink-0" />
                <span>Chrome (Edge compatible) • Firefox (planned)</span>
              </li>
            </ul>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-[#8BA888]/5 border border-[#8BA888]/20 rounded-lg p-8 max-w-5xl mx-auto text-center"
        >
          <h4 className="text-lg font-semibold mb-4">All Platforms Include:</h4>
          <div className="flex flex-wrap justify-center gap-8">
            <div>
              <RefreshCw className="h-6 w-6 text-[#8BA888] mx-auto mb-2" />
              <p className="text-sm">Real-time encrypted sync</p>
            </div>
            <div>
              <Shield className="h-6 w-6 text-[#8BA888] mx-auto mb-2" />
              <p className="text-sm">Military-grade E2E encryption</p>
            </div>
            <div>
              <Search className="h-6 w-6 text-[#8BA888] mx-auto mb-2" />
              <p className="text-sm">Semantic search</p>
            </div>
            <div>
              <Globe className="h-6 w-6 text-[#8BA888] mx-auto mb-2" />
              <p className="text-sm">Cross-platform access (web + extensions; desktop rolling out)</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Use Cases Section */}
      <section className="container mx-auto px-4 py-20 border-t">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight mb-4">Real Workflows</h2>
          <p className="text-xl text-muted-foreground">Desktop + Browser working together</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {[
            {
              title: "Research to Archive",
              flow: "Upload PDFs on Linux desktop → Capture Claude analysis in browser → Search both on the web"
            },
            {
              title: "Chat to Vault",
              flow: "Record ChatGPT conversation in browser → Auto-save to Aer → Find insights on any device (web)"
            }
          ].map((useCase, idx) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="border rounded-lg p-6"
            >
              <h3 className="text-lg font-semibold mb-3">{useCase.title}</h3>
              <p className="text-muted-foreground italic">→ {useCase.flow}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing Section (Coming Soon) */}
      <section className="container mx-auto px-4 py-20 border-t">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-4xl font-bold tracking-tight mb-4">Pricing</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Pricing and plans are coming soon. We’re finalizing details and will announce early-bird options shortly.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {["Free","Pro","Team"].map((tier, idx) => (
              <motion.div
                key={tier}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                viewport={{ once: true }}
                className="rounded-lg border p-8 text-center"
              >
                <h3 className="text-2xl font-bold mb-2">{tier}</h3>
                <p className="text-sm text-muted-foreground mb-6">Details coming soon</p>
                <Button disabled variant="outline" className="w-full">Coming Soon</Button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Comparison Section */}
      <section className="container mx-auto px-4 py-20 border-t">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight mb-4">Why Aer?</h2>
          <p className="text-xl text-muted-foreground">The only tool with desktop + browser + cloud sync</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="overflow-x-auto max-w-5xl mx-auto"
        >
          <table className="w-full border rounded-lg border-collapse">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-4 text-left font-semibold">Feature</th>
                <th className="p-4 text-center font-semibold">Aer</th>
                <th className="p-4 text-center font-semibold">Notion</th>
                <th className="p-4 text-center font-semibold">Obsidian</th>
                <th className="p-4 text-center font-semibold">SaveGPT</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: "Desktop Apps", aer: "Linux beta", notion: false, obsidian: true, savegpt: false },
                { feature: "Browser Extension", aer: "Chrome (Edge compatible)", notion: false, obsidian: false, savegpt: true },
                { feature: "Cloud Sync", aer: true, notion: true, obsidian: false, savegpt: true },
                { feature: "E2E Encryption", aer: true, notion: false, obsidian: true, savegpt: false },
                { feature: "Semantic Search", aer: true, notion: false, obsidian: false, savegpt: true },
                { feature: "Offline Mode", aer: "Soon", notion: false, obsidian: true, savegpt: false },
              ].map((row: any, idx: number) => (
                <tr key={idx} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="p-4 font-medium">{row.feature}</td>
                  {([row.aer, row.notion, row.obsidian, row.savegpt] as any[]).map((val, i) => (
                    <td key={i} className="p-4 text-center">
                      {typeof val === "boolean" ? (
                        val ? (
                          <CheckCircle className="h-5 w-5 text-[#8BA888] mx-auto" />
                        ) : (
                          <X className="h-5 w-5 text-muted-foreground mx-auto" />
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">{String(val)}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-20 border-t">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold tracking-tight mb-4">Common Questions</h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {[
            {
              q: "Desktop vs browser extension?",
              a: "Desktop app for files/PDFs. Browser extension for capturing AI chats and webpages. Use both together."
            },
            {
              q: "Does it work offline?",
              a: "Offline mode is coming soon. Today, uploads and search require connectivity; queued sync is planned."
            },
            {
              q: "How does cross-device sync work?",
              a: "Real-time end-to-end encrypted sync. Your data appears instantly on all devices. Keys never leave your devices."
            },
            {
              q: "Linux feature parity?",
              a: "Linux desktop beta is available now. Windows and Mac apps are coming soon; feature parity will follow."
            },
            {
              q: "What file types are supported?",
              a: "PDFs, Word docs, text files, images. Plus direct browser capture and paste. AI auto-tags everything."
            },
            {
              q: "Can I export my data?",
              a: "Yes. Export everything as JSON or Markdown. Your data, your keys, full control."
            }
          ].map((faq, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              viewport={{ once: true }}
              className="border rounded-lg p-6"
            >
              <h3 className="font-semibold mb-2">{faq.q}</h3>
              <p className="text-sm text-muted-foreground">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 py-20 border-t">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-[#8BA888]/10 to-[#8BA888]/5 border border-[#8BA888]/20 rounded-2xl p-12 text-center max-w-4xl mx-auto"
        >
          <h2 className="text-4xl font-bold tracking-tight mb-2">Your Context. Every Platform. One Click Away.</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Free tier includes web + extensions; desktop betas rolling out. No credit card required.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="bg-[#8BA888] hover:bg-[#7A9777] text-lg px-8"
            >
              Start Free Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" onClick={() => navigate("/downloads")}>
              Download All Platforms
            </Button>
          </div>
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