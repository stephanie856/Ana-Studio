
import { GoogleGenAI } from "@google/genai";
import { GenerationSettings, TextOverlay } from "./types";
import { SYSTEM_INSTRUCTIONS } from "./constants";

const GOOGLE_AI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export const generateAnaSticker = async (settings: GenerationSettings, textOverlay?: TextOverlay): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });
  
  const textInstructions = textOverlay ? `
    ╔════════════════════════════════════════════════════════════════════╗
    ║ *** TEXT RENDERING WITH BACKGROUND STYLE ***                      ║
    ║ Background Style: ${textOverlay.backgroundStyle.toUpperCase()}     ║
    ╚════════════════════════════════════════════════════════════════════╝
    
    TEXT STYLING SPECIFICATIONS:
    - Main Text: "${textOverlay.mainText}" (bold, ${textOverlay.font} font, prominently sized)
    - Sub Text: "${textOverlay.subText}" (below main text, smaller than main text)
    - Text Color: Main text in ${textOverlay.colorMain}, sub text in ${textOverlay.colorSub}
    
    TEXT BACKGROUND STYLE: ${textOverlay.backgroundStyle}
    ${textOverlay.backgroundStyle === 'offset-border' ? `
    OFFSET BORDER STYLE (Cricut-style):
    - Create thick WHITE BORDER/STROKE around each letter (${textOverlay.offsetWidth}px offset)
    - Letters have colored fill with thick white stroke/outline
    - No background box - just the offset stroke effect
    - lineJoin = 'round' makes letter borders connect smoothly
    - Result looks like professional Cricut cut sticker with embossed white outline
    ` : textOverlay.backgroundStyle === 'speech-bubble' ? `
    SPEECH BUBBLE STYLE:
    - Rounded organic white background that follows text contours
    - NOT a perfect rectangle - has soft, rounded edges
    - Padding of 15-20px around all sides of text
    - Speech bubble or rounded banner aesthetic
    - Hand-drawn, friendly appearance
    ` : `
    NONE STYLE (Bold Outlined):
    - Standard text with thin outline only
    - No background shape or thick border
    - Clean, minimal appearance
    `}
    
    Final Result:
    - Colored letters (${textOverlay.colorMain}/${textOverlay.colorSub})
  ` : '';

  const constructedPrompt = `
    ╔══════════════════════════════════════════════════════════════════════╗
    ║ *** CHARACTER IDENTITY: ANA (MUST BE CONSISTENT) ***                ║
    ║ YOU MUST ONLY GENERATE "ANA" - THE SAME CHARACTER EVERY TIME       ║
    ║ DO NOT CREATE NEW CHARACTERS OR DIFFERENT PEOPLE                    ║
    ╚══════════════════════════════════════════════════════════════════════╝
    
    CHARACTER IDENTITY (CRITICAL - MUST FOLLOW EXACTLY):
    - Character Name: Ana (this is the ONLY character you generate)
    - Ana is a specific, consistent character with defined features
    - Deep, rich warm medium-brown skin tone (#8B6F47)
    - Natural almond-shaped brown eyes (proportional to face)
    - Always wears large gold hoop earrings
    - Modern, relatable, confident Black woman
    - DO NOT generate random people or different characters
    - Every sticker MUST be recognizably the same person: Ana
    
    *** CRITICAL TEXT REQUIREMENT (APPLIES TO ALL FORMATS) ***
    ${textInstructions}
    
    TASK: Generate a high-quality sticker of Ana (the character described above).
    
    ART STYLE REQUIREMENTS:
    - MUST be a soft, painterly digital illustration with a MATTE finish.
    - VISIBLE grain and soft-brush textures throughout.
    - COZY, atmospheric lighting (natural window light or warm interior glow).
    - NO 3D, NO plastic textures, NO sharp vector outlines.
    
    CHARACTER DETAILS:
    - Name: Ana
    - Hair: ${settings.hair}
    - Outfit: ${settings.outfitCategory} style
    - Vibe/Expression: ${settings.expression}
    - Pose: ${settings.pose}
    - Eyewear: ${settings.glasses}
    - Earrings: Always include large gold hoops.
    
    SCENE:
    - Location: ${settings.scene}
    - Companion: ${settings.includeCompanion ? "A small, cute tan puppy interacting with her." : "Solo character."}
    ${settings.prompt ? `
    ADDITIONAL SCENE DETAILS (IMPORTANT - MUST FOLLOW THESE INSTRUCTIONS):
    ${settings.prompt}
    ` : ''}
    
    COMPOSITION & FORMAT:
    - Format: ${settings.format}
    - ${settings.format === 'Classic Rectangle' ? 'Rectangular format: The entire scene in a rectangular frame with clean white border and softly rounded corners.' : ''}
    - ${settings.format === 'Die-Cut Square' ? 'DIE-CUT SQUARE format: The character, props, AND TEXT all contained within a perfect SQUARE (1:1 ratio) with a thick, clean white die-cut border around the ENTIRE composition.' : ''}
    - ${settings.format === 'Die-Cut Landscape' ? 'DIE-CUT LANDSCAPE format: Wide rectangular (16:9 aspect ratio) with thick, clean white die-cut border around character, props, and TEXT.' : ''}
    - ${settings.format === 'Die-Cut Vertical' ? 'DIE-CUT VERTICAL format: Tall rectangular (9:16 aspect ratio) with thick, clean white die-cut border around character, props, and TEXT.' : ''}
    - ${settings.format === 'Circular Vignette' ? 'Circular vignette: Scene contained within a soft circular frame with a subtle fade at the edges.' : ''}
    - If Die-Cut format: Ensure the white border is clean, consistent thickness, and surrounds ALL elements including the text
    - High resolution output for all formats

    ${SYSTEM_INSTRUCTIONS}
  `;

  const getAspectRatio = (format: string) => {
    switch(format) {
      case 'Die-Cut Landscape':
        return '16:9';
      case 'Die-Cut Vertical':
        return '9:16';
      default:
        return '1:1';
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: constructedPrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: getAspectRatio(settings.format)
        }
      }
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("The AI didn't return a response.");

    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data found.");
  } catch (error: any) {
    console.error("Generation error:", error);
    throw new Error(error.message || "Failed to generate.");
  }
};

export interface ExtractedQuote {
  quote: string;
  why: string;
}

export const extractQuotesFromText = async (bookText: string): Promise<ExtractedQuote[]> => {
  const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });
  
  const prompt = `
You are a quote expert for the neurodivergent (ND) community. Your job is to extract the most punchy, relatable, shareable quotes from book text.

ANALYZE THIS TEXT AND EXTRACT EXACTLY 5 QUOTES:
"""
${bookText}
"""

REQUIREMENTS FOR EACH QUOTE:
- 3-8 words ideal (max 12 words)
- Validating, empowering, or humorously relatable
- Perfect for Pinterest/TikTok/Reddit
- Speaks to the ND experience (ADHD, autism, dyslexia, etc.)
- Makes people say "THIS. EXACTLY THIS."
- Similar energy to: "DOING NOTHING IS THE PLAN" or "MY BRAIN IS FULL"
- Must be directly quoted or minimally adapted from the text

FOR EACH QUOTE, explain in 1 sentence WHY it's perfect for stickers.

RESPOND IN THIS EXACT JSON FORMAT (ONLY the JSON, no other text):
[
  {
    "quote": "QUOTE TEXT HERE",
    "why": "Why this quote resonates with the ND community"
  },
  ...5 total...
]
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [{ text: prompt }]
      }
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No response from AI");

    let jsonText = '';
    for (const part of candidate.content.parts) {
      if ('text' in part) {
        jsonText += part.text;
      }
    }
    // Sanitize and parse JSON (handle code fences or prose around JSON)
    let cleaned = jsonText.trim();
    // Remove markdown code fences
    cleaned = cleaned.replace(/```json|```/gi, '').trim();
    // Extract the first JSON array block
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.slice(startIdx, endIdx + 1);
    }
    // Remove trailing commas before closing brackets
    cleaned = cleaned.replace(/,(\s*[\]\}])/g, '$1');
    // Replace smart quotes with straight quotes
    cleaned = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    const parsed = JSON.parse(cleaned) as ExtractedQuote[];
    // Keep only valid entries with non-empty quote
    const quotes = parsed.filter(q => q && typeof q.quote === 'string' && q.quote.trim().length > 0).slice(0, 5);
    return quotes;
  } catch (error: any) {
    console.error('Error extracting quotes:', error);
    throw new Error(`Failed to extract quotes: ${error?.message || 'Unknown error'}`);
  }
};
