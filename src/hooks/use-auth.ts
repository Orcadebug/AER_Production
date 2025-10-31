import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

import { useEffect, useState } from "react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut } = useAuthActions();

  const [isLoading, setIsLoading] = useState(true);

  // This effect updates the loading state once auth is loaded and user data is available
  // It ensures we only show content when both authentication state and user data are ready
  useEffect(() => {
    // Auth loading is done when isAuthLoading is false
    // User query is done when user is not undefined (can be null for unauthenticated users)
    if (!isAuthLoading) {
      // If authenticated, wait for user data to be available (not undefined)
      if (isAuthenticated && user !== undefined) {
        setIsLoading(false);
      }
      // If not authenticated, don't wait for user data
      else if (!isAuthenticated) {
        setIsLoading(false);
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
