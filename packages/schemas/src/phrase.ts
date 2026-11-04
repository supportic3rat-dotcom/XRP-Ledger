import { z } from 'zod';

/** How many words the customer chooses from, and how many make up their phrase. */
export const PHRASE_POOL = 30;
export const PHRASE_LENGTH = 6;

/** Short, common, easy-to-tell-apart words. Each setup draws 30 of them at random. */
export const PHRASE_WORDS = [
  'acorn', 'amber', 'anchor', 'apple', 'arrow', 'atlas', 'autumn', 'badge', 'bamboo', 'banner', 'basket', 'beacon', 'berry', 'birch',
  'blanket', 'bloom', 'bottle', 'breeze', 'brick', 'bridge', 'brook', 'bucket', 'butter', 'cabin', 'cactus', 'camel', 'candle', 'canoe',
  'canyon', 'carpet', 'castle', 'cedar', 'cherry', 'chess', 'cider', 'circle', 'clover', 'cobalt', 'cocoa', 'comet', 'copper', 'coral',
  'cotton', 'crane', 'crystal', 'daisy', 'desert', 'dolphin', 'dragon', 'drum', 'eagle', 'ember', 'falcon', 'feather', 'fern', 'fiddle',
  'flint', 'forest', 'fossil', 'fountain', 'garden', 'garnet', 'ginger', 'glacier', 'globe', 'granite', 'grape', 'gravel', 'harbor',
  'harvest', 'hazel', 'helmet', 'hickory', 'honey', 'horizon', 'island', 'ivory', 'jacket', 'jasmine', 'jungle', 'kettle', 'kite',
  'ladder', 'lagoon', 'lantern', 'lemon', 'lily', 'lizard', 'lotus', 'magnet', 'mango', 'maple', 'marble', 'meadow', 'melon', 'mirror',
  'mitten', 'monkey', 'mosaic', 'mountain', 'nectar', 'needle', 'nickel', 'oasis', 'ocean', 'olive', 'onion', 'orbit', 'orchid', 'otter',
  'paddle', 'panda', 'paper', 'parrot', 'peach', 'pebble', 'pencil', 'pepper', 'piano', 'pillow', 'pine', 'planet', 'plum', 'pocket',
  'pony', 'prairie', 'pumpkin', 'puzzle', 'quartz', 'quill', 'rabbit', 'radar', 'raven', 'reef', 'ribbon', 'river', 'robin', 'rocket',
  'saddle', 'salmon', 'sandal', 'satin', 'scarf', 'shadow', 'shell', 'silver', 'sketch', 'sparrow', 'spider', 'spruce', 'squirrel',
  'stone', 'storm', 'summit', 'sunset', 'swan', 'tablet', 'tango', 'thistle', 'thunder', 'tiger', 'timber', 'toast', 'tomato', 'topaz',
  'torch', 'tulip', 'tunnel', 'turtle', 'umbrella', 'valley', 'velvet', 'violet', 'violin', 'volcano', 'wagon', 'walnut', 'whale',
  'whistle', 'willow', 'window', 'winter', 'wizard', 'yarn', 'zebra',
] as const;

const word = z.string().trim().toLowerCase().regex(/^[a-z]{2,12}$/);
/** The customer's 6 picks, in the order they chose them. */
export const phraseWords = z
  .array(word)
  .length(PHRASE_LENGTH)
  .refine((w) => new Set(w).size === PHRASE_LENGTH, 'Pick 6 different words');
