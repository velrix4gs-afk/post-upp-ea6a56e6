import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, CheckCircle } from "lucide-react";

export default function AdminSetup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  // Guard: only allow access if no admins exist yet (bootstrap), or current user is admin.
  // We rely on the edge function as the source of truth, but hide the UI from
  // non-admins once the system is set up.
  useEffect(() => {
    if (!adminLoading && user && !isAdmin) {
      // Probe: try a no-op invocation? Simpler: just redirect non-admins.
      // The edge function still enforces the real check server-side.
      navigate("/", { replace: true });
    }
  }, [adminLoading, user, isAdmin, navigate]);

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to create the official account");
      }

      const { data, error } = await supabase.functions.invoke('create-official-account', {
        body: { email, password }
      });

      if (error) throw error;

      setIsComplete(true);
      toast({
        title: "Success!",
        description: "Official @postupp_official account created with admin privileges and verification badge.",
      });

      setTimeout(() => {
        navigate('/');
      }, 3000);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-subtle">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Setup Complete!</CardTitle>
            <CardDescription>
              The @postupp_official account has been created successfully with admin privileges.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-subtle">
      <main>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center">Create Official Account</CardTitle>
          <CardDescription className="text-center">
            Set up @postupp_official with admin role and verification badge
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email for @postupp_official</Label>
              <Input
                id="email"
                type="email"
                placeholder="official@postupp.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating Account..." : "Create Official Account"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              This will create @postupp_official with admin privileges and verification badge.
              Your current account will also receive admin role.
            </p>
          </form>
        </CardContent>
      </Card>
      </main>
    </div>
  );
}
