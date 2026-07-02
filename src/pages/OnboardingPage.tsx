import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Loader2, Check, X, Camera, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usernameSchema, displayNameSchema } from '@/lib/validationSchemas';

type Step = 'username' | 'displayName' | 'avatar';

const OnboardingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('username');

  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prefill from existing profile row (if any) so returning users continue where they left off.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, is_profile_complete')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.is_profile_complete) {
        navigate('/feed', { replace: true });
        return;
      }
      if (data?.username && !data.username.startsWith('user_')) setUsername(data.username);
      if (data?.display_name && data.display_name !== 'User') setDisplayName(data.display_name);
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    })();
  }, [user?.id, navigate]);

  // Debounced username availability check.
  useEffect(() => {
    if (!username) {
      setUsernameStatus('idle');
      setUsernameError(null);
      return;
    }
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) {
      setUsernameStatus('invalid');
      setUsernameError(parsed.error.issues[0].message);
      return;
    }
    setUsernameError(null);
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim().toLowerCase())
        .neq('id', user?.id || '')
        .maybeSingle();
      setUsernameStatus(data ? 'taken' : 'available');
    }, 400);
    return () => clearTimeout(t);
  }, [username, user?.id]);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB.', variant: 'destructive' });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(publicUrl);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message || 'Try again.', variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleFinish = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: username.trim().toLowerCase(),
          display_name: displayName.trim(),
          avatar_url: avatarUrl,
          is_profile_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Welcome to POST UP!', description: 'Your profile is ready.' });
      navigate('/feed', { replace: true });
    } catch (err: any) {
      toast({ title: 'Could not save profile', description: err.message || 'Try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const canAdvanceUsername = usernameStatus === 'available';
  const canAdvanceDisplayName = (() => {
    const parsed = displayNameSchema.safeParse(displayName);
    return parsed.success;
  })();

  const stepIndex = step === 'username' ? 1 : step === 'displayName' ? 2 : 3;

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4 safe-y">
      <Card className="w-full max-w-md p-6 md:p-8 space-y-6 shadow-xl">
        {/* Progress */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= stepIndex ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>
        <div className="text-xs text-muted-foreground text-center">Step {stepIndex} of 3</div>

        {step === 'username' && (
          <div className="space-y-4">
            <div className="space-y-1 text-center">
              <h1 className="text-2xl font-bold">Pick a username</h1>
              <p className="text-sm text-muted-foreground">This is how people will find you.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                  className="pl-8 pr-10 h-11"
                  placeholder="yourname"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {usernameStatus === 'available' && <Check className="h-4 w-4 text-success" />}
                  {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <X className="h-4 w-4 text-destructive" />}
                </div>
              </div>
              {usernameStatus === 'taken' && <p className="text-xs text-destructive">That username is already taken.</p>}
              {usernameStatus === 'available' && <p className="text-xs text-success">Nice, that one's available.</p>}
              {usernameError && <p className="text-xs text-destructive">{usernameError}</p>}
            </div>
            <Button
              className="w-full h-11"
              disabled={!canAdvanceUsername}
              onClick={() => setStep('displayName')}
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 'displayName' && (
          <div className="space-y-4">
            <div className="space-y-1 text-center">
              <h1 className="text-2xl font-bold">What's your name?</h1>
              <p className="text-sm text-muted-foreground">Your display name shows on your posts and profile.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setDisplayNameError(null);
                }}
                className="h-11"
                placeholder="Your name"
                autoFocus
                maxLength={100}
              />
              {displayNameError && <p className="text-xs text-destructive">{displayNameError}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11" onClick={() => setStep('username')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                className="flex-1 h-11"
                disabled={!canAdvanceDisplayName}
                onClick={() => setStep('avatar')}
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'avatar' && (
          <div className="space-y-4">
            <div className="space-y-1 text-center">
              <h1 className="text-2xl font-bold">Add a profile picture</h1>
              <p className="text-sm text-muted-foreground">You can always change this later.</p>
            </div>
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative group"
                disabled={uploadingAvatar}
              >
                <Avatar className="h-28 w-28 ring-2 ring-primary/20">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="text-3xl bg-primary/10">
                    {displayName.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md group-hover:scale-110 transition">
                  {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUrl ? 'Change photo' : 'Upload photo'}
              </button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-11" onClick={() => setStep('displayName')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                className="flex-1 h-11"
                disabled={submitting}
                onClick={handleFinish}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finish"}
              </Button>
            </div>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:text-foreground pt-1"
              onClick={handleFinish}
              disabled={submitting}
            >
              Skip for now
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default OnboardingPage;