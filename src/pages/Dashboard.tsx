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
import { FileText, Loader2, LogOut, Plus, Search, Upload, X, FolderOpen, Tag as TagIcon, Lock } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Id } from "@/convex/_generated/dataModel";

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

  const contextsResult = useQuery(
    api.contexts.listPaginated,
    selectedProject !== "all"
      ? { projectId: selectedProject, paginationOpts: { numItems: 20, cursor: paginationCursor } }
      : selectedTag !== "all"
      ? { tagId: selectedTag, paginationOpts: { numItems: 20, cursor: paginationCursor } }
      : { paginationOpts: { numItems: 20, cursor: paginationCursor } }
  );
  const searchResults = useQuery(api.contexts.search, searchQuery ? { query: searchQuery } : "skip");
  const projects = useQuery(api.projects.list);
  const tags = useQuery(api.tags.list);

  const createContext = useMutation(api.contexts.create);
  const createProject = useMutation(api.projects.create);
  const createTag = useMutation(api.tags.create);
  const deleteContext = useMutation(api.contexts.remove);
  const generateUploadUrl = useMutation(api.contexts.generateUploadUrl);

  const displayContexts = searchQuery ? searchResults : contextsResult?.page;

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
      // Encrypt the content
      const encryptedContent = encrypt(content);
      const encryptedTitle = encrypt(title);

      if (!encryptedContent || !encryptedTitle) {
        toast.error("Encryption failed");
        return;
      }

      await createContext({
        title: title.substring(0, 50), // Truncated for search
        type: "note",
        projectId: projectId && projectId !== "none" ? projectId as Id<"projects"> : undefined,
        encryptedContent,
        encryptedTitle,
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
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();

      // Encrypt file metadata
      const fileMetadata = `File: ${file.name} (${file.type})`;
      const encryptedContent = encrypt(fileMetadata);
      const encryptedTitle = encrypt(file.name);

      if (!encryptedContent || !encryptedTitle) {
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
        plaintextContent: fileMetadata, // For AI tag generation
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

  // Decrypt context content for display
  const getDecryptedContent = (context: any) => {
    if (context.encryptedContent) {
      const decrypted = decrypt(context.encryptedContent);
      return decrypted || "[Encrypted - Unable to decrypt]";
    }
    return "[No content]";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Aer" className="h-8 w-8 cursor-pointer" onClick={() => navigate("/")} />
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
                placeholder="Search your contexts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
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
              <Card className="hover:border-[#8BA888] transition-colors">
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
                          {context.tags.slice(0, 5).map((tag, idx) => (
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
                      onClick={() => handleDeleteContext(context._id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {getDecryptedContent(context)}
                  </p>
                  {context.type === "file" && (
                    <Badge variant="secondary" className="mt-2">
                      {context.fileType}
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
    </div>
  );
}