import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { HardDrive, Search, Shield, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";

function BillingToggle({ yearly, setYearly }: { yearly: boolean; setYearly: (v: boolean) => void }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-card p-1">
      <button
        className={`rounded-full px-4 py-1.5 text-sm font-medium ${!yearly ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
        onClick={() => setYearly(false)}
        aria-pressed={!yearly}
      >
        Monthly
      </button>
      <button
        className={`rounded-full px-4 py-1.5 text-sm font-medium ${yearly ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
        onClick={() => setYearly(true)}
        aria-pressed={yearly}
      >
        Yearly <span className="ml-1 text-xs text-primary">Save 17%</span>
      </button>
    </div>
  );
}

export default function Pricing() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(true);
  const [busy, setBusy] = useState<null | string>(null);

  useEffect(() => {
    const b = (params.get("billing") || "yearly").toLowerCase();
    setYearly(b === "yearly");
  }, [params]);

  const startCheckout = async (plan: "pro" | "max") => {
    try {
      if (!user?._id) {
        navigate("/auth");
        return;
      }
      setBusy(plan);
      const token = `aer_${user._id}`;
      const convexBase = (import.meta.env.VITE_CONVEX_SITE_URL as string) || (import.meta.env.VITE_CONVEX_URL as string)?.replace(".cloud", ".site");
      const endpoint = `${convexBase}/api/pay/checkout`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, billing: yearly ? "yearly" : "monthly" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        toast.error(data?.error || "Failed to start checkout");
        setBusy(null);
        return;
      }
      window.location.assign(data.url);
    } catch (e) {
      toast.error("Checkout failed");
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Aer" className="h-8 w-8 cursor-pointer" onClick={() => navigate("/")} />
            <h1 className="text-2xl font-bold tracking-tight">Pricing</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>Dashboard</Button>
            <Button onClick={() => navigate(user ? "/dashboard" : "/auth")}>
              {user ? "Account" : "Get Started"}
            </Button>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold tracking-tight mb-3">Choose your plan</h2>
          <p className="text-muted-foreground mb-6">Flexible plans for individuals. Upgrade anytime.</p>
          <BillingToggle yearly={yearly} setYearly={setYearly} />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {/* Free */}
          <div className="rounded-lg border p-8 text-left hover:shadow-sm transition-shadow">
            <h3 className="text-2xl font-bold tracking-tight">Free</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><HardDrive className="mt-0.5 h-4 w-4 text-[#8BA888]" /><span>100 MB storage</span></li>
              <li className="flex items-start gap-2"><Search className="mt-0.5 h-4 w-4 text-[#8BA888]" /><span>Basic search</span></li>
              <li className="flex items-start gap-2"><Shield className="mt-0.5 h-4 w-4 text-[#8BA888]" /><span>Full encryption</span></li>
            </ul>
            <Button className="mt-6 w-full" onClick={() => navigate("/auth")}>Start Free</Button>
          </div>

          {/* Pro */}
          <div className="relative rounded-lg border p-8 text-left hover:shadow-sm transition-shadow">
            <div className="absolute -top-3 right-4 rounded-full border bg-background px-2 py-0.5 text-xs font-semibold">MOST POPULAR</div>
            <h3 className="text-2xl font-bold tracking-tight">Pro</h3>
            <div className="mt-2 text-3xl font-bold tracking-tight">
              {yearly ? "$90" : "$10"}
              <span className="text-base font-medium">/{yearly ? "year" : "mo"}</span>
            </div>
            <div className="text-xs text-muted-foreground">{yearly ? "Billed yearly • Save 17%" : "Billed monthly"}</div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><HardDrive className="mt-0.5 h-4 w-4 text-[#8BA888]" /><span>10 GB storage</span></li>
              <li className="flex items-start gap-2"><Search className="mt-0.5 h-4 w-4 text-[#8BA888]" /><span>300 searches/month</span></li>
              <li className="flex items-start gap-2"><Upload className="mt-0.5 h-4 w-4 text-[#8BA888]" /><span>Bulk uploads</span></li>
              <li className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 text-[#8BA888]" /><span>Advanced features</span></li>
            </ul>
            <Button className="mt-6 w-full" disabled={busy === "pro"} onClick={() => startCheckout("pro")}>
              {busy === "pro" ? "Redirecting…" : "Upgrade to Pro"}
            </Button>
          </div>

          {/* Max */}
          <div className="rounded-lg border p-8 text-left hover:shadow-sm transition-shadow">
            <h3 className="text-2xl font-bold tracking-tight">Max</h3>
            <div className="mt-2 text-3xl font-bold tracking-tight">
              {yearly ? "$290" : "$25"}
              <span className="text-base font-medium">/{yearly ? "year" : "mo"}</span>
            </div>
            <div className="text-xs text-muted-foreground">{yearly ? "Billed yearly • Save 17%" : "Billed monthly"}</div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><HardDrive className="mt-0.5 h-4 w-4 text-[#8BA888]" /><span>100 GB storage</span></li>
              <li className="flex items-start gap-2"><Search className="mt-0.5 h-4 w-4 text-[#8BA888]" /><span>1,000 searches/month</span></li>
              <li className="flex items-start gap-2"><Shield className="mt-0.5 h-4 w-4 text-[#8BA888]" /><span>Priority support</span></li>
            </ul>
            <Button className="mt-6 w-full" variant="outline" disabled={busy === "max"} onClick={() => startCheckout("max")}>
              {busy === "max" ? "Redirecting…" : "Get Max"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
