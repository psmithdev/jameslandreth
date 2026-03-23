-- ============================================
-- Seed data: Documents from legacy site
-- ============================================

INSERT INTO documents (slug, title, category, excerpt, date, year, location, tags, pages, file_type, featured, status) VALUES
  ('famille-2017', 'Les Nouvelles de Famille 2017', 'Family Newsletter',
   'Being a yearly news report of the adventures of Aleda, Jim, Mark and Leanne for 2017. Features family updates, travels, and memorable moments from the year.',
   'December 2017', 2017, 'United States',
   ARRAY['family', 'newsletter', '2017', 'travel', 'updates'],
   '4 pages', 'PDF', true, 'published'),

  ('plague-year', 'Our Journal of the Plague Year', 'Travel Journal',
   'With apologies to Daniel Defoe. The further adventures of Aleda, Jim, Mark and Leanne in 2020. A unique perspective on traveling during unprecedented times.',
   'December 2020', 2020, 'United States',
   ARRAY['travel', 'journal', '2020', 'covid', 'adventures'],
   '6 pages', 'PDF', true, 'published'),

  ('ties-talk', 'If Ties Could Talk', 'Essay',
   'A thoughtful reflection on the stories behind a collection of neckties, each representing different chapters of life, career, and personal relationships.',
   'March 2024', 2024, 'United States',
   ARRAY['essay', 'personal', 'reflection', 'career'],
   '3 pages', 'Word', true, 'published'),

  ('japan-2023', 'Japan Adventures 2023', 'Travel',
   'A comprehensive guide to our latest journey through Japan, including hidden gems, cultural experiences, and photography tips.',
   'November 2023', 2023, 'Japan',
   ARRAY['travel', 'japan', 'photography', 'culture', 'adventure'],
   '12 pages', 'PDF', false, 'published'),

  ('medical-reflections', 'Reflections on Medical Practice', 'Medical',
   'Looking back on 40 years of medical practice, the evolution of healthcare, and lessons learned from patients.',
   'June 2023', 2023, 'United States',
   ARRAY['medical', 'healthcare', 'career', 'reflection'],
   '8 pages', 'Word', false, 'published'),

  ('photography-2022', 'Through the Lens: 2022', 'Photography',
   'A collection of favorite photographs from 2022 with stories behind each image and technical notes for fellow photographers.',
   'January 2023', 2023, 'Europe',
   ARRAY['photography', 'images', 'technical', 'stories'],
   '16 pages', 'PDF', false, 'published'),

  ('family-history', 'Family History Project', 'Family',
   'Tracing our family lineage through historical records, interviews, and discovered documents spanning three generations.',
   'September 2022', 2022, 'United States',
   ARRAY['family', 'history', 'genealogy', 'research'],
   '24 pages', 'Word', false, 'published'),

  ('europe-railway', 'European Railway Journey', 'Travel',
   'Six weeks traveling through Europe by train, discovering small towns, meeting locals, and documenting the changing landscape.',
   'August 2022', 2022, 'Europe',
   ARRAY['travel', 'europe', 'railway', 'train', 'adventure'],
   '18 pages', 'PDF', false, 'published'),

  ('retirement-art', 'The Art of Retirement', 'Essay',
   E'Navigating the transition from active medical practice to retirement, finding new purposes, and embracing life''s next chapter.',
   'May 2022', 2022, 'United States',
   ARRAY['retirement', 'transition', 'purpose', 'life'],
   '5 pages', 'Word', false, 'published');

-- ============================================
-- Seed data: Artifacts from legacy site
-- ============================================

INSERT INTO artifacts (slug, title, category, family, description, provenance, estimated_value, status) VALUES
  ('myrna-allen-oil-paintings', 'Myrna Allen Oil Paintings (Set of 6)', 'Paintings & Art', 'Littlefield',
   'Six original oil paintings by Myrna Allen, a close family friend. Landscapes and still lifes in warm tones, professionally framed in matching gilt frames.',
   'Gifted to Jim and Aleda by the artist in the 1980s. Myrna was a beloved member of the church community and a talented self-taught painter.',
   '$200 - $400 each', 'available'),

  ('brass-candlestick-pair', 'Brass Candlestick Pair', 'Furniture', 'Walsh',
   'Pair of tall brass candlesticks with detailed engravings, approximately 14 inches tall. Show beautiful patina consistent with their age.',
   'Passed down from the Walsh family, believed to have been brought from Ireland in the early 1900s.',
   '$75 - $150', 'available'),

  ('whitefriars-crystal-decanter', 'Whitefriars Crystal Decanter Set', 'Glassware & Crystal', 'Flick',
   'Complete crystal decanter set with six matching glasses. Hand-cut diamond pattern with a star-burst base. No chips or cracks.',
   E'A wedding gift to Jim''s parents from the Flick side of the family, circa 1948.',
   '$150 - $300', 'available'),

  ('schulmerich-handbells', 'Schulmerich Handbells (Set of 12)', 'Musical Instruments', 'Littlefield',
   'Set of 12 Schulmerich handbells in carrying case. Full chromatic octave, polished bronze with leather handles. Well-maintained and in playing condition.',
   'Used by Jim in the church handbell choir for over 20 years. Each bell has been carefully cleaned and stored after every performance.',
   '$300 - $600', 'available'),

  ('haviland-limoges-china', 'Haviland Limoges China Service (12 place settings)', 'China & Porcelain', 'Litzel',
   'Complete 12-place setting of Haviland Limoges porcelain with pink rose border pattern. Includes dinner plates, salad plates, bread plates, cups and saucers, serving platters, and gravy boat.',
   'Inherited from grandmother Litzel, purchased new in the 1930s. Used for every major family holiday dinner for three generations.',
   '$400 - $800', 'available'),

  ('victorian-writing-desk', 'Victorian Writing Desk', 'Furniture', 'Walsh',
   'Mahogany writing desk with brass hardware, roll-top compartment, and six small drawers. Some wear consistent with age but structurally sound. Key included.',
   'Originally owned by great-grandmother Walsh. The desk traveled from Boston to St. Louis with the family in 1912. Many family letters were written at this desk.',
   '$500 - $1,000', 'available'),

  ('leather-bound-medical-library', 'Leather-Bound Medical Library (15 volumes)', 'Books & Documents', 'Littlefield',
   E'Collection of 15 leather-bound medical reference texts, ranging from 1950s through 1970s editions. Includes anatomy atlases, pharmacology references, and surgical technique manuals.',
   E'Jim''s personal medical library from his years in practice. Many contain his handwritten notes and annotations in the margins.',
   '$100 - $250', 'available'),

  ('hand-embroidered-tablecloth', 'Hand-Embroidered Linen Tablecloth', 'Linens & Textiles', 'Flick',
   'Large rectangular tablecloth (approximately 8 feet) with intricate hand-embroidered floral border in blue and white. Includes 8 matching napkins. Minor age spots but excellent condition overall.',
   'Created by great-aunt Clara Flick over the course of two years in the 1920s. Each corner features a different seasonal flower.',
   '$75 - $200', 'available');
