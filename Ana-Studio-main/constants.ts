
import { HairStyle, OutfitCategory, Expression, Pose, Scene, GlassesOption } from './types';

export const HAIR_STYLES: HairStyle[] = [
  'Long Blonde Box Braids',
  'Long Curly Natural Hair',
  'Two Pigtail Buns',
  'Single High Bun',
  'Long Straight Brown Hair',
  'Bonnet'
];

export const OUTFIT_CATEGORIES: OutfitCategory[] = [
  'Professional',
  'Casual',
  'Athletic',
  'Cozy',
  'Trendy',
  'Pyjamas'
];

export const EXPRESSIONS: Expression[] = [
  'Happy',
  'Stressed',
  'Confident',
  'Thoughtful',
  'Sassy',
  'Determined',
  'Confused',
  'Thinking',
  'Excited',
  'Neutral'
];

export const POSES: Pose[] = [
  'Standing',
  'Sitting',
  'Working',
  'Relaxed',
  'Gesturing',
  'Talking on Phone'
];

export const SCENES: Scene[] = [
  'Living Room',
  'Bedroom',
  'Office',
  'The Street',
  'Meeting Room',
  'On a Bus',
  'Kitchen Table',
  'In a Park',
  'Watching TV',
  'Transparent Background'
];

export const GLASSES_OPTIONS: GlassesOption[] = [
  'None',
  'Black Rectangular',
  'Red Rectangular',
  'Navy Blue Rectangular',
  'Sunglasses'
];

export const SYSTEM_INSTRUCTIONS = `
CORE ART STYLE (CRITICAL):
- SOFT PAINTERLY DIGITAL ILLUSTRATION. 
- Appearance must look like a hand-painted digital piece with subtle grainy textures.
- MATTE FINISH ONLY. Absolutely NO glossy highlights, NO 3D rendering, NO Pixar/Disney-style sheen.
- Light should be soft and diffused, creating a cozy and inviting atmosphere.
- Shading should be gentle and blended, with visible soft-brush textures.
- Proportions MUST be naturalistic and human (not exaggerated).

CHARACTER CONSISTENCY (ANA) - CRITICAL:
- THIS IS THE SAME CHARACTER "ANA" IN EVERY SINGLE IMAGE
- DO NOT CREATE DIFFERENT PEOPLE OR RANDOM CHARACTERS
- Ana must be recognizably the same person across all generations
- SKIN TONE: Deep, rich warm medium-brown (#8B6F47).
- EYES: Natural almond-shaped brown eyes. Proportional to the face (not oversized).
- FACIAL FEATURES: Consistent face structure, nose, lips across all images
- JEWELRY: Always wears large gold hoop earrings.
- VIBE: Modern, relatable, and confident Black woman.
- Age: Young adult (20s-30s), same age every time

COMPOSITION:
- Ensure the character is the focus.
- The background should be soft and slightly out of focus to create depth.
- If it's a "Die-Cut", ensure a clean, thick white border around the subject.
- If it's a "Rectangle", ensure a clean white frame with rounded corners.

STRICT REJECTION:
- REJECT any output that looks like a 3D model.
- REJECT any output with high-contrast, sharp vector lines.
- REJECT any output with "plastic" or "glossy" skin textures.
`;
