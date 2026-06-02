import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, MapPin, AtSign, Hash, Clock, BarChart3, HelpCircle, SlidersHorizontal } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface Sticker {
  id: string;
  type: 'emoji' | 'poll' | 'question' | 'quiz' | 'countdown' | 'slider' | 'location' | 'mention' | 'hashtag';
  x: number;
  y: number;
  data: any;
}

interface StoryStickerPickerProps {
  onSelect: (sticker: Omit<Sticker, 'id' | 'x' | 'y'>) => void;
  onClose: () => void;
}

const emojis = [
  '😀', '😂', '😍', '🥰', '😎', '🤩', '🥳', '😊',
  '🔥', '❤️', '💕', '✨', '⭐', '🌟', '💯', '👏',
  '🙌', '💪', '🎉', '🎊', '🎁', '🎈', '🎀', '🎶',
  '☀️', '🌈', '🌸', '🌺', '🌻', '🍕', '🍔', '🍟',
];

export const StoryStickerPicker = ({ onSelect, onClose }: StoryStickerPickerProps) => {
  const [activeTab, setActiveTab] = useState<'emoji' | 'interactive'>('emoji');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOption1, setPollOption1] = useState('');
  const [pollOption2, setPollOption2] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [countdownTitle, setCountdownTitle] = useState('');
  const [countdownDate, setCountdownDate] = useState('');
  const [locationText, setLocationText] = useState('');
  const [mentionText, setMentionText] = useState('');
  const [hashtagText, setHashtagText] = useState('');

  const handleAddPoll = () => {
    if (pollQuestion && pollOption1 && pollOption2) {
      onSelect({
        type: 'poll',
        data: { question: pollQuestion, options: [pollOption1, pollOption2] }
      });
    }
  };

  const handleAddQuestion = () => {
    if (questionText) {
      onSelect({
        type: 'question',
        data: { question: questionText }
      });
    }
  };

  const handleAddCountdown = () => {
    if (countdownTitle && countdownDate) {
      onSelect({
        type: 'countdown',
        data: { title: countdownTitle, endDate: countdownDate }
      });
    }
  };

  const handleAddLocation = () => {
    if (locationText) {
      onSelect({
        type: 'location',
        data: { location: locationText }
      });
    }
  };

  const handleAddCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      onSelect({ type: 'location', data: { location: '📍 Current Location' } });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => onSelect({ type: 'location', data: { location: '📍 Current Location' } }),
      () => onSelect({ type: 'location', data: { location: '📍 Current Location' } }),
      { timeout: 4000 }
    );
  };

  const handleAddLiveTimestamp = () => {
    const now = new Date();
    const label = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    onSelect({ type: 'mention', data: { username: label } });
  };

  const handleAddMention = () => {
    if (mentionText) {
      onSelect({
        type: 'mention',
        data: { username: mentionText }
      });
    }
  };

  const handleAddHashtag = () => {
    if (hashtagText) {
      onSelect({
        type: 'hashtag',
        data: { tag: hashtagText }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-6 w-6 text-white" />
        </Button>
        <span className="text-white font-semibold text-lg">Stickers</span>
        <div className="w-10" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('emoji')}
          className={`flex-1 py-3 text-center font-medium ${
            activeTab === 'emoji' ? 'text-white border-b-2 border-white' : 'text-white/50'
          }`}
        >
          Emoji
        </button>
        <button
          onClick={() => setActiveTab('interactive')}
          className={`flex-1 py-3 text-center font-medium ${
            activeTab === 'interactive' ? 'text-white border-b-2 border-white' : 'text-white/50'
          }`}
        >
          Interactive
        </button>
      </div>

      <ScrollArea className="flex-1">
        {activeTab === 'emoji' ? (
          <div className="p-4 space-y-4">
            {/* Quick utility chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={handleAddCurrentLocation}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition"
              >
                <MapPin className="h-4 w-4" />
                Current Location
              </button>
              <button
                onClick={handleAddLiveTimestamp}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition"
              >
                <Clock className="h-4 w-4" />
                Live Time
              </button>
            </div>
            <div className="grid grid-cols-8 gap-2">
              {emojis.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => onSelect({ type: 'emoji', data: { emoji } })}
                  className="text-3xl p-2 hover:bg-white/10 rounded-lg transition"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Poll */}
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <BarChart3 className="h-5 w-5" />
                <span className="font-medium">Poll</span>
              </div>
              <Input
                placeholder="Ask a question..."
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="bg-white/10 border-white/20 text-white"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Option 1"
                  value={pollOption1}
                  onChange={(e) => setPollOption1(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                />
                <Input
                  placeholder="Option 2"
                  value={pollOption2}
                  onChange={(e) => setPollOption2(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <Button onClick={handleAddPoll} className="w-full">Add Poll</Button>
            </div>

            {/* Question */}
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <HelpCircle className="h-5 w-5" />
                <span className="font-medium">Question</span>
              </div>
              <Input
                placeholder="Ask me anything..."
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                className="bg-white/10 border-white/20 text-white"
              />
              <Button onClick={handleAddQuestion} className="w-full">Add Question</Button>
            </div>

            {/* Countdown */}
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Clock className="h-5 w-5" />
                <span className="font-medium">Countdown</span>
              </div>
              <Input
                placeholder="Event name..."
                value={countdownTitle}
                onChange={(e) => setCountdownTitle(e.target.value)}
                className="bg-white/10 border-white/20 text-white"
              />
              <Input
                type="datetime-local"
                value={countdownDate}
                onChange={(e) => setCountdownDate(e.target.value)}
                className="bg-white/10 border-white/20 text-white"
              />
              <Button onClick={handleAddCountdown} className="w-full">Add Countdown</Button>
            </div>

            {/* Location */}
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <MapPin className="h-5 w-5" />
                <span className="font-medium">Location</span>
              </div>
              <Input
                placeholder="Add location..."
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                className="bg-white/10 border-white/20 text-white"
              />
              <Button onClick={handleAddLocation} className="w-full">Add Location</Button>
            </div>

            {/* Mention */}
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <AtSign className="h-5 w-5" />
                <span className="font-medium">Mention</span>
              </div>
              <Input
                placeholder="@username"
                value={mentionText}
                onChange={(e) => setMentionText(e.target.value)}
                className="bg-white/10 border-white/20 text-white"
              />
              <Button onClick={handleAddMention} className="w-full">Add Mention</Button>
            </div>

            {/* Hashtag */}
            <div className="bg-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Hash className="h-5 w-5" />
                <span className="font-medium">Hashtag</span>
              </div>
              <Input
                placeholder="#trending"
                value={hashtagText}
                onChange={(e) => setHashtagText(e.target.value)}
                className="bg-white/10 border-white/20 text-white"
              />
              <Button onClick={handleAddHashtag} className="w-full">Add Hashtag</Button>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

interface StickerDisplayProps {
  sticker: Sticker;
  onDelete: (id: string) => void;
}

export const StickerDisplay = ({ sticker, onDelete }: StickerDisplayProps) => {
  const renderSticker = () => {
    switch (sticker.type) {
      case 'emoji':
        return <span className="text-5xl">{sticker.data.emoji}</span>;
      
      case 'poll':
        return (
          <div className="bg-white/90 rounded-xl p-3 min-w-[200px]">
            <p className="font-semibold text-black text-center mb-2">{sticker.data.question}</p>
            <div className="space-y-2">
              {sticker.data.options.map((opt: string, i: number) => (
                <div key={i} className="bg-gray-100 rounded-lg py-2 px-3 text-center text-black font-medium">
                  {opt}
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'question':
        return (
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-3 min-w-[200px]">
            <p className="text-white text-center font-medium">{sticker.data.question}</p>
            <div className="mt-2 bg-white rounded-lg py-2 px-3 text-center text-gray-400">
              Tap to respond
            </div>
          </div>
        );
      
      case 'countdown':
        return (
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-3 text-center">
            <p className="text-white font-semibold">{sticker.data.title}</p>
            <div className="flex gap-2 justify-center mt-2">
              <div className="bg-white/20 rounded px-2 py-1 text-white text-sm">00d</div>
              <div className="bg-white/20 rounded px-2 py-1 text-white text-sm">00h</div>
              <div className="bg-white/20 rounded px-2 py-1 text-white text-sm">00m</div>
            </div>
          </div>
        );
      
      case 'location':
        return (
          <div className="bg-white/90 rounded-full py-2 px-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-red-500" />
            <span className="text-black font-medium">{sticker.data.location}</span>
          </div>
        );
      
      case 'mention':
        return (
          <div className="bg-white/20 backdrop-blur rounded-lg py-2 px-3">
            <span className="text-white font-semibold">@{sticker.data.username}</span>
          </div>
        );
      
      case 'hashtag':
        return (
          <div className="bg-white/20 backdrop-blur rounded-lg py-2 px-3">
            <span className="text-white font-semibold">#{sticker.data.tag}</span>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div
      className="absolute cursor-move group"
      style={{
        left: `${sticker.x}%`,
        top: `${sticker.y}%`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      {renderSticker()}
      <button
        onClick={() => onDelete(sticker.id)}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
