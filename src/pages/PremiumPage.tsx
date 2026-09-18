import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Star, Zap, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { CoinsDialog } from '@/components/premium/CoinsDialog';
import { cn } from '@/lib/utils';
const PremiumPage = () => {
  const {
    user
  } = useAuth();
  const plans = [{
    name: 'Basic Premium',
    tier: 'basic',
    icon: Star,
    price: 4.99,
    color: 'from-yellow-500 to-amber-500',
    features: ['Remove all ads', 'Custom profile themes', 'Priority support', 'Verification badge', '50GB storage']
  }, {
    name: 'Pro',
    tier: 'pro',
    icon: Zap,
    price: 9.99,
    color: 'from-purple-500 to-pink-500',
    popular: true,
    features: ['Everything in Basic', 'Advanced analytics', 'Schedule unlimited posts', 'Custom URL', '200GB storage', 'Exclusive content creation tools']
  }, {
    name: 'Elite',
    tier: 'elite',
    icon: Crown,
    price: 19.99,
    color: 'from-blue-500 to-cyan-500',
    features: ['Everything in Pro', 'Dedicated account manager', 'API access', 'White-label options', 'Unlimited storage', 'Early access to features', 'Monetization tools']
  }];
  const handleSubscribe = (tier: string) => {
    if (!user) {
      toast({
        description: 'Please sign in to subscribe • AUTH_001',
        variant: 'destructive'
      });
      return;
    }
    const paymentLinks = {
      basic: 'https://paystack.shop/pay/flqjzwvndy',
      pro: 'https://paystack.shop/pay/kppl07pl5r',
      elite: 'https://paystack.shop/pay/fap9ccj2m4'
    };
    const link = paymentLinks[tier as keyof typeof paymentLinks];
    if (link) {
      window.open(link, '_blank');
    }
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
            Unlock exclusive features, remove ads, and get priority support. Choose the plan that's right for you.
          </p>
          <div className="mt-6 flex justify-center">
            <CoinsDialog />
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map(plan => {
          const Icon = plan.icon;
          return <Card key={plan.tier} className={cn('relative p-6 border-2 transition-all hover:scale-105', plan.popular ? 'border-primary shadow-lg shadow-primary/20' : 'border-border')}>
                {plan.popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Most Popular
                  </Badge>}

                <div className="text-center mb-6">
                  <div className={cn('inline-flex p-3 rounded-full bg-gradient-to-r mb-4', plan.color)}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>)}
                </ul>

                <Button className={cn('w-full bg-gradient-to-r text-white', plan.color)} onClick={() => handleSubscribe(plan.tier)}>
                  Subscribe Now
                </Button>
              </Card>;
        })}
        </div>

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
                Custom themes, verification badges, and exclusive features help you create a unique presence.
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>;
};
export default PremiumPage;