export type EssayCollection = {
  id: string;
  label: string;
  eyebrow: string;
  description: string;
};

export type EssayEditorial = {
  deck: string;
  collections: string[];
};

export const essayCollections: EssayCollection[] = [
  {
    id: 'family',
    label: 'Family Stories',
    eyebrow: 'People & memory',
    description: 'Portraits, traditions, and the stories that families carry forward.',
  },
  {
    id: 'travel',
    label: 'Travel & Places',
    eyebrow: 'Journeys near & far',
    description: 'Observations gathered on rivers, roads, and memorable trips abroad.',
  },
  {
    id: 'medicine',
    label: 'Medicine & Work',
    eyebrow: 'A life in practice',
    description: 'Hospital nights, working lives, and reflections from a medical career.',
  },
  {
    id: 'sweden',
    label: 'Swedish Heritage',
    eyebrow: 'Customs & ancestry',
    description: 'Swedish celebrations, family recipes, history, and inherited traditions.',
  },
  {
    id: 'ideas',
    label: 'Ideas & Reflection',
    eyebrow: 'History & thought',
    description: 'Essays about purpose, science, change, and the shape of a lifetime.',
  },
  {
    id: 'arts',
    label: 'Arts, Music & Humor',
    eyebrow: 'Words & wit',
    description: 'Music, literature, language, jokes, and the pleasure of a good story.',
  },
];

export const startHereSlugs = [
  'ties-talk',
  'valborg',
  'it-was-thursday',
];

export const essayEditorial: Record<string, EssayEditorial> = {
  'after-the-fall-or-herpetology-101': {
    deck: 'A playful domestic poem in which an unexpected snake turns a quiet night into family legend.',
    collections: ['family', 'arts'],
  },
  'aphorisms-as-dictated-by-james-j-walsh': {
    deck: 'A preserved collection of family sayings, practical wisdom, and memorable turns of phrase.',
    collections: ['family', 'ideas', 'arts'],
  },
  'banana-bread-bananakaka': {
    deck: 'A family recipe becomes a path through Swedish ancestry, migration, and memories shared across generations.',
    collections: ['family', 'sweden'],
  },
  'edna-swanson-and-the-wig': {
    deck: 'A patient’s adventurous 1920s San Francisco story, retold with warmth and a marvelous final turn.',
    collections: ['family', 'medicine'],
  },
  'ether': {
    deck: 'A vivid recollection of ether, childhood medicine, and the sensory memories that refuse to disappear.',
    collections: ['medicine', 'ideas'],
  },
  'flying-down-to-rio-without-fred-or-ginger': {
    deck: 'An overnight journey to Rio, told with medical curiosity, dry humor, and an eye for fellow travelers.',
    collections: ['travel', 'medicine'],
  },
  'how-well-do-you-know-jim-littlefield-the-vanity-game': {
    deck: 'A personal quiz built from the objects, episodes, and inside stories that make up Jim’s life.',
    collections: ['family', 'arts'],
  },
  'in-the-shop': {
    deck: 'A wartime factory photograph opens a reflection on tools, work, and skills learned at the shop bench.',
    collections: ['medicine', 'ideas'],
  },
  'it-was-thursday': {
    deck: 'A young intern’s cold January night becomes an intimate account of responsibility, uncertainty, and care.',
    collections: ['medicine'],
  },
  'james-joyce-and-his-influences': {
    deck: 'A preserved dissertation abstract tracing James Joyce’s influence on William Faulkner and Anthony Burgess.',
    collections: ['arts', 'ideas'],
  },
  'jim-and-aleda-a-timeline': {
    deck: 'Six decades of marriage, family, work, and travel gathered into one affectionate chronology.',
    collections: ['family'],
  },
  'jokes-i-often-tell': {
    deck: 'A well-worn collection of the jokes and one-liners Jim loves to tell—and the people who first told them.',
    collections: ['family', 'arts'],
  },
  'life-is-not-a-problem-to-be-solved-but-a-mystery-to-be-lived': {
    deck: 'A brief meditation on Joseph Campbell, following one’s bliss, and learning to live inside life’s mystery.',
    collections: ['ideas'],
  },
  'lunch-at-marshall-field-s': {
    deck: 'A cherished Chicago holiday ritual returns through the dining room, decorations, and bustle of Marshall Field’s.',
    collections: ['family', 'travel'],
  },
  'mrs-edith-swanson-and-the-wig': {
    deck: 'The shorter telling of Edith Swanson’s adventurous encounter with a fashionable San Francisco hairdresser.',
    collections: ['family'],
  },
  'my-writing-class': {
    deck: 'A candid and funny account of community writing classes, their characters, and the urge to put life on paper.',
    collections: ['arts', 'ideas'],
  },
  'physics-is-important-quantum-mechanics-and-reality': {
    deck: 'A reading collection about quantum mechanics, reality, and why the questions of physics reach beyond equations.',
    collections: ['ideas'],
  },
  'pierre-the-balloon-poodle': {
    deck: 'A small balloon dog, the Edinburgh Fringe, and a bilingual story whose language is part of the joke.',
    collections: ['travel', 'arts'],
  },
  'retirement-art': {
    deck: 'A practical reflection on leaving medical practice, finding new purposes, and embracing life’s next chapter.',
    collections: ['medicine', 'ideas'],
  },
  'ringling-bros-circus-closing-after-146-years': {
    deck: 'The closing of the Ringling Bros. circus prompts a tender look at childhood, tradition, and generational change.',
    collections: ['family', 'ideas'],
  },
  'scotland-the-brave': {
    deck: 'An invitation to visit Scotland in August, with weather, festivals, history, and hard-earned travel advice.',
    collections: ['travel'],
  },
  'some-thoughts-on-ireland': {
    deck: 'A thoughtful travel primer on seeing Ireland slowly, understanding its regions, and choosing how to explore.',
    collections: ['travel'],
  },
  'songs-in-my-life': {
    deck: 'A musical autobiography connecting favorite songs with the people, places, and moments that gave them meaning.',
    collections: ['family', 'arts'],
  },
  'story-songs': {
    deck: 'Reflections on narrative songs and the enduring pleasure of music that knows how to tell a story.',
    collections: ['arts'],
  },
  'the-french-lesson': {
    deck: 'A trip toward the Dordogne becomes a warm comedy about language, confidence, and being understood abroad.',
    collections: ['travel', 'arts'],
  },
  'the-lights-of-betterton': {
    deck: 'A memory of Betterton opens through Fitzgerald’s green light and the way places glow across time.',
    collections: ['family', 'arts', 'ideas'],
  },
  'the-old-switcheroo': {
    deck: 'The remarkable weekend in 1967 when Sweden changed sides of the road—and transformed daily life overnight.',
    collections: ['sweden', 'ideas'],
  },
  'thinking-god-knows-what-james-joyce-and-trieste': {
    deck: 'A preserved biographical essay about James Joyce, Trieste, and the complicated geography of an artist’s life.',
    collections: ['arts', 'travel'],
  },
  'top-25-defining-u-s-events-of-the-last-60-years': {
    deck: 'A concise personal survey of the political, social, scientific, and cultural events that reshaped modern America.',
    collections: ['ideas'],
  },
  'valborg': {
    deck: 'Bonfires, songs, students, and spring: an inviting guide to Sweden’s enduring Valborg celebration.',
    collections: ['sweden', 'travel'],
  },
  'viking-rhine-getaway': {
    deck: 'A seasoned traveler’s notes on the Rhine, its neighboring cities, and the pleasures and limits of river travel.',
    collections: ['travel'],
  },
};

export function getEssayEditorial(slug: string): EssayEditorial {
  return essayEditorial[slug] || { deck: '', collections: [] };
}
