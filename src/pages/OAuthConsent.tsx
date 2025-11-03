import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function OAuthConsent() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const createCode = useMutation((api as any).oauthPublic.createAuthCodeForClient);

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const client_id = params.get("client_id");
      const redirect_uri = params.get("redirect_uri");
      const state = params.get("state") || undefined;
      const scope = params.get("scope") || undefined;
      const code_challenge = params.get("code_challenge") || undefined;
      const code_challenge_method = params.get("code_challenge_method") || undefined;

      if (!client_id || !redirect_uri) return;

      try {
        const res = await createCode({
          clientId: client_id,
          redirectUri: redirect_uri,
          state,
          scope,
          codeChallenge: code_challenge,
          codeChallengeMethod: code_challenge_method,
        });
        const redirect = new URL(redirect_uri);
        redirect.searchParams.set("code", res.code);
        if (state) redirect.searchParams.set("state", state);
        window.location.href = redirect.toString();
      } catch (e) {
        // minimal error UI
        console.error("OAuth consent failed", e);
      }
    };

    if (!isLoading && isAuthenticated && user?._id) {
      run();
    } else if (!isLoading && !isAuthenticated) {
      const back = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/auth?redirectAfterAuth=${back}`;
    }
  }, [isLoading, isAuthenticated, user]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting Aer to Claude...
      </div>
    </div>
  );
}
