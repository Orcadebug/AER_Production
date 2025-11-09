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
            <span className="text-sm font-medium text-[#8BA888]">Browser + Cloud live today – Desktop rolling out (Linux beta available)</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Your Context OS.
            <span className="text-[#8BA888]"> Every Platform.</span>
            <br />
            One Click Away.
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            Stop losing important information across browsers, desktops, and devices. Aer is the encrypted context operating system that lets you save from anywhere, search everything instantly, and access your knowledge on any platform—with end-to-end encryption and semantic AI search.
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
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8"
              onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
            >
              See How It Works
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Problem Statement */}
      <section className="container mx-auto px-4 py-16 border-t">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-8 text-center">
            Your context is scattered. Aer brings it together.
          </h2>
          <div className="grid md:grid-cols-2 gap-10">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <X className="h-5 w-5 text-muted-foreground mt-0.5" />
                <p>AI chats live only in your browser—lost when you close the tab</p>
              </div>
              <div className="flex items-start gap-3">
                <X className="h-5 w-5 text-muted-foreground mt-0.5" />
                <p>Files and PDFs buried in folders on your desktop</p>
              </div>
              <div className="flex items-start gap-3">
                <X className="h-5 w-5 text-muted-foreground mt-0.5" />
                <p>Notes, screenshots, and research spread across devices</p>
              </div>
              <div className="flex items-start gap-3">
                <X className="h-5 w-5 text-muted-foreground mt-0.5" />
                <p>Nothing syncs. Nothing's truly searchable. No privacy guarantees.</p>
              </div>
            </div>
            <div className="rounded-lg border p-6 bg-muted/30">
              <h3 className="text-lg font-semibold mb-2">Aer fixes this:</h3>
              <p className="text-muted-foreground">
                Upload from desktop or browser. Search everything with AI-powered semantic search. Access your encrypted vault on all platforms—desktop, web, mobile.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container mx-auto px-4 py-20 border-t">
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
              details: [
                "Desktop app for files, PDFs, and bulk uploads with tagging (Linux beta live; Windows/Mac coming soon)",
                "Browser extension auto-saves AI chats, web highlights, and pages (Chrome live; Edge compatible; Firefox planned)"
              ],
              icon: Upload
            },
            {
              number: "2",
              title: "Search Everything",
              details: [
                "Semantic AI search finds anything by meaning—not just keywords",
                "Works from desktop, browser, or mobile web"
              ],
              icon: Search
            },
            {
              number: "3",
              title: "Access Everywhere",
              details: [
                "Same encrypted vault syncs in real-time across all devices",
                "End-to-end encryption—your keys, your control; Offline mode coming soon"
              ],
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
                {Array.isArray((step as any).details) ? (
                  <ul className="text-left text-muted-foreground space-y-2 max-w-xs mx-auto">
                    {(step as any).details.map((d: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#8BA888]" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{(step as any).description}</p>
                )}
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
              flow: "Upload research PDFs on desktop → Capture AI analysis in browser → Search both instantly on web or mobile"
            },
            {
              title: "Chat to Vault",
              flow: "Record ChatGPT or Claude conversation in browser → Auto-save to Aer → Find insights later on any device"
            },
            {
              title: "Context on Demand",
              flow: "Save highlights from any website → Right-click in a doc or email → Pull your context in, instantly"
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
          <p className="text-lg text-muted-foreground">Flexible plans for individuals and teams</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-8">
            {["Free","Pro","Team"].map((tier, idx) => (
              <motion.div
                key={tier}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                viewport={{ once: true }}
                className="rounded-lg border p-8 text-center"
              >
                <h3 className="text-2xl font-bold mb-2">{tier} Tier</h3>
                <p className="text-sm text-muted-foreground mb-6">Details coming soon. Sign up for early access.</p>
                <Button disabled variant="outline" className="w-full">Coming Soon</Button>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 flex justify-center gap-4">
            <Button onClick={() => navigate("/support?topic=waitlist")} className="bg-[#8BA888] hover:bg-[#7A9777]">Join Waitlist</Button>
            <Button variant="outline" onClick={() => navigate("/support?topic=notify")}>Notify Me</Button>
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
          <p className="text-xl text-muted-foreground">The only context OS with desktop + browser + cloud sync—fully encrypted</p>
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
                { feature: "Web App", aer: true, notion: true, obsidian: false, savegpt: true },
                { feature: "Browser Extension", aer: true, notion: false, obsidian: false, savegpt: true },
                { feature: "AI Chat Capture", aer: true, notion: false, obsidian: false, savegpt: true },
                { feature: "Real-time Sync", aer: true, notion: true, obsidian: false, savegpt: true },
                { feature: "E2E Encryption", aer: true, notion: false, obsidian: true, savegpt: false },
                { feature: "AI Tagging", aer: true, notion: false, obsidian: false, savegpt: true },
                { feature: "Semantic Search", aer: true, notion: false, obsidian: false, savegpt: true },
                { feature: "Desktop Apps", aer: "Linux beta", notion: true, obsidian: true, savegpt: false },
                { feature: "Offline Mode", aer: "Planned", notion: false, obsidian: true, savegpt: false },
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
              q: "What's the difference between desktop and browser extension?",
              a: "Desktop app is for uploading files, PDFs, and bulk content. Browser extension captures AI chats, webpages, and highlights. Use both together for full coverage."
            },
            {
              q: "Does it work offline?",
              a: "Offline mode is coming soon. Today, uploads and search require connectivity; queued sync for offline use is planned."
            },
            {
              q: "How does cross-device sync work?",
              a: "Real-time end-to-end encrypted sync. Your encrypted data syncs instantly across all devices. Encryption keys never leave your devices—zero-knowledge architecture."
            },
            {
              q: "Is Linux fully supported?",
              a: "Linux desktop beta is live now. Windows and Mac apps are in development; feature parity across all platforms is on the roadmap."
            },
            {
              q: "What file types are supported?",
              a: "PDFs, Word docs, text files, images, and direct browser captures. AI auto-tags and indexes everything for instant search."
            },
            {
              q: "Can I export my data?",
              a: "Yes. Export everything as JSON or Markdown anytime. Your data, your keys, full control. No lock-in."
            },
            {
              q: "How secure is Aer?",
              a: "Military-grade end-to-end encryption. Client-side encryption means only you hold the keys. Zero-knowledge model—Aer cannot read your content."
            },
            {
              q: "What platforms will Aer support?",
              a: "Live now: Linux desktop beta, Chrome extension (Edge compatible), web app. Coming soon: Windows & Mac desktop, Firefox extension, mobile apps (iOS/Android)."
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