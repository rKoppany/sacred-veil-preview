export const navItems = [
  { href: "index.html", label: "Főoldal" },
  { href: "rolunk.html", label: "Rólunk" },
  { href: "szolgaltatasok.html", label: "Csomagok" },
  { href: "portfolio.html", label: "Portfólió" },
  { href: "kapcsolat.html", label: "Kapcsolat" }
];

export const portfolioImages = Array.from({ length: 36 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  const categoryCycle = ["jegyes", "jegyes", "eskuvo", "polgari", "reszletek", "eskuvo"];
  const category = categoryCycle[index % categoryCycle.length];
  return {
    src: `images/portfolio/portfolio-${number}.webp`,
    alt: `Sacred Veil portfóliófotó ${index + 1}`,
    category
  };
});

export const featuredImages = [
  portfolioImages[0],
  portfolioImages[1],
  portfolioImages[9],
  portfolioImages[12],
  portfolioImages[18],
  portfolioImages[24]
];

export const serviceGroups = [
  {
    id: "eskuvoi-fotozas",
    label: "Esküvői fotózás",
    intro: "Három jelenléti opció azoknak, akik a nagy napot tiszta, elegáns és történetmesélő képi világgal szeretnék megőrizni.",
    services: [
      {
        title: "Finom jelenlét",
        tag: "Rövidebb esküvői fotózás",
        image: "images/portfolio/portfolio-03.webp",
        description: "Letisztult megoldás kisebb esküvőkhöz, ahol a szertartás, a közeli családi pillanatok és néhány kreatív portré a legfontosabb.",
        ideal: "Intim esküvőkhöz, rövidebb programhoz, kisebb vendégkörhöz.",
        includes: ["szertartás dokumentálása", "családi és páros képek", "válogatott, utómunkázott galéria"]
      },
      {
        title: "Klasszikus történet",
        tag: "Közepes jelenlét",
        image: "images/portfolio/portfolio-07.webp",
        description: "A nap főbb ívét követő fotózás, amelyben a készülődés, a szertartás és a kreatív képek is természetes ritmusban kapnak helyet.",
        ideal: "Azoknak, akik nem csak képeket, hanem átgondolt esküvői történetet szeretnének.",
        includes: ["készülődés részletei", "szertartás és gratuláció", "kreatív páros sorozat"]
      },
      {
        title: "Teljes napos emlék",
        tag: "Történetmesélő esküvői fotózás",
        image: "images/portfolio/portfolio-08.webp",
        description: "A teljes nap atmoszféráját őrzi meg a reggeli készülődéstől az esti ünneplésig, finom részletekkel és spontán pillanatokkal.",
        ideal: "Nagyobb esküvőkhöz, teljes napos jelenléthez, gazdag portfólióanyaghoz.",
        includes: ["teljes napos dokumentálás", "részletek, vendégek, hangulatok", "bővített online galéria"]
      }
    ]
  },
  {
    id: "polgari-fotozas",
    label: "Polgári fotózás",
    intro: "Rövidebb, koncentrált fotózás a szertartás méltóságára, az érkezésre, a családi képekre és a közeli pillanatokra hangolva.",
    services: [
      {
        title: "Polgári szertartás",
        tag: "Szertartás és rövid kreatív sorozat",
        image: "images/portfolio/portfolio-12.webp",
        description: "Elegáns, nyugodt fotózás azoknak, akik a polgári szertartás emlékeit szeretnék szépen, emberközelien megőrizni.",
        ideal: "Városházi, kültéri vagy kisebb családi polgári eseményekhez.",
        includes: ["szertartás fotózása", "gratuláció és családi csoportképek", "rövid páros kreatív fotózás"]
      }
    ]
  },
  {
    id: "jegyesfotozas",
    label: "Jegyesfotózás",
    intro: "Két páros fotózási opció azoknak, akik szeretnének egymásra hangolódni a kamera előtt, és közben természetes, személyes képeket kapni.",
    services: [
      {
        title: "Könnyed jegyesfotózás",
        tag: "Rövid páros sorozat",
        image: "images/portfolio/portfolio-02.webp",
        description: "Laza, természetes hangulatú fotózás egy választott helyszínen, sok finom instrukcióval és valódi kapcsolódással.",
        ideal: "Első fotózáshoz, esküvő előtti ráhangolódáshoz, meghívóhoz vagy webes használathoz.",
        includes: ["egy helyszín", "vezetett, természetes pózok", "válogatott páros képek"]
      },
      {
        title: "Editorial jegyes történet",
        tag: "Hosszabb, több hangulatú fotózás",
        image: "images/portfolio/portfolio-10.webp",
        description: "Átgondoltabb, vizuálisan gazdagabb jegyesfotózás több háttérrel, lassabb tempóval és kifinomultabb képi sorozattal.",
        ideal: "Pároknak, akik prémiumabb, magazinszerű, mégis személyes sorozatot szeretnének.",
        includes: ["több képi helyzet", "hangulat- és outfitváltás lehetősége", "bővített galéria"]
      }
    ]
  }
];

export const researchInsights = [
  "A vizsgált magyar esküvőfotós oldalak rövid főmenüvel dolgoznak, ahol a portfólió és kapcsolat kiemelt helyet kap.",
  "A portfólióoldalak legjobban akkor működnek, amikor a képek nagy, párokhoz vagy történetekhez kötött rácsban jelennek meg.",
  "Az ajánlatkérés folyamatosan elérhető CTA-ként jelenik meg, nem csak a kapcsolat oldalon.",
  "A bemutatkozás akkor hiteles, ha nem túl hosszú, hanem személyes szemléletet és fotózási hozzáállást ad."
];
