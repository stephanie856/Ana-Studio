# Ana Reference Images

This folder contains the official reference images of Ana that are used for sticker generation.

## Important Notes

- **DO NOT REMOVE OR MODIFY** these images - they are the ONLY images that should be used for Ana's character design
- The AI model uses these reference images to maintain consistent character appearance
- These images show Ana with different hairstyles and in different settings
- All 6 images are loaded and sent to the AI model during sticker generation to ensure consistency

## Images

1. `ana-bonnet.png` - Ana wearing a bonnet
2. `ana-braids.png` - Ana with braids
3. `ana-curly.png` - Ana with curly hair
4. `ana-braids.png` - Ana with braids (alternate)
5. `braidsana.png` - Ana with braids (another variant)
6. `straighthair-ana.png` - Ana with straight hair

## Technical Details

These images are loaded by the `loadReferenceImages()` function in `geminiService.ts` and included with every generation request to ensure the AI model creates stickers that look like the real Ana, not a random interpretation.
