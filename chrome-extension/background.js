// ... keep existing code (imports and initialization)

// Initialize Convex client
const convex = new ConvexHttpClient("https://your-deployment.convex.cloud");

// Function to get current user
async function getCurrentUser() {
  try {
    const user = await convex.query("users:currentUser", {});
    return user;
  } catch (error) {
    console.error("Failed to get current user:", error);
    return null;
  }
}

// Function to save context
async function saveContext(title, content, url) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Derive encryption key from user ID
    const encryptionKey = await deriveKeyFromUserId(user._id);

    // Encrypt the content
    const encryptedContent = encryptData(content, encryptionKey);
    const encryptedTitle = encryptData(title, encryptionKey);
    const encryptedMetadata = encryptData(JSON.stringify({ url, capturedAt: Date.now() }), encryptionKey);

    // Create context via Convex mutation
    const contextId = await convex.mutation(api.contexts.create, {
      title: title.substring(0, 50), // Truncated for search
      type: "web",
      url: url,
      encryptedContent,
      encryptedTitle,
      encryptedMetadata,
      plaintextContent: content, // For AI tag generation
    });

    return contextId;
  } catch (error) {
    console.error("Failed to save context:", error);
    throw error;
  }
}

// ... keep existing code (encryption functions, message listeners, etc)
