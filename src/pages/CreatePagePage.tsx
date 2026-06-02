import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Upload, Loader2, Send, Image as ImageIcon, AlertCircle,
  ArrowRight, ArrowLeft, Check, X,
  Building2, Users as UsersIcon, Sparkles, Briefcase, Tv, Globe2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { BackNavigation } from '@/components/BackNavigation';
import { logError } from '@/lib/errorLogger';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

type Step = 1 | 2 | 3;

const CATEGORIES = [
  { id: 'brand',        label: 'Brand',           icon: Building2 },
  { id: 'community',    label: 'Community',       icon: UsersIcon },
  { id: 'entertainment',label: 'Entertainment',   icon: Tv },
  { id: 'creator',      label: 'Digital Creator', icon: Sparkles },
  { id: 'business',     label: 'Business',        icon: Briefcase },
  { id: 'other',        label: 'Other',           icon: Globe2 },
];

const CreatePagePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('brand');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [bio, setBio] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const slugDebounceRef = useRef<number | undefined>(undefined);

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImage(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleProfileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileImage(file);
    setProfilePreview(URL.createObjectURL(file));
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    // Auto-generate slug (only if user hasn't customised it yet)
    setSlug((prev) => {
      const auto = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return prev ? prev : auto;
    });
  };

  // Live availability check, debounced
  useEffect(() => {
    if (!slug) {
      setSlugStatus('idle');
      return;
    }
    if (!/^[a-z0-9-]{3,50}$/.test(slug)) {
      setSlugStatus('invalid');
      return;
    }
    setSlugStatus('checking');
    if (slugDebounceRef.current) window.clearTimeout(slugDebounceRef.current);
    slugDebounceRef.current = window.setTimeout(async () => {
      const { data } = await supabase
        .from('creator_pages')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      setSlugStatus(data ? 'taken' : 'available');
    }, 400);
    return () => {
      if (slugDebounceRef.current) window.clearTimeout(slugDebounceRef.current);
    };
  }, [slug]);

  const canAdvance = (() => {
    if (step === 1) return title.trim().length > 0 && !!category;
    if (step === 2) return slugStatus === 'available';
    return true;
  })();

  const goNext = () => {
    if (!canAdvance) return;
    haptic('light');
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  };
  const goPrev = () => {
    haptic('light');
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  };

  const handleCreate = async () => {
    if (!user || !title.trim() || !slug.trim()) {
      toast({ title: 'Please fill in required fields' });
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast({ title: 'URL can only contain lowercase letters, numbers, and hyphens' });
      return;
    }

    setUploading(true);
    try {
      // Final slug availability check
      const { data: existing } = await supabase
        .from('creator_pages')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existing) {
        toast({ title: 'This URL is already taken' });
        setUploading(false);
        setStep(2);
        setSlugStatus('taken');
        return;
      }

      let coverUrl = null;
      let profileUrl = null;

      // Upload cover image
      if (coverImage) {
        const coverPath = `pages/${user.id}/cover-${Date.now()}.${coverImage.name.split('.').pop()}`;
        const { error: coverError } = await supabase.storage
          .from('media')
          .upload(coverPath, coverImage);
        
        if (!coverError) {
          const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(coverPath);
          coverUrl = publicUrl;
        }
      }

      // Upload profile image
      if (profileImage) {
        const profilePath = `pages/${user.id}/profile-${Date.now()}.${profileImage.name.split('.').pop()}`;
        const { error: profileError } = await supabase.storage
          .from('media')
          .upload(profilePath, profileImage);
        
        if (!profileError) {
          const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(profilePath);
          profileUrl = publicUrl;
        }
      }

      // Create page
      const { data: newPage, error } = await supabase
        .from('creator_pages')
        .insert({
          user_id: user.id,
          title,
          slug,
          bio,
          cover_url: coverUrl,
          profile_url: profileUrl,
          is_published: true,
          category,
        } as any)
        .select()
        .single();

      if (error) throw error;

      haptic('success');
      toast({ title: 'Page created! 🎉' });
      // Navigate to edit page
      navigate(`/page/${newPage.id}/edit`);
    } catch (error: any) {
      await logError({
        message: error.message,
        type: 'page_creation_error',
        context: { title, slug },
        userId: user?.id,
        componentName: 'CreatePagePage'
      });
      toast({ title: 'Unable to create page' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b">
        <div className="flex items-center justify-between p-4">
          <BackNavigation />
          <h1 className="text-base font-semibold">Create Page · Step {step} of 3</h1>
          <div className="w-10" />
        </div>
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pb-3">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={cn(
                'h-1.5 rounded-full transition-all',
                step === n ? 'w-8 bg-primary' : n < step ? 'w-6 bg-primary/60' : 'w-6 bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 pb-32 space-y-6">
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <Label htmlFor="title" className="text-base">Page Name *</Label>
              <Input
                id="title"
                placeholder="e.g., Sunset Studios"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                maxLength={50}
                className="mt-2 h-12 text-base"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">{title.length}/50</p>
            </div>

            <div>
              <Label className="text-base">Category *</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const selected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCategory(c.id); haptic('light'); }}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-xl border-2 transition tap-scale text-left',
                        selected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:border-primary/40'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', selected ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="font-medium">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <Label htmlFor="slug" className="text-base">Page Handle *</Label>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-muted-foreground">postup.com/page/</span>
                <div className="relative flex-1">
                  <Input
                    id="slug"
                    placeholder="sunset-studios"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    maxLength={50}
                    className="h-12 pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {slugStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {slugStatus === 'available' && <Check className="h-4 w-4 text-green-500" />}
                    {(slugStatus === 'taken' || slugStatus === 'invalid') && <X className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
              </div>
              <p
                className={cn(
                  'text-xs mt-2',
                  slugStatus === 'available' && 'text-green-500',
                  slugStatus === 'taken' && 'text-destructive',
                  slugStatus === 'invalid' && 'text-destructive',
                  (slugStatus === 'idle' || slugStatus === 'checking') && 'text-muted-foreground'
                )}
              >
                {slugStatus === 'available' && '✓ Handle is available'}
                {slugStatus === 'taken' && 'This handle is already taken'}
                {slugStatus === 'invalid' && '3–50 chars, lowercase letters, numbers, hyphens only'}
                {slugStatus === 'checking' && 'Checking availability…'}
                {slugStatus === 'idle' && 'Pick a unique handle (3–50 chars).'}
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <Card className="overflow-hidden">
              <div
                className="h-40 bg-muted flex items-center justify-center cursor-pointer relative"
                onClick={() => coverInputRef.current?.click()}
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Add cover banner</p>
                  </div>
                )}
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
            </Card>

            <div className="flex items-center gap-4">
              <div
                className="w-24 h-24 rounded-full bg-muted flex items-center justify-center cursor-pointer overflow-hidden ring-2 ring-background -mt-12 shadow-lg"
                onClick={() => profileInputRef.current?.click()}
              >
                {profilePreview ? (
                  <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">Profile Avatar</p>
                <p className="text-sm text-muted-foreground">Tap to upload</p>
              </div>
              <input ref={profileInputRef} type="file" accept="image/*" onChange={handleProfileSelect} className="hidden" />
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell people about your page..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={300}
                rows={4}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground text-right mt-1">{bio.length}/300</p>
            </div>

            <Card className="bg-primary/5 border-primary/20 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Almost there!</p>
                  <p>Cover and avatar are optional — you can add them later from your page settings.</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Sticky footer with prev/next */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-background/95 backdrop-blur-xl border-t p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {step > 1 ? (
            <Button variant="outline" onClick={goPrev} className="flex-1 h-12">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          ) : <div className="flex-1" />}

          {step < 3 ? (
            <Button onClick={goNext} disabled={!canAdvance} className="flex-1 h-12">
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={uploading} className="flex-1 h-12">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Create Page
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatePagePage;
