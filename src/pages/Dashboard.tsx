import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useEncryption } from "@/hooks/use-encryption";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { FileText, Loader2, LogOut, Plus, Search, Upload, X, FolderOpen, Tag as TagIcon, Lock, Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";
import { extractTextFromPDF, isPDF } from "@/lib/pdfExtractor";
import { internal } from "@/convex/_generated/api";
import { useAction } from "convex/react";

export default function Dashboard() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const { encrypt, decrypt, isReady: encryptionReady } = useEncryption();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<Id<"projects"> | "all">("all");
  const [selectedTag, setSelectedTag] = useState<Id<"tags"> | "all">("all");
  const [isAddingContext, setIsAddingContext] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [paginationCursor, setPaginationCursor] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<any | null>(null);
  const [aiSearchResults, setAiSearchResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const contextsResult = useQuery(
    api.contexts.listPaginated,
    selectedProject !== "all"
      ? { projectId: selectedProject, paginationOpts: { numItems: 20, cursor: paginationCursor } }
      : selectedTag !== "all"
      ? { tagId: selectedTag, paginationOpts: { numItems: 20, cursor: paginationCursor } }
      : { paginationOpts: { numItems: 20, cursor: paginationCursor } }
  );
  const searchResults = useQuery(
    api.contexts.search,
    searchQuery && searchQuery.trim().length > 0 ? { query: searchQuery } : "skip"
  );
  const projects = useQuery(api.projects.list);
  const tags = useQuery(api.tags.list);

  const matchQueryToTags = useAction(api.ai.matchQueryToTags);

  const createContext = useMutation(api.contexts.create);
  const createProject = useMutation(api.projects.create);
  const createTag = useMutation(api.tags.create);
  const deleteContext = useMutation(api.contexts.remove);
  const generateUploadUrl = useMutation(api.contexts.generateUploadUrl);

  // AI-powered search effect
  useEffect(() => {
    const performAiSearch = async () => {
      if (!searchQuery || searchQuery.trim().length === 0) {
        setAiSearchResults(null);
        setIsSearching(false);
        return;
      }

      if (!searchResults || searchResults.length === 0) {
        setAiSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        // Collect all unique tags from search results
        const allTags = new Set<string>();
        searchResults.forEach((context: any) => {
          if (context.tags) {
            context.tags.forEach((tag: string) => allTags.add(tag));
          }
        });

        if (allTags.size === 0) {
          setAiSearchResults(searchResults);
          setIsSearching(false);
          return;
        }

        // Use AI to match query to relevant tags
        const relevantTags = await matchQueryToTags({
          userId: user!._id,
          query: searchQuery,
          allTags: Array.from(allTags),
        });

        if (relevantTags.length === 0) {
          setAiSearchResults(searchResults);
          setIsSearching(false);
          return;
        }

        // Filter and rank contexts by matching tags
        const rankedContexts = searchResults
          .map((context: any) => {
            if (!context.tags || context.tags.length === 0) {
              return { context, score: 0 };
            }

            // Calculate relevance score based on tag matches
            let score = 0;
            context.tags.forEach((tag: string) => {
              const tagIndex = relevantTags.indexOf(tag);
              if (tagIndex !== -1) {
                // Weight later tags higher in case AI returns least→most relevance
                score += (tagIndex + 1) * 10;
              }
            });

            return { context, score };
          })
          .filter((item: any) => item.score > 0)
          .sort((a: any, b: any) => b.score - a.score)
          .map((item: any) => item.context);

        setAiSearchResults(rankedContexts);
      } catch (error) {
        console.error("AI search error:", error);
        setAiSearchResults(searchResults);
      } finally {
        setIsSearching(false);
      }
    };

    performAiSearch();
  }, [searchQuery, searchResults, matchQueryToTags]);

  const displayContexts = searchQuery 
    ? (aiSearchResults !== null ? aiSearchResults : searchResults)
    : contextsResult?.page;

  if (isLoading || !encryptionReady) {
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

  const handleAddNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const projectId = formData.get("projectId") as string;

    try {
      // Generate a simple summary client-side (AI will improve it later if available)
      const summary = content.length > 150 
        ? content.substring(0, 150) + "..." 
        : content;

      // Encrypt the content, title, and summary
      const encryptedContent = encrypt(content);
      const encryptedTitle = encrypt(title);
      const encryptedSummary = encrypt(summary);

      if (!encryptedContent || !encryptedTitle || !encryptedSummary) {
        toast.error("Encryption failed");
        return;
      }

      await createContext({
        title: title.substring(0, 50), // Truncated for search
        type: "note",
        projectId: projectId && projectId !== "none" ? projectId as Id<"projects"> : undefined,
        encryptedContent,
        encryptedTitle,
        encryptedSummary,
        plaintextContent: content, // For AI tag generation (not stored)
      });
      toast.success("Note added successfully");
      setIsAddingContext(false);
    } catch (error) {
      toast.error("Failed to add note");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info("Processing file...");
      
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();

      // Extract text content from PDF files
      let fileContent = `Uploaded file: ${file.name}`;
      let fileSummary = `File uploaded: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
      
      if (isPDF(file)) {
        try {
          const extractedText = await extractTextFromPDF(file);
          if (extractedText && extractedText.trim().length > 0) {
            fileContent = extractedText;
            // Create a better summary for PDFs with content
            const preview = extractedText.substring(0, 200).trim();
            fileSummary = preview.length < extractedText.length 
              ? `${preview}...` 
              : preview;
          }
        } catch (error) {
          console.error("PDF text extraction failed:", error);
          toast.warning("Could not extract text from PDF, storing file metadata only");
        }
      }
      
      const encryptedContent = encrypt(fileContent);
      const encryptedTitle = encrypt(file.name);
      const encryptedSummary = encrypt(fileSummary);

      if (!encryptedContent || !encryptedTitle || !encryptedSummary) {
        toast.error("Encryption failed");
        return;
      }

      await createContext({
        title: file.name.substring(0, 50),
        type: "file",
        fileId: storageId,
        fileName: file.name,
        fileType: file.type,
        encryptedContent,
        encryptedTitle,
        encryptedSummary,
        plaintextContent: fileContent,
      });
      toast.success("File uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload file");
    }
  };

  const handleAddProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    try {
      await createProject({ name, description });
      toast.success("Project created");
      setIsAddingProject(false);
    } catch (error) {
      toast.error("Failed to create project");
    }
  };

  const handleAddTag = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;

    try {
      await createTag({ name });
      toast.success("Tag created");
      setIsAddingTag(false);
    } catch (error) {
      toast.error("Failed to create tag");
    }
  };

  const handleDeleteContext = async (id: Id<"contexts">) => {
    try {
      await deleteContext({ id });
      toast.success("Context deleted");
    } catch (error) {
      toast.error("Failed to delete context");
    }
  };

  // Helper function to get short file type display
  const getShortFileType = (mimeType: string) => {
    const typeMap: Record<string, string> = {
      "application/pdf": "PDF",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
      "application/msword": "DOC",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
      "application/vnd.ms-excel": "XLS",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
      "application/vnd.ms-powerpoint": "PPT",
      "text/plain": "TXT",
      "text/csv": "CSV",
      "image/jpeg": "JPEG",
      "image/png": "PNG",
      "image/gif": "GIF",
      "image/svg+xml": "SVG",
    };
    
    return typeMap[mimeType] || mimeType.split("/")[1]?.toUpperCase() || "FILE";
  };

  // Decrypt full context content
  const getDecryptedContent = (context: any) => {
    if (context.encryptedContent) {
      const decrypted = decrypt(context.encryptedContent);
      if (!decrypted) {
        return "[This content was encrypted with a previous session key and cannot be decrypted. Please delete this context and create it again with the new encryption system.]";
      }
      return decrypted;
    }
    return "No content available";
  };

  // Decrypt context title
  const getDecryptedTitle = (context: any) => {
    if (context.encryptedTitle) {
      const decrypted = decrypt(context.encryptedTitle);
      if (!decrypted) {
        return `${context.title} [Old Encryption - Delete Me]`;
      }
      return decrypted;
    }
    return context.title;
  };

  // Decrypt context summary for preview (not full content)
  const getDecryptedSummary = (context: any) => {
    if (context.encryptedSummary) {
      const decrypted = decrypt(context.encryptedSummary);
      if (!decrypted) {
        return "[Encrypted with old key - please delete and re-create this context]";
      }
      return decrypted;
    }
    // Fallback to showing type if no summary
    return `${context.type === "file" ? "File" : "Note"} - No preview available`;
  };

  const handleCopySummary = (context: any) => {
    const title = getDecryptedTitle(context);
    const content = getDecryptedContent(context);
    const summary = `# ${title}\n\nType: ${context.type}\nCreated: ${new Date(context._creationTime).toLocaleString()}\n${context.tags && context.tags.length > 0 ? `Tags: ${context.tags.join(", ")}\n` : ""}\n## Content\n\n${content}`;
    
    navigator.clipboard.writeText(summary);
    toast.success("Context copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Aer" className="h-8 w-8 cursor-pointer" onClick={() => navigate("/")} />
            <h1 className="text-2xl font-bold tracking-tight">Aer</h1>
            <Badge variant="secondary" className="ml-2">
              <Lock className="h-3 w-3 mr-1" />
              E2E Encrypted
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Actions */}
        <div className="mb-8 space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="AI-powered search by tags and content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-[#8BA888]" />
              )}
            </div>
            <Dialog open={isAddingContext} onOpenChange={setIsAddingContext}>
              <DialogTrigger asChild>
                <Button className="bg-[#8BA888] hover:bg-[#7A9777]">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddNote}>
                  <DialogHeader>
                    <DialogTitle>Add New Note</DialogTitle>
                    <DialogDescription>Create a new encrypted context entry</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Input name="title" placeholder="Title" required />
                    <Textarea name="content" placeholder="Content" rows={6} required />
                    <Select name="projectId">
                      <SelectTrigger>
                        <SelectValue placeholder="Select project (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projects?.map((p) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="bg-[#8BA888] hover:bg-[#7A9777]">
                      Add Note
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={() => document.getElementById("file-upload")?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept=".pdf,.txt,.docx,.doc"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-4 flex-wrap items-center">
            <Dialog open={isAddingProject} onOpenChange={setIsAddingProject}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-3 w-3 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddProject}>
                  <DialogHeader>
                    <DialogTitle>Create Project</DialogTitle>
                    <DialogDescription>Fill in the details to create a new project.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Input name="name" placeholder="Project name" required />
                    <Textarea name="description" placeholder="Description (optional)" rows={3} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="bg-[#8BA888] hover:bg-[#7A9777]">
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddingTag} onOpenChange={setIsAddingTag}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-3 w-3 mr-2" />
                  New Tag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddTag}>
                  <DialogHeader>
                    <DialogTitle>Create Tag</DialogTitle>
                    <DialogDescription>Add a short name for your new tag.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Input name="name" placeholder="Tag name" required />
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="bg-[#8BA888] hover:bg-[#7A9777]">
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Select value={selectedProject} onValueChange={(v) => setSelectedProject(v as Id<"projects"> | "all")}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    <FolderOpen className="h-3 w-3 inline mr-2" />
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedTag} onValueChange={(v) => setSelectedTag(v as Id<"tags"> | "all")}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {tags?.map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    <TagIcon className="h-3 w-3 inline mr-2" />
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Context Feed */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayContexts?.map((context, index) => (
            <motion.div
              key={context._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:border-[#8BA888] transition-colors cursor-pointer" onClick={() => setSelectedContext(context)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {context.type === "file" && <FileText className="h-4 w-4" />}
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        {context.title}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {new Date(context._creationTime).toLocaleDateString()}
                      </CardDescription>
                      {context.tags && context.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {context.tags.slice(0, 5).map((tag: string, idx: number) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteContext(context._id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {getDecryptedSummary(context)}
                  </p>
                  {context.type === "file" && context.fileType && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {getShortFileType(context.fileType)}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Load More Button */}
        {!searchQuery && contextsResult && !contextsResult.isDone && (
          <div className="flex justify-center mt-8">
            <Button
              variant="outline"
              onClick={() => setPaginationCursor(contextsResult.continueCursor)}
            >
              Load More
            </Button>
          </div>
        )}

        {displayContexts?.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No contexts yet</h3>
            <p className="text-muted-foreground">Start by adding a note or uploading a file</p>
          </div>
        )}
      </div>

      {/* Context Detail Dialog */}
      <Dialog open={!!selectedContext} onOpenChange={(open) => !open && setSelectedContext(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedContext && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedContext.type === "file" && <FileText className="h-5 w-5" />}
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  {getDecryptedTitle(selectedContext)}
                </DialogTitle>
                <DialogDescription>
                  Created on {new Date(selectedContext._creationTime).toLocaleString()}
                  {selectedContext.type === "file" && ` • ${selectedContext.fileType}`}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {selectedContext.tags && selectedContext.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedContext.tags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedContext.encryptedSummary && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Summary</h4>
                    <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
                      {getDecryptedSummary(selectedContext)}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold mb-2">Content</h4>
                  <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
                    {getDecryptedContent(selectedContext)}
                  </div>
                </div>

                {selectedContext.type === "file" && selectedContext.fileId && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">File Information</h4>
                    <div className="text-sm text-muted-foreground">
                      <p>Filename: {selectedContext.fileName}</p>
                      <p>Type: {selectedContext.fileType}</p>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleCopySummary(selectedContext)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy for LLM
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedContext(null)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}