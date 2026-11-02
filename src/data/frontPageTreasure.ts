// The Family Treasures item spotlighted on the jameslandreth.com front page.
// Set `slug` to an artifact's slug to pin it; leave null to show the newest
// available treasure that has a photo.
export const frontPageTreasure: { slug: string | null } = {
  slug: null,
};

// First sentence or two of a description, for the short front-page teaser.
// The full text stays on the item's own page.
export function treasureTeaser(description: string | null, maxLength = 200): string {
  const text = (description || '').trim();
  if (text.length <= maxLength) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [];
  let teaser = '';
  for (const sentence of sentences) {
    if ((teaser + sentence).trim().length > maxLength) break;
    teaser += sentence;
  }
  return teaser.trim() || `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}…`;
}
