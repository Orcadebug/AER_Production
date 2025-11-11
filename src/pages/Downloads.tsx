import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Apple, Download, Wrench, Chrome } from "lucide-react";
import { useNavigate } from "react-router";

export default function Downloads() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Aer" className="h-8 w-8 cursor-pointer" onClick={() => navigate("/")} />
            <h1 className="text-2xl font-bold tracking-tight">Download Connectors</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <p className="text-muted-foreground mb-8">
          Save is easy: use the browser extension to right-click and save chats, pages, and highlights, or use the desktop app for files and PDFs.
        </p>
        <div className="grid md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-5 w-5" /> macOS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Available now</p>
              <Button asChild className="w-full">
                <a href="/support?topic=mac-download">
                  <Download className="h-4 w-4 mr-2" /> Download for macOS
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Chrome className="h-5 w-5" /> Chrome Extension
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Right-click to save chats and pages</p>
              <Button asChild className="w-full">
                <a href="/support?topic=chrome-extension">
                  <Download className="h-4 w-4 mr-2" /> Get for Chrome
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" /> Windows
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Coming soon</p>
              <Button disabled className="w-full" variant="outline">
                <Download className="h-4 w-4 mr-2" /> Coming soon
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" /> Linux
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Planned</p>
              <Button disabled className="w-full" variant="outline">
                <Download className="h-4 w-4 mr-2" /> Planned
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
