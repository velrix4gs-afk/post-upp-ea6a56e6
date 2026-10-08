import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface StoryFilter {
  id: string;
  name: string;
  css: string;
  preview: string;
}

export const storyFilters: StoryFilter[] = [
  { id: 'none', name: 'Original', css: 'none', preview: '' },
  { id: 'natural', name: 'Natural', css: 'contrast(1.1) saturate(1.25) brightness(1.03)', preview: '' },
  { id: 'warm', name: 'Warm', css: 'sepia(0.38) saturate(1.35) contrast(1.1) brightness(1.05)', preview: '' },
  { id: 'soft-warm', name: 'Soft Warm', css: 'sepia(0.28) saturate(0.9) contrast(0.86) brightness(1.14)', preview: '' },
  { id: 'golden', name: 'Golden', css: 'sepia(0.48) saturate(1.55) contrast(1.15) brightness(1.08)', preview: '' },
  { id: 'cool', name: 'Cool', css: 'hue-rotate(-14deg) saturate(0.78) contrast(1.16) brightness(1.04)', preview: '' },
  { id: 'blue-hour', name: 'Blue Hour', css: 'hue-rotate(18deg) saturate(0.8) contrast(1.2) brightness(0.88)', preview: '' },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.85) contrast(1.18) brightness(1.04)', preview: '' },
  { id: 'punch', name: 'Punch', css: 'saturate(1.55) contrast(1.4) brightness(0.98)', preview: '' },
  { id: 'dream', name: 'Dream', css: 'saturate(0.76) contrast(0.78) brightness(1.18) sepia(0.12)', preview: '' },
  { id: 'faded', name: 'Faded', css: 'saturate(0.58) contrast(0.7) brightness(1.18)', preview: '' },
  { id: 'matte', name: 'Matte', css: 'sepia(0.16) saturate(0.7) contrast(0.72) brightness(1.12)', preview: '' },
  { id: 'rose', name: 'Rose', css: 'sepia(0.16) saturate(1.5) hue-rotate(330deg) contrast(1.1) brightness(1.04)', preview: '' },
  { id: 'mono', name: 'Mono', css: 'grayscale(1) contrast(1.35)', preview: '' },
  { id: 'silver', name: 'Silver', css: 'grayscale(1) contrast(0.8) brightness(1.2)', preview: '' },
];

interface StoryFilterPickerProps {
  selectedFilter: string;
  onSelect: (filterId: string) => void;
  previewUrl: string | null;
}

export const StoryFilterPicker = ({ selectedFilter, onSelect, previewUrl }: StoryFilterPickerProps) => {
  return (
    <div className="py-3">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 px-4">
          {storyFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => onSelect(filter.id)}
              className={`flex flex-col items-center gap-1 flex-shrink-0 ${
                selectedFilter === filter.id ? 'opacity-100' : 'opacity-70'
              }`}
            >
              <div
                className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                  selectedFilter === filter.id ? 'border-white' : 'border-transparent'
                }`}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={filter.name}
                    className="w-full h-full object-cover"
                    style={{ filter: filter.css }}
                  />
                ) : (
                  <div
                    className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500"
                    style={{ filter: filter.css }}
                  />
                )}
              </div>
              <span className={`text-xs ${selectedFilter === filter.id ? 'text-white font-semibold' : 'text-white/70'}`}>
                {filter.name}
              </span>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
