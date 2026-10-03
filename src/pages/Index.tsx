import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Megaphone, Globe, TrendingUp, MessageCircle, Clapperboard, Users } from 'lucide-react';

const howItWorksSteps = [
  {
    icon: Megaphone,
    title: 'Post it up',
    description: 'Share photos, videos, reels and stories in seconds. No follower count needed — every post goes out to the whole community.'
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
  { icon: Clapperboard, label: 'Reels & stories' },
  { icon: Users, label: 'Pages for brands & creators' }
];

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/feed');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-48 mx-auto" />
          <Skeleton className="h-8 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  if (user) {
    return null;
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
            Your voice, broadcast to everyone
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            POST UPP is a global public wall — every post you make can be seen by the whole community, and the feed learns what you love.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button asChild size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent hover:shadow-glow transition-all">
              <Link to="/signup">Create free account</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/signin">Sign in</Link>
            </Button>
          </div>
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
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {highlights.map((item) => (
              <div key={item.label} className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card px-4 py-2 text-sm">
                <item.icon className="h-4 w-4 text-accent" />
                {item.label}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Ready to post up?{' '}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Join now
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
};

export default Index;
