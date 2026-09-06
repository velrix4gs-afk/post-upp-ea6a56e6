import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Check, LogIn, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { haptic } from '@/lib/haptics';

export interface SavedAccount {
  id: string;
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}

const STORAGE_KEY = 'postupp_saved_accounts';

export const readSavedAccounts = (): SavedAccount[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Remembers the signed-in account so it shows up in the switcher later. */
export const rememberAccount = (account: SavedAccount) => {
  if (!account?.id) return;
  try {
    const existing = readSavedAccounts().filter((a) => a.id !== account.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([account, ...existing].slice(0, 5)));
  } catch {
    /* storage unavailable */
  }
};

interface AccountSwitcherSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AccountSwitcherSheet = ({ open, onOpenChange }: AccountSwitcherSheetProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    if (open) setAccounts(readSavedAccounts());
  }, [open]);

  const removeAccount = useCallback((id: string) => {
    const next = readSavedAccounts().filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAccounts(next);
  }, []);

  const switchTo = useCallback(
    async (account: SavedAccount) => {
      haptic('medium');
      if (account.id === user?.id) {
        onOpenChange(false);
        navigate(`/profile/${user.id}`);
        return;
      }
      // A different account needs its own session: sign out, then sign in.
      onOpenChange(false);
      await signOut();
      navigate('/signin', { state: { prefillUserId: account.id, prefillUsername: account.username } });
    },
    [user?.id, signOut, navigate, onOpenChange],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0">
        <div className="px-4 pt-3 pb-2">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-muted-foreground/30 mb-3" />
          <h2 className="text-base font-semibold">Switch account</h2>
          <p className="text-xs text-muted-foreground">Double-tap your picture anytime to open this.</p>
        </div>

        <div className="px-3 pb-2 space-y-1">
          {accounts.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-6 text-center">
              No other accounts saved yet.
            </p>
          )}
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-muted/60 touch-manipulation"
            >
              <button className="flex items-center gap-3 flex-1 min-w-0" onClick={() => switchTo(account)}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={account.avatarUrl || undefined} />
                  <AvatarFallback>
                    {(account.displayName || account.username || 'U')[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 text-left">
                  <span className="block text-sm font-medium truncate">
                    {account.displayName || account.username || 'Account'}
                  </span>
                  {account.username && (
                    <span className="block text-xs text-muted-foreground truncate">@{account.username}</span>
                  )}
                </span>
              </button>
              {account.id === user?.id ? (
                <Check className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <button
                  aria-label="Remove saved account"
                  onClick={() => removeAccount(account.id)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="p-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
          <Button
            variant="outline"
            className="w-full rounded-xl h-11"
            onClick={async () => {
              onOpenChange(false);
              await signOut();
              navigate('/signin');
            }}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Add another account
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
