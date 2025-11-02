import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, Lock } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { APP_CONFIG } from "@/lib/config";

interface AuthProps {
  redirectAfterAuth?: string;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const redirect = redirectAfterAuth || "/";
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirectAfterAuth]);

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    let lastEmail = "";
    let lastPassword = "";

    try {
      const formData = new FormData(event.currentTarget);
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const confirmPassword = formData.get("confirmPassword") as string;

      lastEmail = email;
      lastPassword = password;

      // Validate passwords match for sign up
      if (isSignUp && password !== confirmPassword) {
        setError("Passwords do not match");
        setIsLoading(false);
        return;
      }

      // Validate password length
      if (isSignUp && password.length < 8) {
        setError("Password must be at least 8 characters");
        setIsLoading(false);
        return;
      }

      // Add the flow parameter required by Convex Auth Password provider
      formData.append("flow", isSignUp ? "signUp" : "signIn");

      await signIn("password", formData);

      // Don't navigate here - let the useEffect handle it once isAuthenticated becomes true
      // This prevents race conditions where we navigate before auth state is fully updated
    } catch (error) {
      console.error("Authentication error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Auto-fix for dangling accounts: if sign-in fails with InvalidAccountId, try sign-up
      if (!isSignUp && /InvalidAccountId|Invalid credentials/i.test(errorMessage) && lastEmail && lastPassword) {
        try {
          const fd = new FormData();
          fd.set("email", lastEmail);
          fd.set("password", lastPassword);
          fd.set("flow", "signUp");
          await signIn("password", fd);
          return; // success, effect will redirect
        } catch (e) {
          // fall through to normal error handling
        }
      }

      // Check if the error indicates the user doesn't exist
      if (!isSignUp && errorMessage.includes("InvalidSecret")) {
        setError("No account found with this email. Please sign up first.");
      } else if (isSignUp) {
        setError("Failed to create account. Please try again.");
      } else {
        setError("Invalid email or password. Please try again.");
      }
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col">
      {/* Auth Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center justify-center h-full flex-col">
          <Card className="min-w-[350px] pb-0 border shadow-md">
            <CardHeader className="text-center">
              <div className="flex justify-center">
                <img
src="/logo.png"
                  alt="Lock Icon"
                  width={64}
                  height={64}
                  className="rounded-lg mb-4 mt-4 cursor-pointer"
                  onClick={() => navigate("/")}
                />
              </div>
              <CardTitle className="text-xl">
                {isSignUp ? "Create Account" : "Welcome Back"}
              </CardTitle>
              <CardDescription>
                {isSignUp
                  ? "Create a new account to get started"
                  : "Sign in to your account"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      placeholder="name@example.com"
                      type="email"
                      className="pl-9"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      placeholder={isSignUp ? "At least 8 characters" : "Enter your password"}
                      type="password"
                      className="pl-9"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        placeholder="Re-enter your password"
                        type="password"
                        className="pl-9"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-[#8BA888] hover:bg-[#7A9777]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isSignUp ? "Creating account..." : "Signing in..."}
                    </>
                  ) : (
                    <>
                      {isSignUp ? "Create Account" : "Sign In"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="text-center text-sm">
                <Button
                  variant="link"
                  className="p-0 h-auto"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                  }}
                  disabled={isLoading}
                >
                  {isSignUp 
                    ? "Already have an account? Sign in" 
                    : "Don't have an account? Sign up"}
                </Button>
              </div>
            </CardContent>

            <div className="py-4 px-6 text-xs text-center text-muted-foreground bg-muted border-t rounded-b-lg">
              Secured by {APP_CONFIG.authProvider.name}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}