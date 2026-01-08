
export type HairStyle = 'Long Blonde Box Braids' | 'Long Curly Natural Hair' | 'Two Pigtail Buns' | 'Single High Bun' | 'Long Straight Brown Hair' | 'Bonnet';
export type OutfitCategory = 'Professional' | 'Casual' | 'Athletic' | 'Cozy' | 'Trendy' | 'Pyjamas';
export type Expression = 'Happy' | 'Stressed' | 'Confident' | 'Thoughtful' | 'Sassy' | 'Determined' | 'Confused' | 'Thinking' | 'Excited' | 'Neutral';
export type Pose = 'Standing' | 'Sitting' | 'Working' | 'Relaxed' | 'Gesturing' | 'Talking on Phone';
export type Scene = 'Living Room' | 'Bedroom' | 'Office' | 'The Street' | 'Meeting Room' | 'On a Bus' | 'Kitchen Table' | 'In a Park' | 'Watching TV' | 'Transparent Background';
export type GlassesOption = 'None' | 'Black Rectangular' | 'Red Rectangular' | 'Navy Blue Rectangular' | 'Sunglasses';
export type StickerFormat = 'Die-Cut Square' | 'Die-Cut Landscape' | 'Die-Cut Vertical' | 'Circular Vignette' | 'Classic Rectangle';

export interface GenerationSettings {
  prompt: string;
  hair: HairStyle;
  outfit: string;
  outfitCategory: OutfitCategory;
  expression: Expression;
  pose: Pose;
  scene: Scene;
  glasses: GlassesOption;
  format: StickerFormat;
  includeCompanion: boolean;
}

export interface TextOverlay {
  mainText: string;
  subText: string;
  font: 'Anton' | 'Montserrat' | 'Bebas Neue' | 'Inter';
  colorMain: string;
  colorSub: string;
  colorOutline: string;
  sizeMain: number;
  sizeSub: number;
  tracking: number;
  leading: number;
  hasOutline: boolean;
  hasShadow: boolean;
  position: 'Top' | 'Bottom' | 'Integrated';
  backgroundStyle: 'speech-bubble' | 'offset-border' | 'none';
  offsetWidth: number;
}

export interface Sticker {
  id: string;
  timestamp: number;
  imageUrl: string; 
  finalUrl: string; 
  settings: GenerationSettings;
  textOverlay: TextOverlay;
  isFavorite: boolean;
}
