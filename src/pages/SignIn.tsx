import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, Mail, Lock, Chrome } from 'lucide-react';
import { z } from 'zod';

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const SignIn = () => {
  const [authMode, setAuthMode] = useState<'email' | 'code'>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/welcome`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Google sign-in is not configured yet. Please use email or magic link.',
        variant: 'destructive'
      });
    }
  };


  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = signInSchema.parse(signInData);
      
      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password
      });

      if (error) {
        toast({
          title: 'Sign in failed',
          description: 'Invalid email or password. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Welcome back!',
        description: 'Successfully signed in.'
      });
      
      navigate('/feed');
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation error',
          description: error.issues[0].message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Something went wrong',
          description: 'Please try again later.',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate email
      if (!magicLinkEmail || !magicLinkEmail.includes('@')) {
        toast({
          title: 'Invalid email',
          description: 'Please enter a valid email address',
          variant: 'destructive'
        });
        return;
      }

      // Send OTP via edge function
      const { data, error } = await supabase.functions.invoke('send-login-otp', {
        body: { email: magicLinkEmail }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive'
        });
        return;
      }

      // Navigate to login verification page
      navigate('/auth/login-verify', { state: { email: magicLinkEmail } });
      
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send verification code',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/5 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
      
      <Card className="w-full max-w-md bg-card backdrop-blur-sm border-border/50 shadow-lg relative z-10">
        <div className="p-8 space-y-6">
          {/* Logo and Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-2xl shadow-glow mb-2">
              <span className="text-2xl font-bold text-white">PU</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
              <p className="text-sm text-muted-foreground mt-1">Sign in to your account to continue</p>
            </div>
          </div>

          {/* Sign In with Code View */}
          {authMode === 'code' ? (
            <div className="space-y-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuthMode('email')}
                className="hover:bg-muted/50"
              >
                ← Back to sign in
              </Button>
              
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-2">
                  <Mail className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold">Sign In with Code</h3>
                <p className="text-sm text-muted-foreground">
                  We'll email you a 6-digit sign-in code
                </p>
              </div>
              
              <form onSubmit={handleCodeSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code-email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="code-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10 h-11"
                      value={magicLinkEmail}
                      onChange={(e) => setMagicLinkEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-gradient-to-r from-primary to-accent hover:shadow-glow transition-all" 
                  disabled={loading}
                >
                  {loading ? 'Sending code...' : 'Send sign-in code'}
                </Button>
              </form>
            </div>
          ) : (
            /* Email Sign In View */
            <div className="space-y-5">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10 h-11"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <Link 
                      to="/forgot-password" 
                      className="text-xs text-primary hover:underline"
                      tabIndex={-1}
                    >
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      className="pl-10 pr-10 h-11"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 bg-gradient-to-r from-primary to-accent hover:shadow-glow transition-all" 
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Social & Alternative Sign In */}
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 gap-2 hover:bg-muted/50 transition-colors"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  aria-label="Sign in with Google"
                >
                  <Chrome className="h-4 w-4" aria-hidden="true" />
                  Continue with Google
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 gap-2 hover:bg-muted/50 transition-colors"
                  onClick={() => setAuthMode('code')}
                  disabled={loading}
                >
                  <Mail className="h-4 w-4" />
                  Sign in with code
                </Button>
              </div>

              {/* Sign Up Link */}
              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <Link 
                    to="/signup" 
                    className="font-medium text-primary hover:underline"
                  >
                    Create account
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </main>
  );
};

export default SignIn;
