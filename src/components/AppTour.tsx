import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Home, MessageCircle, PlusCircle, Sparkles, Users, X } from 'lucide-react';

export const TOUR_FLAG = 'postup_show_tour';
export const TOUR_DONE = 'postup_tour_done';

const STEPS = [
  {
    icon: Home,
    title: 'Your feed, two ways',
    body: 'For You mixes fresh posts from across POST UP. Following shows only the people you follow. Swipe between them at the top of the feed.',
  },
  {
    icon: PlusCircle,
    title: 'Post, story or reel',
    body: 'Tap the post bar to share text and photos, or use the create button for a story or a reel. You can add several images to one post.',
  },
  {
    icon: MessageCircle,
    title: 'Chat and calls',
    body: 'Messages support photos, videos and voice notes. Long-press a chat for a full preview, and start a voice or video call from the chat header.',
  },
  {
    icon: Users,
    title: 'Profiles at a glance',
    body: 'Press and hold any name or avatar to peek at that profile without leaving the page. Tap through when you want the full profile.',
  },
  {
    icon: Sparkles,
    title: 'Ask the assistant',
    body: 'The AI assistant knows this app. Ask it where something is or what to do next and it can take you straight there.',
  },
];

/**
 * One-time run-down of the app, shown right after onboarding completes.
 */
export const AppTour = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/onboarding') return;
    try {
      if (localStorage.getItem(TOUR_FLAG) === '1' && localStorage.getItem(TOUR_DONE) !== '1') {
        setOpen(true);
      }
    } catch {
      /* storage unavailable */
    }
  }, [location.pathname]);

  const finish = () => {
    try {
      localStorage.setItem(TOUR_DONE, '1');
      localStorage.removeItem(TOUR_FLAG);
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && finish()}>
      <DialogContent
        className="max-w-sm rounded-3xl p-0 overflow-hidden border-border/60"
        hideCloseButton
      >
        <button
          onClick={finish}
          aria-label="Skip tutorial"
          className="absolute right-3 top-3 z-10 h-9 w-9 rounded-full bg-muted/70 flex items-center justify-center touch-manipulation"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-10 pb-6 text-center">
          <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>

          <div className="flex items-center justify-center gap-1.5 my-6">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 rounded-xl" onClick={finish}>
              Skip
            </Button>
            <Button
              className="flex-1 rounded-xl"
              onClick={() => {
                if (isLast) {
                  finish();
                  navigate('/feed');
                } else {
                  setStep((s) => s + 1);
                }
              }}
            >
              {isLast ? 'Start using POST UP' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};