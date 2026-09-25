import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Camera, Save, X, ImagePlus, User, Shield, MapPin, Loader2, 
  Check, AlertCircle, Link2, Instagram, Twitter, Trash2, Eye
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { CropPreviewDialog } from '@/components/profile/CropPreviewDialog';

interface ProfileEditProps {
  onClose: () => void;
}

const BIO_MAX_LENGTH = 500;
const BIO_WARNING_THRESHOLD = 450;

const ProfileEdit = ({ onClose }: ProfileEditProps) => {
  const { user } = useAuth();
  const { profile, updateProfile, uploadAvatar, uploadCover, loading: profileLoading } = useProfile();
  
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasInitialized, setHasInitialized] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const [coverDragOver, setCoverDragOver] = useState(false);
  const [pendingCrop, setPendingCrop] = useState<{ file: File; shape: 'circle' | 'rect' } | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const originalFormData = useRef<typeof formData | null>(null);

  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    bio: '',
    location: '',
    website: '',
    relationship_status: '',
    birth_date: '',
    gender: '',
    phone: '',
    is_private: false,
    instagram_url: '',
    twitter_url: '',
    tiktok_url: ''
  });

  // Pre-fill form data when profile loads
  useEffect(() => {
    if (profile && !hasInitialized) {
      const initialData = {
        display_name: profile.display_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        location: profile.location || '',
        website: profile.website || '',
        relationship_status: profile.relationship_status || '',
        birth_date: profile.birth_date || '',
        gender: profile.gender || '',
        phone: profile.phone || '',
        is_private: profile.is_private || false,
        instagram_url: '',
        twitter_url: '',
        tiktok_url: ''
      };
      setFormData(initialData);
      originalFormData.current = initialData;
      setHasInitialized(true);
    }
  }, [profile, hasInitialized]);

  // Track changes
  useEffect(() => {
    if (originalFormData.current) {
      const changed = JSON.stringify(formData) !== JSON.stringify(originalFormData.current);
      setHasChanges(changed);
    }
  }, [formData]);

  // Calculate profile completion percentage
  const calculateProfileCompletion = () => {
    const fields = [
      formData.display_name,
      formData.username,
      formData.bio,
      profile?.avatar_url,
      formData.location,
      formData.birth_date,
      formData.gender
    ];
    const filled = fields.filter(f => f && String(f).trim()).length;
    return Math.round((filled / fields.length) * 100);
  };

  const profileCompletion = calculateProfileCompletion();

  // Debounced username check
  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!username || username === profile?.username) {
      setUsernameAvailable(null);
      return;
    }
    
    setUsernameChecking(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', user?.id || '')
        .maybeSingle();
      
      setUsernameAvailable(!data);
    } catch {
      setUsernameAvailable(null);
    } finally {
      setUsernameChecking(false);
    }
  }, [profile?.username, user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.username && formData.username.length >= 3) {
        checkUsernameAvailability(formData.username);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.username, checkUsernameAvailability]);

  const handleAvatarUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image must be less than 5MB', variant: 'destructive' });
      return;
    }

    if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/)) {
      toast({ title: 'Please use JPG, PNG, WebP, or GIF', variant: 'destructive' });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      toast({ title: 'Profile picture updated!' });
    } catch (error) {
      toast({ title: 'Failed to upload image', variant: 'destructive' });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setPendingCrop({ file, shape: 'circle' });
    event.target.value = '';
  };

  const handleAvatarDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setAvatarDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setPendingCrop({ file, shape: 'circle' });
  };

  const handleCoverUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Cover must be less than 10MB', variant: 'destructive' });
      return;
    }

    setIsUploadingCover(true);
    try {
      await uploadCover(file);
      toast({ title: 'Cover photo updated!' });
    } catch (error) {
      toast({ title: 'Failed to upload cover', variant: 'destructive' });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleCoverInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setPendingCrop({ file, shape: 'rect' });
    event.target.value = '';
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCoverDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setPendingCrop({ file, shape: 'rect' });
  };

  const handleCropConfirm = (file: File) => {
    const shape = pendingCrop?.shape;
    setPendingCrop(null);
    if (shape === 'circle') {
      void handleAvatarUpload(file);
    } else if (shape === 'rect') {
      void handleCoverUpload(file);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.display_name.trim()) {
      newErrors.display_name = 'Display name is required';
    } else if (formData.display_name.length > 50) {
      newErrors.display_name = 'Display name must be less than 50 characters';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.length > 20) {
      newErrors.username = 'Username must be less than 20 characters';
    } else if (!/^[a-z0-9_.]+$/.test(formData.username)) {
      newErrors.username = 'Only lowercase letters, numbers, underscores, and dots allowed';
    } else if (usernameAvailable === false) {
      newErrors.username = 'Username is already taken';
    }

    if (formData.website && !formData.website.match(/^https?:\/\/.+/)) {
      newErrors.website = 'Website must start with http:// or https://';
    }

    if (formData.bio && formData.bio.length > BIO_MAX_LENGTH) {
      newErrors.bio = `Bio must be less than ${BIO_MAX_LENGTH} characters`;
    }

    if (formData.birth_date) {
      const birthDate = new Date(formData.birth_date);
      const today = new Date();
      if (birthDate > today) {
        newErrors.birth_date = 'Birth date cannot be in the future';
      }
      const age = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 13) {
        newErrors.birth_date = 'You must be at least 13 years old';
      }
      if (age > 120) {
        newErrors.birth_date = 'Please enter a valid birth date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: 'Please fix the errors',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const success = await updateProfile(formData);
    setIsSaving(false);
    
    if (success) {
      originalFormData.current = { ...formData };
      setHasChanges(false);
      onClose();
    }
    // Error toast is shown by updateProfile, so we don't need to handle it here
  };

  const bioLength = formData.bio.length;
  const bioWarning = bioLength >= BIO_WARNING_THRESHOLD;

  // Show loading state while profile is loading
  if (profileLoading && !profile) {
    return (
      <Dialog open={true} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-lg">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={() => {
      if (hasChanges) {
        if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
          onClose();
        }
      } else {
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Cover Photo Section with Drag & Drop */}
        <div 
          className={cn(
            "relative h-40 bg-gradient-to-r from-primary/30 via-primary/20 to-accent/30 overflow-hidden transition-all",
            coverDragOver && "ring-4 ring-primary ring-inset"
          )}
          onDragOver={(e) => { e.preventDefault(); setCoverDragOver(true); }}
          onDragLeave={() => setCoverDragOver(false)}
          onDrop={handleCoverDrop}
        >
          {profile?.cover_url ? (
            <img 
              src={profile.cover_url} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ImagePlus className="h-8 w-8 mx-auto mb-2" />
                <p className="text-xs">Drag image or click to upload</p>
              </div>
            </div>
          )}
          <div 
            onClick={() => coverInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
          >
            {isUploadingCover ? (
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin text-white mx-auto mb-2" />
                <span className="text-white text-sm">Uploading...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full">
                <ImagePlus className="h-4 w-4" />
                Change Cover (16:9)
              </div>
            )}
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleCoverInputChange}
            disabled={isUploadingCover}
          />
          
          {/* Close button */}
          <button 
            onClick={() => {
              if (hasChanges) {
                if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                  onClose();
                }
              } else {
                onClose();
              }
            }}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Avatar Section with Drag & Drop */}
        <div className="relative px-6 -mt-16">
          <div 
            className={cn(
              "relative inline-block",
              avatarDragOver && "ring-4 ring-primary rounded-full"
            )}
            onDragOver={(e) => { e.preventDefault(); setAvatarDragOver(true); }}
            onDragLeave={() => setAvatarDragOver(false)}
            onDrop={handleAvatarDrop}
          >
            <Avatar className="h-32 w-32 border-4 border-background shadow-xl cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="text-4xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
                {formData.display_name?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            {/* Upload overlay */}
            <div 
              onClick={() => avatarInputRef.current?.click()}
              className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            >
              {isUploadingAvatar ? (
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              ) : (
                <Camera className="h-8 w-8 text-white" />
              )}
            </div>
            
            {/* Camera badge */}
            <button 
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-1 right-1 p-2.5 rounded-full bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors shadow-lg"
              disabled={isUploadingAvatar}
            >
              {isUploadingAvatar ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarInputChange}
              disabled={isUploadingAvatar}
            />
          </div>
          
          {/* Profile completion indicator */}
          <div className="absolute left-48 bottom-2 right-6">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-lg">{profile?.display_name || 'Your Name'}</p>
              <span className="text-xs text-muted-foreground">{profileCompletion}% complete</span>
            </div>
            <Progress value={profileCompletion} className="h-1.5" />
            <p className="text-muted-foreground text-sm mt-1">@{profile?.username || 'username'}</p>
          </div>
        </div>

        {/* Form Content */}
        <div className="px-6 pb-6 pt-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              Edit Profile
              {hasChanges && (
                <span className="text-xs font-normal text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  Unsaved changes
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Tabbed Form */}
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 h-12">
              <TabsTrigger value="basic" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Basic Info</span>
                <span className="sm:hidden">Basic</span>
              </TabsTrigger>
              <TabsTrigger value="contact" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Link2 className="h-4 w-4" />
                <span className="hidden sm:inline">Links</span>
                <span className="sm:hidden">Links</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Privacy</span>
                <span className="sm:hidden">Privacy</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-5 mt-0">
              {/* Display Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display_name" className="text-sm font-medium">
                    Display Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    placeholder="Your name"
                    className={cn(
                      "h-11 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary px-0",
                      errors.display_name && 'border-destructive'
                    )}
                  />
                  {errors.display_name && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.display_name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium">
                    Username <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '')
                      })}
                      placeholder="username"
                      className={cn(
                        "h-11 pl-5 pr-8 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary",
                        errors.username ? 'border-destructive' : usernameAvailable === true && 'border-green-500'
                      )}
                      maxLength={20}
                    />
                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                      {usernameChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {!usernameChecking && usernameAvailable === true && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      {!usernameChecking && usernameAvailable === false && (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </div>
                  {errors.username ? (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.username}
                    </p>
                  ) : usernameAvailable === true ? (
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Username is available
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
                  <span className={cn(
                    "text-xs transition-colors",
                    bioLength >= BIO_MAX_LENGTH - 10 ? 'text-destructive font-medium' :
                    bioWarning ? 'text-amber-500' : 'text-muted-foreground'
                  )}>
                    {bioLength}/{BIO_MAX_LENGTH}
                  </span>
                </div>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value.slice(0, BIO_MAX_LENGTH) })}
                  placeholder="Tell us about yourself... Use line breaks to format your bio ✨"
                  rows={4}
                  className={cn(
                    "resize-none max-h-[40vh] overflow-y-auto border-2 focus-visible:ring-0 focus-visible:border-primary",
                    errors.bio && 'border-destructive',
                    bioLength >= BIO_MAX_LENGTH - 10 && !errors.bio && 'border-destructive/60',
                    bioWarning && bioLength < BIO_MAX_LENGTH - 10 && !errors.bio && 'border-amber-500/50'
                  )}
                />
                {errors.bio && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.bio}
                  </p>
                )}
              </div>

              {/* Birth Date & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="birth_date" className="text-sm font-medium">Birth Date (Private)</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    className={cn(
                      "h-11",
                      errors.birth_date && 'border-destructive'
                    )}
                  />
                  {errors.birth_date && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.birth_date}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Only you can see your birth date</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Gender (Private)</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger className="h-11 bg-background">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Only you can see your gender</p>
                </div>
              </div>

              {/* Location & Relationship */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location" className="text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5 inline mr-1" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="City, Country"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Relationship Status</Label>
                  <Select
                    value={formData.relationship_status}
                    onValueChange={(value) => setFormData({ ...formData, relationship_status: value })}
                  >
                    <SelectTrigger className="h-11 bg-background">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="not_specified">Not specified</SelectItem>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="in_relationship">In a relationship</SelectItem>
                      <SelectItem value="engaged">Engaged</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="complicated">It's complicated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-5 mt-0">
              {/* Website */}
              <div className="space-y-2">
                <Label htmlFor="website" className="text-sm font-medium">
                  <Link2 className="h-3.5 w-3.5 inline mr-1" />
                  Website
                </Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://yourwebsite.com"
                  className={cn("h-11", errors.website && 'border-destructive')}
                />
                {errors.website && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.website}
                  </p>
                )}
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Social Media Links</Label>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                      <Instagram className="h-4 w-4 text-white" />
                    </div>
                    <Input
                      value={formData.instagram_url}
                      onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                      placeholder="instagram.com/username"
                      className="h-10 flex-1"
                    />
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-black">
                      <Twitter className="h-4 w-4 text-white" />
                    </div>
                    <Input
                      value={formData.twitter_url}
                      onChange={(e) => setFormData({ ...formData, twitter_url: e.target.value })}
                      placeholder="x.com/username"
                      className="h-10 flex-1"
                    />
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400 via-pink-500 to-red-500">
                      <span className="text-white font-bold text-xs">TT</span>
                    </div>
                    <Input
                      value={formData.tiktok_url}
                      onChange={(e) => setFormData({ ...formData, tiktok_url: e.target.value })}
                      placeholder="tiktok.com/@username"
                      className="h-10 flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">Phone (Private)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 234 567 890"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Your phone number is only visible to you</p>
              </div>
            </TabsContent>

            <TabsContent value="privacy" className="space-y-5 mt-0">
              {/* Private Account Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
                <div className="space-y-1">
                  <Label htmlFor="is_private" className="text-sm font-semibold cursor-pointer flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Private Account
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only approved followers can see your posts
                  </p>
                </div>
                <Switch
                  id="is_private"
                  checked={formData.is_private}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_private: checked })}
                />
              </div>

              {/* Preview how profile looks */}
              <div className="p-4 rounded-xl border bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Profile Preview</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {formData.display_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{formData.display_name || 'Your Name'}</p>
                    <p className="text-sm text-muted-foreground truncate">@{formData.username || 'username'}</p>
                    {formData.bio && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{formData.bio}</p>
                    )}
                  </div>
                  {formData.is_private && (
                    <Shield className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
              </div>

              {/* Privacy Tips */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Privacy Tips
                </h4>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <Check className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                    <span>Private accounts require follower approval</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                    <span>Phone, birth date and gender are only visible to you</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                    <span>Your profile picture and username stay public so people can follow you</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                    <span>Posts are only visible to approved followers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                    <span>You can change this setting anytime</span>
                  </li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action Buttons - Fixed at bottom */}
          <div className="flex gap-3 pt-6 mt-6 border-t sticky bottom-0 bg-background">
            <Button 
              variant="outline" 
              onClick={() => {
                if (hasChanges) {
                  if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                    onClose();
                  }
                } else {
                  onClose();
                }
              }}
              disabled={isSaving}
              className="flex-1 h-12"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || isUploadingAvatar || isUploadingCover || !hasChanges}
              className={cn(
                "flex-1 h-12 transition-all",
                hasChanges && "bg-gradient-to-r from-primary to-accent hover:opacity-90"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
      <CropPreviewDialog
        file={pendingCrop?.file || null}
        shape={pendingCrop?.shape || 'circle'}
        onCancel={() => setPendingCrop(null)}
        onConfirm={handleCropConfirm}
      />
    </Dialog>
  );
};

export default ProfileEdit;