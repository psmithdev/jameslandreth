export type AnniversaryBookSpread = {
  number: number;
  title: string;
  src: string;
};

export const anniversaryBook = {
  title: 'Landreth Family Album',
  subtitle: 'A finished 8x11 layflat hardcover photo book for the family archive.',
  pageCount: 46,
  spreadCount: 23,
  cover: '/images/anniversary-book/cover.jpg',
  pdf: '/downloads/landreth-family-album.pdf',
};

export const anniversaryBookSpreads: AnniversaryBookSpread[] = Array.from({ length: anniversaryBook.spreadCount }, (_, index) => {
  const number = index + 1;
  return {
    number,
    title: number === 1 ? 'Opening Spread' : `Spread ${number}`,
    src: `/images/anniversary-book/spreads/spread-${String(number).padStart(2, '0')}.jpg`,
  };
});
