update public.documents
set category = 'Yearly Newsletters'
where category = 'Family Newsletter';

update public.documents
set category = 'Yearly Newsletters'
where slug = 'plague-year'
  and category = 'Travel Journal';

update public.documents
set category = 'Family'
where slug = 'jim-and-aleda-a-timeline'
  and category = 'Essay';

update public.documents
set category = 'Jokes / Cartoons / Humor'
where slug = 'jokes-i-often-tell'
  and category = 'Essay';

update public.documents
set category = 'Travel'
where slug = 'viking-rhine-getaway'
  and category = 'Essay';
