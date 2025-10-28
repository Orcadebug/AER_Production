// The ConvexHttpClient automatically uses cookies from the browser
const client = new ConvexHttpClient(CONVEX_URL);

// When you call any mutation/query, it includes the auth cookies
const user = await client.query(api.users.currentUser);
