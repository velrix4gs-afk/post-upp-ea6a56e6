import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Star, Zap, TrendingUp, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface PremiumPlan {
  id: string;
  name: string;
  price_ngn_kobo: number;
  price_usd_display: number | null;
  interval: string;
  features: string[];
  sort_order: number;
}

// Icon/color per plan id -- purely cosmetic, doesn't need to live in the DB.
const PLAN_STYLE: Record<string, { icon: typeof Star; color: string; popular?: boolean }> = {
  basic: { icon: Star, color: 'from-yellow-500 to-amber-500' },
  pro: { icon: Zap, color: 'from-purple-500 to-pink-500', popular: true },
  elite: { icon: Crown, color: 'from-blue-500 to-cyan-500' },
};

// Rough, locally-obvious NGN->USD display only -- the actual charge is
// always in NGN via Paystack; this is just so non-Nigerian visitors see an
// approximate price instead of only a naira amount. Update this if you get
// a live FX source later.
const NGN_PER_USD_APPROX = 1500;

const isLikelyNigeria = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === 'Africa/Lagos';
  } catch {
    return false;
  }
};

const PremiumPage = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [checkingOutTier, setCheckingOutTier] = useState<string | null>(null);
  const showNaira = isLikelyNigeria();

  useEffect(() => {
    const loadPlans = async () => {
      const { data, error } = await supabase
        .from('premium_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Failed to load premium plans:', error);
        toast({ description: 'Could not load plans right now.', variant: 'destructive' });
      } else if (data) {
        setPlans(data as unknown as PremiumPlan[]);
      }
      setLoadingPlans(false);
    };
    loadPlans();
  }, []);

  const handleSubscribe = async (tier: string) => {
    if (!user) {
      toast({ description: 'Please sign in to subscribe', variant: 'destructive' });
      return;
    }
    setCheckingOutTier(tier);
    try {
      const { data, error } = await supabase.functions.invoke('create-paystack-checkout', {
        body: { planId: tier },
      });
      if (error) throw error;
      if (!data?.authorization_url) throw new Error('No checkout URL returned');
      // Send them to Paystack's real, per-user checkout -- not the old
      // static shared link that couldn't identify who paid.
      window.location.href = data.authorization_url;
    } catch (err: any) {
      console.error('Checkout failed:', err);
      toast({
        description: err.message || 'Could not start checkout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCheckingOutTier(null);
    }
  };

  const formatPrice = (plan: PremiumPlan) => {
    if (showNaira) {
      return `\u20a6${(plan.price_ngn_kobo / 100).toLocaleString()}`;
    }
    if (plan.price_usd_display != null) {
      return `$${plan.price_usd_display.toFixed(2)}`;
    }
    return `~$${(plan.price_ngn_kobo / 100 / NGN_PER_USD_APPROX).toFixed(2)}`;
  };

  return <div className="min-h-screen bg-background">
    <Navigation />

    <main className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Crown className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Go Premium
          </h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Unlock exclusive features and get priority support. Choose the plan that's right for you.
        </p>
        {!showNaira && (
          <p className="text-xs text-muted-foreground mt-2">
            Prices shown in USD are approximate -- you'll be charged the equivalent in NGN via Paystack.
          </p>
        )}

      </div>

      {/* Pricing Cards */}
      {loadingPlans ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map(plan => {
            const style = PLAN_STYLE[plan.id] || { icon: Star, color: 'from-primary to-primary/60' };
            const Icon = style.icon;
            return <Card key={plan.id} className={cn('relative p-6 border-2 transition-all hover:scale-105', style.popular ? 'border-primary shadow-lg shadow-primary/20' : 'border-border')}>
              {style.popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                Most Popular
              </Badge>}

              <div className="text-center mb-6">
                <div className={cn('inline-flex p-3 rounded-full bg-gradient-to-r mb-4', style.color)}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">{formatPrice(plan)}</span>
                  <span className="text-muted-foreground">/{plan.interval}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => <li key={idx} className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </li>)}
              </ul>

              <Button
                className={cn('w-full bg-gradient-to-r text-white', style.color)}
                onClick={() => handleSubscribe(plan.id)}
                disabled={checkingOutTier === plan.id}
              >
                {checkingOutTier === plan.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Subscribe Now
              </Button>
            </Card>;
          })}
        </div>
      )}

      {/* Benefits Section */}
      <div className="mt-16 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Why Go Premium?</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <TrendingUp className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Grow Faster</h3>
            <p className="text-muted-foreground">
              Get access to advanced analytics and insights to understand your audience better and grow your presence.
            </p>
          </Card>
          <Card className="p-6">
            <Star className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Stand Out</h3>
            <p className="text-muted-foreground">
              Custom themes and exclusive features help you create a unique presence.
            </p>
          </Card>
        </div>
      </div>
    </main>
  </div>;
};
export default PremiumPage;