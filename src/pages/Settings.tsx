import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Loader2, LogOut, Trash2, Copy, Key, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Bug, Lightbulb, HelpCircle } from "lucide-react";

export default function Settings() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tokenCopied, setTokenCopied] = useState(false);
  
  const userStats = useQuery(api.admin.getUserStats);
  const deleteAllData = useMutation(api.admin.deleteAllUserData);
  const updateFeedbackStatus = useMutation(api.feedback.updateStatus);
  
  // Try to fetch all feedback if user is admin
  const allFeedback = useQuery(api.feedback.listAll);
  const isAdmin = user?.role === "admin";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#8BA888]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/auth");
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDeleteAllData = async () => {
    try {
      await deleteAllData({});
      toast.success("All your data has been deleted");
      setTimeout(() => {
        handleSignOut();
      }, 1500);
    } catch (error) {
      toast.error("Failed to delete data");
    }
  };

  // Generate a simple auth token based on user ID
  const authToken = user?._id ? `aer_${user._id}` : "";

  // Early return if user is not loaded yet
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#8BA888]" />
      </div>
    );
  }

  const handleCopyToken = () => {
    navigator.clipboard.writeText(authToken);
    setTokenCopied(true);
    toast.success("Token copied to clipboard");
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "bug":
        return <Bug className="h-4 w-4" />;
      case "feature":
        return <Lightbulb className="h-4 w-4" />;
      case "question":
        return <HelpCircle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "in_progress":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "resolved":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "closed":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default:
        return "";
    }
  };

  const handleStatusChange = async (feedbackId: string, newStatus: string) => {
    try {
      await updateFeedbackStatus({
        id: feedbackId as any,
        status: newStatus as any,
      });
      toast.success("Status updated");
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Aer" className="h-8 w-8 cursor-pointer" onClick={() => navigate("/dashboard")} />
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs defaultValue="account" className="space-y-6">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            {isAdmin && <TabsTrigger value="feedback">User Feedback</TabsTrigger>}
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Account Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Your account details and statistics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="font-medium">{user?.email || "Anonymous User"}</span>
                  </div>
                  {user?.role && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Role</span>
                      <Badge variant="secondary">{user.role}</Badge>
                    </div>
                  )}
                  {userStats && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Contexts</span>
                        <span className="font-medium">{userStats.totalContexts}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Projects</span>
                        <span className="font-medium">{userStats.totalProjects}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Tags</span>
                        <span className="font-medium">{userStats.totalTags}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Files Uploaded</span>
                        <span className="font-medium">{userStats.totalFiles}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Connections */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Connections
                  </CardTitle>
                  <CardDescription>
                    Use this token to connect external tools like the Chrome extension
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Authentication Token</label>
                    <div className="flex gap-2">
                      <Input
                        value={authToken}
                        readOnly
                        className="font-mono text-sm"
                        type="password"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyToken}
                        className="shrink-0"
                      >
                        {tokenCopied ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Keep this token secure. It provides access to your encrypted contexts.
                    </p>
                  </div>

                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <h4 className="text-sm font-semibold">How to use with Chrome Extension:</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Copy the token above</li>
                      <li>Install the Aer Chrome extension</li>
                      <li>Click the extension icon and select "Setup Authentication"</li>
                      <li>Paste your token and click "Save"</li>
                      <li>Once connected, you can capture web content directly to your Aer account</li>
                    </ol>
                    <p className="text-xs text-muted-foreground mt-2">
                      Note: The token format is <code className="bg-background px-1 rounded">aer_[your-user-id]</code>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Account Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Actions</CardTitle>
                  <CardDescription>Manage your account and data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>Irreversible actions - proceed with caution</CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All My Data
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete all your contexts, projects, tags, and files from our servers.
                          {userStats && (
                            <div className="mt-4 p-3 bg-muted rounded-md">
                              <p className="font-semibold mb-2">You will lose:</p>
                              <ul className="text-sm space-y-1">
                                <li>• {userStats.totalContexts} contexts</li>
                                <li>• {userStats.totalProjects} projects</li>
                                <li>• {userStats.totalTags} tags</li>
                                <li>• {userStats.totalFiles} uploaded files</li>
                              </ul>
                            </div>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAllData}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Yes, delete everything
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="feedback" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      All User Feedback
                    </CardTitle>
                    <CardDescription>
                      View and manage feedback from all users
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {allFeedback && allFeedback.length > 0 ? (
                        allFeedback.map((item) => (
                          <div
                            key={item._id}
                            className="border rounded-lg p-4 hover:border-[#8BA888] transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getTypeIcon(item.type)}
                                <h4 className="font-semibold text-sm">{item.title}</h4>
                              </div>
                              <select
                                value={item.status}
                                onChange={(e) => handleStatusChange(item._id, e.target.value)}
                                className="text-xs border rounded px-2 py-1"
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                              </select>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {item.description}
                            </p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{item.userEmail}</span>
                              <span>{new Date(item._creationTime).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No feedback submitted yet</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}