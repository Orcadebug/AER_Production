import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

import { useEffect, useState } from "react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut } = useAuthActions();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Stop loading when auth state is ready
    if (!isAuthLoading) {
      // If not authenticated, we're done loading immediately
      if (!isAuthenticated) {
        setIsLoading(false);
      }
      // If authenticated, wait for user query to complete (user !== undefined)
      // OR set a timeout to prevent infinite loading
      else if (isAuthenticated) {
        if (user !== undefined) {
          setIsLoading(false);
        } else {
          // Set a timeout as fallback to prevent infinite loading
          // if user query takes too long or fails
          const timeout = setTimeout(() => {
            setIsLoading(false);
          }, 3000);

          return () => clearTimeout(timeout);
        }
      }
    }
  }, [isAuthLoading, isAuthenticated, user]);

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
