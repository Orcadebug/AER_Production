import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

export default function Upgrade() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);

  const { plan, billing } = useMemo(() => {
    const p = (params.get("plan") || "pro").toLowerCase();
    const b = (params.get("billing") || "monthly").toLowerCase();
    const plan = (p === "max" ? "max" : "pro") as "pro" | "max";
    const billing = (b === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly";
    return { plan, billing };
  }, [params]);

  useEffect(() => {
    const go = async () => {
      if (!user?._id) return;
      try {
        setBusy(true);
        const token = `aer_${user._id}`;
        const endpoint = `${import.meta.env.VITE_CONVEX_URL}/api/pay/checkout`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ plan, billing }),
        });
        const data = await res.json();
        if (!res.ok || !data?.url) {
          toast.error(data?.error || "Failed to start checkout");
          setBusy(false);
          return;
        }
        window.location.assign(data.url);
      } catch (e) {
        toast.error("Checkout failed");
        setBusy(false);
      }
    };
    if (user && !isLoading) go();
  }, [user, isLoading, plan, billing]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full border rounded-lg p-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Upgrade to {plan.toUpperCase()}</h1>
        <p className="text-sm text-muted-foreground mb-4">Billing: {billing === "yearly" ? "Yearly" : "Monthly"}</p>
        {busy || isLoading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Redirecting to Stripe Checkout…
          </div>
        ) : (
          <div className="space-y-2">
            <Button className="w-full" onClick={() => navigate("/settings")}>
              Back to Settings
            </Button>
            <div className="text-xs text-muted-foreground">If you were not redirected, try again.</div>
          </div>
        )}
      </div>
    </div>
  );
}
