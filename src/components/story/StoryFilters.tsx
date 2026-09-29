import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface StoryFilter {
  id: string;
  name: string;
  css: string;
  preview: string;
}

export const storyFilters: StoryFilter[] = [
  { id: 'none', name: 'Original', css: 'none', preview: '' },
  { id: 'natural', name: 'Natural', css: 'contrast(1.04) saturate(1.1) brightness(1.01)', preview: '' },
  { id: 'warm', name: 'Warm', css: 'sepia(0.2) saturate(1.2) brightness(1.04)', preview: '' },
  { id: 'soft-warm', name: 'Soft Warm', css: 'sepia(0.16) saturate(0.92) contrast(0.94) brightness(1.07)', preview: '' },
  { id: 'golden', name: 'Golden', css: 'sepia(0.3) saturate(1.28) contrast(1.04) brightness(1.03)', preview: '' },
  { id: 'cool', name: 'Cool', css: 'hue-rotate(-8deg) saturate(0.9) contrast(1.05) brightness(1.01)', preview: '' },
  { id: 'blue-hour', name: 'Blue Hour', css: 'saturate(0.82) contrast(1.1) brightness(0.94) sepia(0.08)', preview: '' },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.48) contrast(1.1) brightness(1.02)', preview: '' },
  { id: 'punch', name: 'Punch', css: 'saturate(1.28) contrast(1.22)', preview: '' },
  { id: 'dream', name: 'Dream', css: 'saturate(0.88) contrast(0.9) brightness(1.1) sepia(0.06)', preview: '' },
  { id: 'faded', name: 'Faded', css: 'saturate(0.74) contrast(0.84) brightness(1.1)', preview: '' },
  { id: 'matte', name: 'Matte', css: 'sepia(0.08) saturate(0.84) contrast(0.88) brightness(1.05)', preview: '' },
  { id: 'rose', name: 'Rose', css: 'sepia(0.08) saturate(1.22) hue-rotate(330deg) brightness(1.02)', preview: '' },
  { id: 'mono', name: 'Mono', css: 'grayscale(1) contrast(1.12)', preview: '' },
  { id: 'silver', name: 'Silver', css: 'grayscale(1) contrast(0.92) brightness(1.1)', preview: '' },
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
