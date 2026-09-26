import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface StoryFilter {
  id: string;
  name: string;
  css: string;
  preview: string;
}

export const storyFilters: StoryFilter[] = [
  { id: 'none', name: 'Original', css: 'none', preview: '' },
  { id: 'natural', name: 'Natural', css: 'contrast(1.03) saturate(1.04) brightness(1.01)', preview: '' },
  { id: 'warm', name: 'Warm', css: 'sepia(0.12) saturate(1.12) brightness(1.03)', preview: '' },
  { id: 'soft-warm', name: 'Soft Warm', css: 'sepia(0.18) saturate(0.88) contrast(0.94) brightness(1.06)', preview: '' },
  { id: 'cool', name: 'Cool', css: 'hue-rotate(8deg) saturate(0.92) brightness(1.02)', preview: '' },
  { id: 'blue-hour', name: 'Blue Hour', css: 'hue-rotate(16deg) saturate(0.86) contrast(1.08) brightness(0.98)', preview: '' },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.38) contrast(1.08) brightness(1.02)', preview: '' },
  { id: 'punch', name: 'Punch', css: 'saturate(1.22) contrast(1.18)', preview: '' },
  { id: 'faded', name: 'Faded', css: 'saturate(0.78) contrast(0.84) brightness(1.08)', preview: '' },
  { id: 'matte', name: 'Matte', css: 'sepia(0.08) saturate(0.82) contrast(0.9) brightness(1.04)', preview: '' },
  { id: 'mono', name: 'Mono', css: 'grayscale(1) contrast(1.08)', preview: '' },
  { id: 'silver', name: 'Silver', css: 'grayscale(1) contrast(0.92) brightness(1.08)', preview: '' },
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
