import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Loader2, MessageSquare, Bug, Lightbulb, HelpCircle, Send } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function Support() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<"bug" | "feature" | "question">("question");

  const feedbackList = useQuery(api.feedback.list);
  const createFeedback = useMutation(api.feedback.create);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    try {
      await createFeedback({
        type: selectedType,
        title,
        description,
      });
      toast.success("Feedback submitted successfully!");
      e.currentTarget.reset();
    } catch (error) {
      toast.error("Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
<img src="/logo.png" alt="Aer" className="h-8 w-8 cursor-pointer" onClick={() => navigate("/dashboard")} />
            <h1 className="text-2xl font-bold tracking-tight">Support & Feedback</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Submit Feedback Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Submit Feedback
                </CardTitle>
                <CardDescription>
                  Report bugs, suggest features, or ask questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Type</label>
                    <Select value={selectedType} onValueChange={(v) => setSelectedType(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="question">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="h-4 w-4" />
                            Question
                          </div>
                        </SelectItem>
                        <SelectItem value="bug">
                          <div className="flex items-center gap-2">
                            <Bug className="h-4 w-4" />
                            Bug Report
                          </div>
                        </SelectItem>
                        <SelectItem value="feature">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="h-4 w-4" />
                            Feature Request
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Title</label>
                    <Input
                      name="title"
                      placeholder="Brief summary of your feedback"
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <Textarea
                      name="description"
                      placeholder="Provide details about your feedback..."
                      rows={6}
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-[#8BA888] hover:bg-[#7A9777]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Submit Feedback
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Your Feedback History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Your Feedback</CardTitle>
                <CardDescription>
                  Track the status of your submissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {feedbackList && feedbackList.length > 0 ? (
                    feedbackList.map((item) => (
                      <div
                        key={item._id}
                        className="border rounded-lg p-4 hover:border-[#8BA888] transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(item.type)}
                            <h4 className="font-semibold text-sm">{item.title}</h4>
                          </div>
                          <Badge className={getStatusColor(item.status)}>
                            {item.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {item.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item._creationTime).toLocaleDateString()}
                        </p>
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
        </div>
      </div>
    </div>
  );
}
