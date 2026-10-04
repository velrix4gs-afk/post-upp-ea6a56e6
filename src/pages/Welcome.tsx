import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Megaphone, Globe, TrendingUp, MessageCircle, Clapperboard, Users, ArrowRight } from 'lucide-react';

const NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;

const howItWorksSteps = [
  {
    icon: Megaphone,
    title: 'Post it up',
    description: 'Share photos, videos, and Showcase moments in seconds. No follower count needed — every post goes out to the whole community.'
  },
  {
    icon: Globe,
    title: 'Reach everyone',
    description: 'POST UPP is a global public wall. Your posts are seen by everyone, not just people who already follow you.'
  },
  {
    icon: TrendingUp,
    title: 'Get discovered',
    description: 'The feed learns what you love from what you watch and interact with, and shows you more of it — like your own personal channel.'
  }
];

const highlights = [
  { icon: MessageCircle, label: 'Real-time chats & calls' },
  { icon: Clapperboard, label: 'Showcase moments' },
  { icon: Users, label: 'Pages for brands & creators' }
];

const Welcome = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const isNewUser = user?.created_at
    ? Date.now() - new Date(user.created_at).getTime() < NEW_ACCOUNT_WINDOW_MS
    : false;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/signin', { replace: true });
      return;
    }
    // Only brand-new accounts see the walkthrough; everyone else goes to the feed
    if (!isNewUser) {
      navigate('/feed', { replace: true });
    }
  }, [user, loading, isNewUser, navigate]);

  if (loading || !user || !isNewUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-48 mx-auto" />
          <Skeleton className="h-8 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-16 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-primary rounded-3xl shadow-glow">
            <span className="text-3xl font-bold text-white">PU</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Welcome to POST UPP
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Your account is ready. Here's how it works — takes 20 seconds.
          </p>
        </section>

        {/* How it works */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-center">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {howItWorksSteps.map((step, index) => (
              <Card key={step.title} className="p-6 bg-card backdrop-blur-sm border-border/50 shadow-lg space-y-3">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">Step {index + 1}</span>
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Highlights */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {highlights.map((item) => (
              <div key={item.label} className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card px-4 py-2 text-sm">
                <item.icon className="h-4 w-4 text-accent" />
                {item.label}
              </div>
            ))}
          </div>
          <div className="text-center">
            <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent hover:shadow-glow transition-all gap-2">
              <Link to="/feed">
                Start posting
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Welcome;
