import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Save, Loader2, X, ImagePlus, User, MapPin, Shield } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';

interface ProfileEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BIO_MAX_LENGTH = 500;

export const ProfileEditModal = ({ open, onOpenChange }: ProfileEditModalProps) => {
  const { profile, updateProfile, uploadAvatar, uploadCover, loading: profileLoading } = useProfile();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [originalData, setOriginalData] = useState<any>(null);
  const [formData, setFormData] = useState({
    display_name: '',
    username: '',
    bio: '',
    location: '',
    website: '',
    phone: '',
    gender: '',
    birth_date: '',
    relationship_status: '',
    is_private: false
  });

  // Prefill form when profile loads or modal opens
  useEffect(() => {
    if (profile && open) {
      const data = {
        display_name: profile.display_name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        location: profile.location || '',
        website: profile.website || '',
        phone: profile.phone || '',
        gender: profile.gender || '',
        birth_date: profile.birth_date || '',
        relationship_status: profile.relationship_status || '',
        is_private: profile.is_private || false
      };
      setFormData(data);
      setOriginalData(data);
      setErrors({});
    }
  }, [profile, open]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image must be less than 5MB', variant: 'destructive' });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      toast({ title: 'Avatar updated!', duration: 1500 });
    } catch (error) {
      toast({ title: 'Upload failed', variant: 'destructive', duration: 1500 });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Cover must be less than 10MB', variant: 'destructive' });
      return;
    }

    setIsUploadingCover(true);
    try {
      await uploadCover(file);
      toast({ title: 'Cover photo updated!', duration: 1500 });
    } catch (error) {
      toast({ title: 'Upload failed', variant: 'destructive', duration: 1500 });
    } finally {
      setIsUploadingCover(false);
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
    } else if (!/^[a-z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Only lowercase letters, numbers, and underscores';
    }

    if (formData.website && !formData.website.match(/^https?:\/\/.+/)) {
      newErrors.website = 'Must start with http:// or https://';
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
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!originalData) return;

    if (!validateForm()) {
      toast({ title: 'Please fix the errors', variant: 'destructive' });
      return;
    }

    // Detect only changed fields
    const changes: any = {};
    Object.keys(formData).forEach((key) => {
      if (formData[key as keyof typeof formData] !== originalData[key]) {
        changes[key] = formData[key as keyof typeof formData];
      }
    });

    if (Object.keys(changes).length === 0) {
      toast({ title: 'No changes to save' });
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    const success = await updateProfile(changes);
    setIsSaving(false);
    
    if (success) {
      onOpenChange(false);
    }
    // Error toast is shown by updateProfile, so we don't need to handle it here
  };

  const bioLength = formData.bio.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Loading state */}
        {profileLoading && !profile ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Cover Photo Section */}
            <div className="relative h-36 bg-gradient-to-r from-primary/30 to-primary/10 overflow-hidden">
              {profile?.cover_url ? (
                <img 
                  src={profile.cover_url} 
                  alt="Cover" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <ImagePlus className="h-8 w-8" />
                </div>
              )}
              <label 
                htmlFor="cover-upload-modal" 
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
              >
                {isUploadingCover ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <div className="flex items-center gap-2 text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full">
                    <ImagePlus className="h-4 w-4" />
                    Change Cover
                  </div>
                )}
              </label>
              <input
                id="cover-upload-modal"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverUpload}
                disabled={isUploadingCover}
              />
              
              {/* Close button */}
              <button 
                onClick={() => onOpenChange(false)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Avatar - overlapping cover */}
            <div className="relative px-6 -mt-14">
              <div className="relative inline-block">
                <Avatar className="h-28 w-28 border-4 border-background shadow-xl">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                    {formData.display_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <label 
                  htmlFor="avatar-upload-modal"
                  className="absolute bottom-1 right-1 p-2 rounded-full bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors shadow-lg"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </label>
                <input
                  id="avatar-upload-modal"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={isUploadingAvatar}
                />
              </div>
              
              {/* Current user info */}
              <div className="absolute left-44 bottom-2">
                <p className="font-semibold text-lg">{profile?.display_name || 'Your Name'}</p>
                <p className="text-muted-foreground text-sm">@{profile?.username || 'username'}</p>
              </div>
            </div>

            {/* Form Content */}
            <div className="px-6 pb-6 pt-6">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-xl font-semibold">Edit Profile</DialogTitle>
              </DialogHeader>

              {/* Tabbed Form */}
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="basic" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">Basic Info</span>
                    <span className="sm:hidden">Basic</span>
                  </TabsTrigger>
                  <TabsTrigger value="contact" className="gap-2">
                    <MapPin className="h-4 w-4" />
                    <span className="hidden sm:inline">Contact</span>
                    <span className="sm:hidden">Contact</span>
                  </TabsTrigger>
                  <TabsTrigger value="privacy" className="gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">Privacy</span>
                    <span className="sm:hidden">Privacy</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-0">
                  {/* Display Name & Username */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="display_name_modal" className="text-sm font-medium">
                        Display Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="display_name_modal"
                        value={formData.display_name}
                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                        placeholder="Your name"
                        className={errors.display_name ? 'border-destructive' : ''}
                      />
                      {errors.display_name && (
                        <p className="text-xs text-destructive">{errors.display_name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username_modal" className="text-sm font-medium">
                        Username <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                        <Input
                          id="username_modal"
                          value={formData.username}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                          })}
                          placeholder="username"
                          className={`pl-8 ${errors.username ? 'border-destructive' : ''}`}
                          maxLength={20}
                        />
                      </div>
                      {errors.username && (
                        <p className="text-xs text-destructive">{errors.username}</p>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bio_modal" className="text-sm font-medium">Bio</Label>
                      <span className={`text-xs ${bioLength > BIO_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {bioLength}/{BIO_MAX_LENGTH}
                      </span>
                    </div>
                    <Textarea
                      id="bio_modal"
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value.slice(0, BIO_MAX_LENGTH) })}
                      placeholder="Tell us about yourself..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Birth Date & Gender */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="birth_date_modal" className="text-sm font-medium">Birth Date (Private)</Label>
                      <Input
                        id="birth_date_modal"
                        type="date"
                        value={formData.birth_date}
                        onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                        max={new Date().toISOString().split('T')[0]}
                        className={errors.birth_date ? 'border-destructive' : ''}
                      />
                      {errors.birth_date && (
                        <p className="text-xs text-destructive">{errors.birth_date}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Only you can see this</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Gender (Private)</Label>
                      <Select
                        value={formData.gender}
                        onValueChange={(value) => setFormData({ ...formData, gender: value })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border shadow-lg z-50">
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                          <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Relationship Status */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Relationship Status</Label>
                    <Select
                      value={formData.relationship_status}
                      onValueChange={(value) => setFormData({ ...formData, relationship_status: value })}
                    >
                      <SelectTrigger className="bg-background">
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
                </TabsContent>

                <TabsContent value="contact" className="space-y-4 mt-0">
                  {/* Location & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location_modal" className="text-sm font-medium">Location</Label>
                      <Input
                        id="location_modal"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="City, Country"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone_modal" className="text-sm font-medium">Phone (Private)</Label>
                      <Input
                        id="phone_modal"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <Label htmlFor="website_modal" className="text-sm font-medium">Website</Label>
                    <Input
                      id="website_modal"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://yourwebsite.com"
                      className={errors.website ? 'border-destructive' : ''}
                    />
                    {errors.website && (
                      <p className="text-xs text-destructive">{errors.website}</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="privacy" className="space-y-4 mt-0">
                  {/* Private Account Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                    <div className="space-y-1">
                      <Label htmlFor="is_private_modal" className="text-sm font-semibold cursor-pointer">
                        Private Account
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Only approved followers can see your posts
                      </p>
                    </div>
                    <Switch
                      id="is_private_modal"
                      checked={formData.is_private}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_private: checked })}
                    />
                  </div>

                  {/* Privacy Tips */}
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="font-semibold text-sm mb-2">Privacy Tips</h4>
                    <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                      <li>Private accounts require follower approval</li>
                      <li>Phone, birth date and gender are only visible to you</li>
                      <li>Your profile picture and username stay public so people can follow you</li>
                      <li>Posts are only visible to approved followers</li>
                      <li>You can change this setting anytime</li>
                    </ul>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 mt-6 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving || isUploadingAvatar || isUploadingCover}
                  className="flex-1"
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
