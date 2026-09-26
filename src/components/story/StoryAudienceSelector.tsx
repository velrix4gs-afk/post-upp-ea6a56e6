import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Check, Globe, Users, Lock } from 'lucide-react';

export type StoryAudience = 'public' | 'followers' | 'only-me';

interface StoryAudienceSelectorProps {
  selected: StoryAudience;
  onSelect: (audience: StoryAudience) => void;
  onClose: () => void;
}

const audienceOptions = [
  {
    id: 'public' as StoryAudience,
    icon: Globe,
    title: 'Everyone',
    description: 'Anyone can see your story'
  },
  {
    id: 'followers' as StoryAudience,
    icon: Users,
    title: 'Followers',
    description: 'Only people who follow you'
  },
  {
    id: 'only-me' as StoryAudience,
    icon: Lock,
    title: 'Only Me',
    description: 'Only you can see this story'
  }
];

export const StoryAudienceSelector = ({ selected, onSelect, onClose }: StoryAudienceSelectorProps) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-6 w-6 text-white" />
        </Button>
        <span className="text-white font-semibold text-lg">Share to</span>
        <div className="w-10" />
      </div>

      {/* Options */}
      <div className="flex-1 p-4 space-y-3">
        {audienceOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => {
              onSelect(option.id);
              onClose();
            }}
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition ${
              selected === option.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-white/5 text-white hover:bg-white/10'
            }`}
          >
            <div className={`p-3 rounded-full ${
              selected === option.id ? 'bg-white/20' : 'bg-white/10'
            }`}>
              <option.icon className="h-6 w-6" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold">{option.title}</p>
              <p className={`text-sm ${selected === option.id ? 'text-white/80' : 'text-white/50'}`}>
                {option.description}
              </p>
            </div>
            {selected === option.id && (
              <Check className="h-6 w-6" />
            )}
          </button>
        ))}
      </div>

      {/* Info */}
      <div className="p-4 border-t border-white/10">
        <p className="text-white/50 text-center text-sm">
          Stories disappear after 24 hours. Add to highlights to keep them on your profile.
        </p>
      </div>
    </div>
  );
};
