// Jim and Aleda Landreth's New England trip, October 2-10, 2026.
// The sequence follows Jim's in-progress PowerPoint and the tour itinerary.
window.FOLIAGE = {
  title: "New England in Fall Color",
  hero: 38,
  favorite: 40,
  stops: [
    {
      id: "uss-constitution",
      name: "USS Constitution",
      mapName: "USS Const.",
      state: "Massachusetts",
      lon: -71.0556,
      lat: 42.3725,
      label: { dx: 14, dy: -10, anchor: "start" },
      date: "Oct 2",
      note: "We arrived in Boston before the tour began and spent Friday visiting USS Constitution, better known as Old Ironsides. It became our Day 0: a bright afternoon in Charlestown before the official welcome dinner the following evening.",
      milesToNext: null,
      foliage: { stage: "Boston prelude", swatches: ["#315A72", "#8FB5C4", "#D4A45D"] }
    },
    {
      id: "gardner",
      name: "Gardner Museum",
      mapName: "Gardner",
      state: "Massachusetts",
      lon: -71.0995,
      lat: 42.3381,
      label: { dx: 14, dy: 24, anchor: "start" },
      date: "Oct 3",
      note: "On our own before the tour began that evening, we visited the Isabella Stewart Gardner Museum. We explored the courtyard and searched the collection for a Christmas-themed picture for our annual card.",
      milesToNext: null,
      foliage: { stage: "Day 1", swatches: ["#5F7651", "#C08A3E", "#8A3D2D"] }
    },
    {
      id: "stockbridge",
      name: "Boston to Stockbridge",
      mapName: "Stockbridge",
      state: "Massachusetts",
      lon: -73.3204,
      lat: 42.2876,
      label: { dx: 14, dy: 7, anchor: "start" },
      date: "Oct 4",
      note: "The tour left Boston for western Massachusetts. Along the way came a walk toward Quincy Market and Faneuil Hall, the first changing leaf, the Norman Rockwell Museum and the Housatonic River at Stockbridge.",
      milesToNext: null,
      foliage: { stage: "Color beginning", swatches: ["#718044", "#D0A339", "#A6532F"] }
    },
    {
      id: "stowe",
      name: "Woodstock and Stowe",
      mapName: "Stowe",
      state: "Vermont",
      lon: -72.6874,
      lat: 44.4654,
      label: { dx: -14, dy: -14, anchor: "end" },
      date: "Oct 5-6",
      note: "The route crossed into Vermont through Woodstock and continued to Stowe. Covered bridges, church steeples and the view from the von Trapp Family Lodge supplied the New England scenes we had come to see.",
      milesToNext: null,
      foliage: { stage: "Near peak", swatches: ["#D8A12D", "#D36625", "#A32E25"] }
    },
    {
      id: "montpelier",
      name: "Montpelier",
      mapName: "Montpelier",
      state: "Vermont",
      lon: -72.5754,
      lat: 44.2601,
      label: { dx: -14, dy: 28, anchor: "end" },
      date: "Oct 7",
      note: "We passed Vermont's state capital on the way east. The Winooski River, the capitol dome and the hills beyond marked the transition from the Green Mountains toward New Hampshire.",
      milesToNext: null,
      foliage: { stage: "Peak color", swatches: ["#E0AB2F", "#CC5B22", "#8F2821"] }
    },
    {
      id: "white-mountains",
      name: "The White Mountains",
      mapName: "North Conway",
      state: "New Hampshire",
      lon: -71.1284,
      lat: 44.0537,
      label: { dx: 14, dy: -14, anchor: "start" },
      date: "Oct 7-8",
      note: "The coach entered the White Mountain National Forest, with a gondola view across the ridges and stops near Mount Webster, Crawford Notch and the Willey House. Here the autumn color filled entire mountainsides.",
      milesToNext: null,
      foliage: { stage: "Peak color", swatches: ["#E6B23A", "#C94B20", "#7F241E"] }
    },
    {
      id: "maine-coast",
      name: "Kennebunkport and Portland",
      mapName: "Kennebunkport",
      state: "Maine",
      lon: -70.4767,
      lat: 43.3617,
      label: { dx: 14, dy: 8, anchor: "start" },
      date: "Oct 9",
      note: "The road reached the Maine coast by way of Kennebunkport, then Portland. There were lobster rolls for lunch, a sunset across the Fore River and the famous lobster dinner that had to be dug out of its shell.",
      milesToNext: null,
      foliage: { stage: "Coastal color", swatches: ["#B9873C", "#8E4A2A", "#476A66"] }
    },
    {
      id: "portland",
      name: "Portland Head Light",
      mapName: "Head Light",
      state: "Maine",
      lon: -70.2078,
      lat: 43.6231,
      label: { dx: -14, dy: -16, anchor: "end" },
      date: "Oct 10",
      note: "The final morning brought Portland Head Light at Fort Williams Park before the coach followed the coast back to Boston. It was the last view of Maine and the end of the eight-day tour.",
      milesToNext: null,
      foliage: { stage: "Return to Boston", swatches: ["#B98B46", "#7A4B32", "#315A72"] }
    }
  ],
  routeLegs: [
    { from: "uss-constitution", to: "gardner" },
    { from: "gardner", to: "stockbridge" },
    {
      from: "stockbridge",
      to: "stowe",
      via: [
        { name: "Saratoga Springs", lon: -73.7846, lat: 43.0831 },
        { name: "Woodstock", lon: -72.5184, lat: 43.6242 }
      ]
    },
    { from: "stowe", to: "montpelier" },
    {
      from: "montpelier",
      to: "white-mountains",
      via: [
        { name: "Franconia Notch", lon: -71.6817, lat: 44.1742 },
        { name: "Kancamagus", lon: -71.4210, lat: 44.0350 }
      ]
    },
    { from: "white-mountains", to: "maine-coast" },
    {
      from: "maine-coast",
      to: "portland",
      via: [
        { name: "Portland", lon: -70.2568, lat: 43.6591 }
      ]
    },
    { from: "portland", to: "uss-constitution" }
  ],
  photos: [
    { stop: "uss-constitution", orientation: "portrait", file: "/images/new-england-2026/uss-aft.webp", title: "Old Ironsides from aft", caption: "USS Constitution with her ensign flying and one of the ship's boats alongside.", date: "Oct 2, 2026", credit: "Jim Landreth" },
    { stop: "uss-constitution", orientation: "portrait", file: "/images/new-england-2026/uss-aleda-abeam.webp", title: "Aleda abeam of USS Constitution", caption: "Aleda on the pier with the ship's masts rising behind her.", date: "Oct 2, 2026", credit: "Jim Landreth" },
    { stop: "uss-constitution", orientation: "landscape", file: "/images/new-england-2026/uss-aleda-broadside.webp", title: "A broadside view", caption: "Aleda alongside USS Constitution, with the Boston skyline beyond Charlestown Navy Yard.", date: "Oct 2, 2026", credit: "Jim Landreth" },
    { stop: "uss-constitution", orientation: "portrait", file: "/images/new-england-2026/uss-aleda-sunshine.webp", title: "Bright sunshine in the rigging", caption: "Aleda beneath the maze of lines, spars and standing rigging.", date: "Oct 2, 2026", credit: "Jim Landreth" },
    { stop: "uss-constitution", orientation: "portrait", file: "/images/new-england-2026/uss-bow.webp", title: "Bow-on", caption: "The ship's tall masts seen directly from the bow.", date: "Oct 2, 2026", credit: "Jim Landreth" },
    { stop: "uss-constitution", orientation: "portrait", file: "/images/new-england-2026/uss-bowsprit.webp", title: "The bowsprit", caption: "Looking forward beneath the bowsprit toward the Charlestown waterfront.", date: "Oct 2, 2026", credit: "Jim Landreth" },
    { stop: "uss-constitution", orientation: "landscape", file: "/images/new-england-2026/uss-gun-deck.webp", title: "The gun deck", caption: "Below deck aboard USS Constitution, among the cannon and polished woodwork.", date: "Oct 2, 2026", credit: "Jim Landreth" },

    { stop: "gardner", orientation: "landscape", file: "/images/new-england-2026/gardner-courtyard.webp", title: "The central courtyard", caption: "Flowers, palms, mosaics and Venetian arches at the heart of the Gardner Museum.", date: "Oct 3, 2026", credit: "Jim Landreth" },
    { stop: "gardner", orientation: "portrait", file: "/images/new-england-2026/gardner-courtyard-overlook.webp", title: "Courtyard from above", caption: "Looking down into the museum's interior garden from an upper gallery.", date: "Oct 3, 2026", credit: "Jim Landreth" },
    { stop: "gardner", orientation: "landscape", file: "/images/new-england-2026/gardner-courtyard-light.webp", title: "Light across the courtyard", caption: "October sunlight casting the museum's window tracery across the walls.", date: "Oct 3, 2026", credit: "Jim Landreth" },
    { stop: "gardner", orientation: "portrait", file: "/images/new-england-2026/gardner-aleda-window.webp", title: "Aleda by the window", caption: "Aleda pauses at an upper window overlooking the courtyard.", date: "Oct 3, 2026", credit: "Jim Landreth" },
    { stop: "gardner", orientation: "landscape", file: "/images/new-england-2026/gardner-retable.webp", title: "A carved retable", caption: "A fifteenth-century retable depicting scenes from the life of Christ.", date: "Oct 3, 2026", credit: "Jim Landreth" },
    { stop: "gardner", orientation: "landscape", file: "/images/new-england-2026/gardner-el-jaleo.webp", title: "El Jaleo", caption: "John Singer Sargent's monumental 1882 painting of a Spanish Romani dancer and musicians.", date: "Oct 3, 2026", credit: "Jim Landreth" },
    { stop: "gardner", orientation: "portrait", file: "/images/new-england-2026/gardner-civitali.webp", title: "Virgin Adoring the Christ Child", caption: "Painted and gilded terracotta by Matteo Civitali, made about 1480.", date: "Oct 3, 2026", credit: "Jim Landreth" },
    { stop: "gardner", orientation: "portrait", file: "/images/new-england-2026/gardner-ghiberti.webp", title: "Madonna and Child", caption: "A polychrome wood sculpture from the workshop of Lorenzo Ghiberti.", date: "Oct 3, 2026", credit: "Jim Landreth" },
    { stop: "gardner", orientation: "portrait", file: "/images/new-england-2026/gardner-pesellino.webp", title: "Virgin and Child with a Swallow", caption: "Francesco Pesellino's painting, made about 1453-1457. The swallow held by the Christ Child symbolizes the Resurrection.", date: "Oct 3, 2026", credit: "Jim Landreth" },
    { stop: "gardner", orientation: "portrait", file: "/images/new-england-2026/gardner-titian.webp", title: "The Rape of Europa", caption: "Titian's 1560-1562 painting of Europa carried across the sea by Zeus disguised as a bull.", date: "Oct 3, 2026", credit: "Jim Landreth" },

    { stop: "stockbridge", orientation: "portrait", file: "/images/new-england-2026/boston-first-leaf.webp", title: "The first leaf", caption: "The first changing leaf of the trip, found in Boston before the coach headed west.", date: "Oct 4, 2026", credit: "Jim Landreth" },
    { stop: "stockbridge", orientation: "portrait", file: "/images/new-england-2026/boston-walkabout.webp", title: "Walkabout in downtown Boston", caption: "Walking toward Quincy Market, with the dome of Faneuil Hall just above the trees.", date: "Oct 4, 2026", credit: "Jim Landreth" },
    { stop: "stockbridge", orientation: "portrait", file: "/images/new-england-2026/boston-faneuil-hall.webp", title: "Faneuil Hall", caption: "Boston's marketplace and meeting hall, first opened in 1742.", date: "Oct 4, 2026", credit: "Jim Landreth" },
    { stop: "stockbridge", orientation: "landscape", file: "/images/new-england-2026/stockbridge-rockwell-arrival.webp", title: "Norman Rockwell Museum", caption: "Back in Stockbridge. Aleda remembered the museum fondly from our 2010 visit and wanted to return.", date: "Oct 4, 2026", credit: "Jim Landreth" },
    { stop: "stockbridge", orientation: "landscape", file: "/images/new-england-2026/stockbridge-rockwell-peace-corps.webp", title: "Two returned Peace Corps Volunteers", caption: "Aleda and Jim, Jamaica IX, with Rockwell's 1966 tribute to the Peace Corps in the background.", date: "Oct 4, 2026", credit: "Jim Landreth" },
    { stop: "stockbridge", orientation: "landscape", file: "/images/new-england-2026/stockbridge-housatonic.webp", title: "The Housatonic at Stockbridge", caption: "The river flows south through Massachusetts and Connecticut toward Long Island Sound. Charles Ives set this landscape to music in 1910.", date: "Oct 4, 2026", credit: "Jim Landreth" },
    { stop: "stockbridge", orientation: "portrait", file: "/images/new-england-2026/stockbridge-changing-leaf.webp", title: "Color in southern Massachusetts", caption: "A single changing leaf near Stockbridge, the color tour beginning in miniature.", date: "Oct 4, 2026", credit: "Jim Landreth" },

    { stop: "stowe", orientation: "portrait", file: "/images/new-england-2026/woodstock-covered-bridge.webp", title: "Covered bridge at Woodstock", caption: "One of Vermont's classic covered bridges on the road north.", date: "Oct 5, 2026", credit: "Jim Landreth" },
    { stop: "stowe", orientation: "landscape", file: "/images/new-england-2026/stowe-austrian-flag.webp", title: "A little Austria in Vermont", caption: "The Austrian flag at the von Trapp Family Lodge in Stowe.", date: "Oct 5, 2026", credit: "Jim Landreth" },
    { stop: "stowe", orientation: "landscape", file: "/images/new-england-2026/stowe-monolith.webp", title: "Fall Color and the Monolith", caption: "From the von Trapp Family Lodge, looking across Nebraska Valley toward Vermont's Green Mountains, with an homage to Kubrick's 2001.", date: "Oct 5, 2026", credit: "Jim Landreth" },
    { stop: "stowe", orientation: "landscape", file: "/images/new-england-2026/stowe-view.webp", title: "View from the von Trapp Lodge", caption: "Sunlight breaking over the Green Mountains beyond Stowe.", date: "Oct 5, 2026", credit: "Jim Landreth" },
    { stop: "stowe", orientation: "portrait", file: "/images/new-england-2026/stowe-vermont-leaves.webp", title: "Vermont leaves", caption: "The Green Mountains framed by dark branches and early autumn color.", date: "Oct 5, 2026", credit: "Jim Landreth" },
    { stop: "stowe", orientation: "landscape", file: "/images/new-england-2026/stowe-steeple.webp", title: "A Vermont steeple", caption: "A white clock tower above a blaze of orange leaves.", date: "Oct 6, 2026", credit: "Jim Landreth" },
    { stop: "stowe", orientation: "landscape", file: "/images/new-england-2026/stowe-cow.webp", title: "A resident of the von Trapp farm", caption: "A friendly close-up at the farm in Stowe.", date: "Oct 6, 2026", credit: "Jim Landreth" },
    { stop: "stowe", orientation: "landscape", file: "/images/new-england-2026/stowe-calf.webp", title: "The calf", caption: "A young calf at the von Trapp farm.", date: "Oct 6, 2026", credit: "Jim Landreth" },

    { stop: "montpelier", orientation: "landscape", file: "/images/new-england-2026/montpelier-capitol.webp", title: "Vermont State House", caption: "The state capitol in Montpelier, seen across the Winooski River.", date: "Oct 7, 2026", credit: "Jim Landreth" },
    { stop: "montpelier", orientation: "landscape", file: "/images/new-england-2026/montpelier-river.webp", title: "River and cemetery", caption: "The river valley beneath a wooded Vermont hillside.", date: "Oct 7, 2026", credit: "Jim Landreth" },

    { stop: "white-mountains", orientation: "landscape", file: "/images/new-england-2026/white-mountains-sign.webp", title: "Entering White Mountain National Forest", caption: "The road into New Hampshire's White Mountains, already lined with autumn color.", date: "Oct 7, 2026", credit: "Jim Landreth" },
    { stop: "white-mountains", orientation: "landscape", file: "/images/new-england-2026/white-mountains-gondola.webp", title: "From the gondola", caption: "A high view across the White Mountains, with color filling the valleys below.", date: "Oct 7, 2026", credit: "Jim Landreth" },
    { stop: "white-mountains", orientation: "landscape", file: "/images/new-england-2026/white-mountains-webster.webp", title: "Mount Webster", caption: "South of Bretton Woods. Jim wondered whether it was named for Daniel Webster or the television show.", date: "Oct 8, 2026", credit: "Jim Landreth" },
    { stop: "white-mountains", orientation: "landscape", file: "/images/new-england-2026/white-mountains-willey.webp", title: "Willey House Historic Site", caption: "Crawford Notch and Willey Pond. The 1826 landslide inspired Jim's verdict: “This place gave me the Willies.” He bought fudge.", date: "Oct 8, 2026", credit: "Jim Landreth" },
    { stop: "white-mountains", orientation: "landscape", file: "/images/new-england-2026/white-mountains-lake.webp", title: "Still water and autumn color", caption: "A quiet New Hampshire lake reflecting a bright blue October sky.", date: "Oct 8, 2026", credit: "Jim Landreth" },

    { stop: "maine-coast", orientation: "landscape", file: "/images/new-england-2026/kennebunkport-boathouse.webp", title: "Kennebunkport", caption: "The Boathouse across the Kennebunk River from the Clam Shack, where we had lobster rolls for lunch. Yum!", date: "Oct 9, 2026", credit: "Jim Landreth" },
    { stop: "maine-coast", orientation: "square", file: "/images/new-england-2026/salem-chocolate-moose.webp", title: "The Chocolate Moose", caption: "One of these is a chocolate moose, not a mousse au chocolat. We stopped at the candy shop in Salem, New Hampshire, and bought chocolates.", date: "Oct 9, 2026", credit: "Jim Landreth" },
    { stop: "maine-coast", orientation: "portrait", file: "/images/new-england-2026/portland-sunset.webp", title: "Sunset across the Fore River", caption: "The view from the Saltwater Grille in South Portland before the famous lobster dinner.", date: "Oct 9, 2026", credit: "Jim Landreth" },
    { stop: "maine-coast", orientation: "portrait", file: "/images/new-england-2026/portland-lobster.webp", title: "Lobster, of course", caption: "The famous dinner. You had to dig it out yourself.", date: "Oct 9, 2026", credit: "Jim Landreth" },
    { stop: "maine-coast", orientation: "landscape", file: "/images/new-england-2026/portland-harbor-night.webp", title: "Portland Harbor at night", caption: "Downtown Portland and the harbor lights, seen from South Portland.", date: "Oct 9, 2026", credit: "Jim Landreth" },

    { stop: "portland", orientation: "portrait", file: "/images/new-england-2026/portland-head-light.webp", title: "Portland Head Light", caption: "Maine's oldest lighthouse at Fort Williams Park, the final stop before returning to Boston.", date: "Oct 10, 2026", credit: "Jim Landreth" }
  ]
};

// Keep photographs in route order so the slideshow follows the journey.
(function () {
  const order = Object.fromEntries(window.FOLIAGE.stops.map((stop, index) => [stop.id, index]));
  const heroPhoto = window.FOLIAGE.photos[window.FOLIAGE.hero];
  const favoritePhoto = window.FOLIAGE.photos[window.FOLIAGE.favorite];
  window.FOLIAGE.photos = window.FOLIAGE.photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => order[a.photo.stop] - order[b.photo.stop] || a.index - b.index)
    .map(({ photo }) => photo);
  window.FOLIAGE.hero = window.FOLIAGE.photos.indexOf(heroPhoto);
  window.FOLIAGE.favorite = window.FOLIAGE.photos.indexOf(favoritePhoto);
})();
