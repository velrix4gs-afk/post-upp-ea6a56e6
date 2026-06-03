import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { BottomNavigation } from '@/components/BottomNavigation';
import { showCleanError } from '@/lib/errorHandler';

/**
 * Full-page Coins wallet. Mirrors the existing CoinsDialog purchase flow but
 * lives at /coins so it is reachable from menus, profile, and tip prompts.
 * Reuses the existing `create-coins-checkout` edge function — no new API.
 */
const coinPackages = [
  { coins: 200, price: 0.99 },
  { coins: 500, price: 2.49 },
  { coins: 1000, price: 4.99, popular: true },
  { coins: 2500, price: 9.99 },
  { coins: 5000, price: 19.99 },
  { coins: 10000, price: 39.99 },
];

const CoinsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('coins_balance')
          .eq('id', user.id)
          .maybeSingle();
        if (!cancelled) setBalance((data as any)?.coins_balance ?? 0);
      } finally {
        if (!cancelled) setLoadingBalance(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handlePurchase = async (coins: number, price: number) => {
    if (!user) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return;
    }
    try {
      setPurchasing(coins);
      const { data, error } = await supabase.functions.invoke('create-coins-checkout', {
        body: { coins, price },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch (err: any) {
      showCleanError(err, toast, 'Checkout failed');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/85 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Coins</h1>
      </header>

      <section className="px-4 pt-6">
        <Card className="p-6 flex items-center justify-between bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border-yellow-500/20">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your balance</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-bold">
                {loadingBalance ? <Loader2 className="h-6 w-6 animate-spin" /> : balance ?? 0}
              </span>
              <span className="text-sm text-muted-foreground">coins</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">1 coin = $0.01</p>
          </div>
          <Coins className="h-12 w-12 text-yellow-500" />
        </Card>
      </section>

      <section className="px-4 mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Buy coins</h2>
          <button
            onClick={() => navigate('/purchases')}
            className="text-xs text-primary hover:underline"
          >
            Purchase history
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {coinPackages.map((pkg) => (
            <Card
              key={pkg.coins}
              className={`p-4 relative ${
                pkg.popular ? 'border-primary border-2 shadow-md' : ''
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                  POPULAR
                </div>
              )}
              <div className="text-center space-y-2">
                <Coins className="h-8 w-8 text-yellow-500 mx-auto" />
                <div className="text-2xl font-bold">{pkg.coins.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">${pkg.price.toFixed(2)}</div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={purchasing !== null}
                  onClick={() => handlePurchase(pkg.coins, pkg.price)}
                >
                  {purchasing === pkg.coins ? 'Opening…' : 'Buy'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="px-4 mt-8">
        <Card className="p-4 bg-muted/40">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            How tipping works
          </h3>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Spend coins to tip verified creators on their profile or posts. Tips
            are credited instantly to the creator's wallet and never expire.
            Only verified creators can receive tips.
          </p>
        </Card>
      </section>

      <BottomNavigation />
    </div>
  );
};

export default CoinsPage;