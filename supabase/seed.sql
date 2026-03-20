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
