const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
        BorderStyle, WidthType, ShadingType, PageNumber, PageBreak } = require('docx');

const border = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

// Helper: bold/normal text runs
function t(text, opts = {}) {
  return new TextRun({ text, font: "Arial", size: 22, ...opts });
}
function bold(text, opts = {}) {
  return new TextRun({ text, font: "Arial", size: 22, bold: true, ...opts });
}

// Helper: simple paragraph
function p(children, opts = {}) {
  if (typeof children === 'string') children = [t(children)];
  return new Paragraph({ spacing: { after: 120 }, ...opts, children });
}

// Helper: heading
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, font: "Arial", size: 36, bold: true, color: "5D4037" })]
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color: "795548" })]
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: "4CAF50" })]
  });
}

// Helper: bullet
function bullet(children, level = 0) {
  if (typeof children === 'string') children = [t(children)];
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60 },
    children
  });
}

// Helper: numbered item
function numbered(children, level = 0) {
  if (typeof children === 'string') children = [t(children)];
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { after: 60 },
    children
  });
}

// Helper: table row
function tableRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map((text, i) => {
      const cellChildren = typeof text === 'string'
        ? [new Paragraph({ children: [new TextRun({ text, font: "Arial", size: 20, bold: isHeader })] })]
        : [new Paragraph({ children: text })];
      return new TableCell({
        borders,
        margins: cellMargins,
        shading: isHeader ? { fill: "D7CCC8", type: ShadingType.CLEAR } : undefined,
        width: { size: 1, type: WidthType.AUTO },
        children: cellChildren
      });
    })
  });
}

// Helper: simple 2-col table
function table2(headers, rows, colWidths = [4680, 4680]) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      tableRow(headers, true),
      ...rows.map(r => tableRow(r))
    ]
  });
}

// Helper: horizontal rule (thin line)
function hr() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D7CCC8", space: 1 } },
    children: []
  });
}

// Spacer
function spacer() {
  return new Paragraph({ spacing: { after: 80 }, children: [] });
}

// ─── Document ─────────────────────────────────────────────────────────────

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22 } }
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "5D4037" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "795548" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "4CAF50" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } } }
        ] },
      { reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }
        ] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } // ~2cm
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "Wsp\u00F3lne Pastwisko \u2014 Zasady gry", font: "Arial", size: 16, color: "999999", italics: true })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Strona ", font: "Arial", size: 16, color: "999999" }),
                     new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: "999999" })]
        })]
      })
    },
    children: [
      // ─── Title ────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: "\uD83D\uDC07 \uD83D\uDC11 \uD83D\uDC37 \uD83D\uDC04", font: "Arial", size: 48 })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: "Wsp\u00F3lne Pastwisko", font: "Arial", size: 52, bold: true, color: "5D4037" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [new TextRun({ text: "Zasady gry i przewodnik dla prowadz\u0105cego", font: "Arial", size: 26, color: "795548", italics: true })]
      }),

      // ─── O grze ───────────────────────────────────────
      h1("O grze"),
      p([t("\u201CWsp\u00F3lne Pastwisko\u201D to gra multiplayer rozgrywana w przegl\u0105darce, oparta na grze planszowej Jaros\u0142awa Flisa. Demonstruje "),
         bold("tragedi\u0119 wsp\u00F3lnego pastwiska"), t(" (tragedy of the commons) \u2014 sytuacj\u0119, w kt\u00F3rej jednostki dzia\u0142aj\u0105ce we w\u0142asnym interesie niszcz\u0105 wsp\u00F3lne dobro.")]),
      p("Gracze s\u0105 rolnikami dziel\u0105cymi jedno pastwisko. Hoduj\u0105 zwierz\u0119ta, kt\u00F3re zajmuj\u0105 miejsce na pastwisku. Je\u015Bli \u0142\u0105czne zapotrzebowanie stad przekroczy pojemno\u015B\u0107 pastwiska \u2014 nast\u0119puje kl\u0119ska g\u0142odu i zwierz\u0119ta gin\u0105."),
      hr(),

      // ─── Przygotowanie ────────────────────────────────
      h1("Przygotowanie"),
      h3("Co potrzebujesz"),
      bullet("Laptop pod\u0142\u0105czony do projektora (panel prowadz\u0105cego)"),
      bullet("Studenci z telefonami i dost\u0119pem do internetu"),
      bullet([t("Adres gry: "), bold("https://wspolne-pastwisko.onrender.com")]),
      spacer(),
      h3("Przed zaj\u0119ciami"),
      bullet([t("Wejd\u017A na adres gry "), bold("2\u20133 minuty wcze\u015Bniej"), t(" \u2014 darmowy serwer Render usypia po 15 min nieaktywno\u015Bci i potrzebuje chwili na obudzenie si\u0119")]),
      spacer(),
      h3("Uruchomienie"),
      numbered([t("Na laptopie otw\u00F3rz adres gry \u2192 kliknij "), bold("\u201CPanel prowadz\u0105cego\u201D")]),
      numbered([t("Na projektorze pojawi si\u0119 "), bold("4-literowy kod pokoju"), t(" (du\u017Ce litery)")]),
      numbered([t("Studenci na telefonach otwieraj\u0105 ten sam adres \u2192 klikaj\u0105 "), bold("\u201CDo\u0142\u0105cz do gry\u201D"), t(" \u2192 wpisuj\u0105 kod z projektora i swoje imi\u0119")]),
      numbered("Na panelu prowadz\u0105cego widzisz list\u0119 do\u0142\u0105czonych graczy"),
      numbered([t("Gdy wszyscy do\u0142\u0105cz\u0105 \u2014 kliknij "), bold("\u201CRozpocznij Gr\u0119 1 \u2014 Bez komunikacji\u201D")]),
      hr(),

      // ─── Zwierzęta ───────────────────────────────────
      h1("Zwierz\u0119ta"),
      table2(
        ["Zwierz\u0119", "Emoji", "Warto\u015B\u0107", "Ile zajmuje pastwiska"],
        [
          ["Kr\u00F3lik", "\uD83D\uDC07", "1", "1"],
          ["Owca", "\uD83D\uDC11", "2", "2"],
          ["\u015Awinia", "\uD83D\uDC37", "4", "4"],
          ["Krowa", "\uD83D\uDC04", "8", "8"],
        ],
        [2800, 1200, 2000, 3360]
      ),
      spacer(),
      p([t("Warto\u015B\u0107 zwierz\u0119cia = ile punkt\u00F3w jest warte na koniec gry = ile pastwiska zajmuje.")]),
      hr(),

      // ─── Warunki startowe ─────────────────────────────
      h1("Warunki startowe"),
      bullet([t("Ka\u017Cdy gracz zaczyna z "), bold("2 kr\u00F3likami"), t(" (warto\u015B\u0107 stada = 2)")]),
      bullet([bold("Pojemno\u015B\u0107 pastwiska"), t(" = 4 \u00D7 liczba graczy (np. 30 graczy \u2192 120)")]),
      bullet([t("W "), bold("puli"), t(" jest ograniczona liczba zwierz\u0105t do wzi\u0119cia:")]),
      bullet("Kr\u00F3liki: 3 \u00D7 liczba graczy", 1),
      bullet("Owce: 2 \u00D7 liczba graczy", 1),
      bullet("\u015Awinie: 1 \u00D7 liczba graczy", 1),
      bullet("Krowy: liczba graczy \u00F7 3 (zaokr. w d\u00F3\u0142)", 1),
      hr(),

      // ─── Przebieg rundy ───────────────────────────────
      h1("Przebieg rundy"),
      p([t("Gra trwa "), bold("maksymalnie 5 rund"), t(". Ka\u017Cda runda ma 4 fazy:")]),
      spacer(),

      // Faza A
      h2("Faza A \u2014 Dobranie zwierz\u0105t"),
      p("Ka\u017Cdy gracz jednocze\u015Bnie (i w tajemnicy) wybiera zwierz\u0119ta z puli, kt\u00F3re chce doda\u0107 do swojego stada."),
      spacer(),
      p([bold("Limit pobrania:")]),
      bullet([t("Mo\u017Cesz wzi\u0105\u0107 zwierz\u0119ta o \u0142\u0105cznej warto\u015Bci nie wi\u0119kszej ni\u017C "), bold("twoja obecna warto\u015B\u0107 stada"), t(" (minimum 2)")]),
      bullet("Przyk\u0142ad: masz stado warte 8 \u2192 mo\u017Cesz wzi\u0105\u0107 zwierz\u0119ta za max 8 (np. 1 krow\u0119, albo 2 \u015Bwinie, albo 4 owce itd.)"),
      bullet("Na starcie ka\u017Cdy ma stado warte 2, wi\u0119c mo\u017Ce wzi\u0105\u0107 za max 2 (np. 1 owc\u0119 albo 2 kr\u00F3liki)"),
      spacer(),
      p([bold("Wa\u017Cne:"), t(" Im bogatszy gracz, tym wi\u0119cej mo\u017Ce bra\u0107 \u2014 bogaci bogac\u0105 si\u0119 szybciej.")]),
      p("Je\u015Bli kilku graczy chce tego samego zwierz\u0119cia, a w puli nie starcza \u2014 dzielone proporcjonalnie z losowym rozstrzyganiem remis\u00F3w."),
      p([bold("Czas:"), t(" 30 sekund (Gra 1) / 20 sekund (Gra 2). Po up\u0142ywie czasu \u2014 kto nie zatwierdzi\u0142, nie dostaje nic.")]),
      hr(),

      // Faza B
      h2("Faza B \u2014 Kl\u0119ska g\u0142odu (automatyczna)"),
      p("Serwer sprawdza: czy suma warto\u015Bci wszystkich stad przekracza pojemno\u015B\u0107 pastwiska?"),
      spacer(),
      p([bold("Je\u015Bli NIE"), t(" \u2014 nic si\u0119 nie dzieje, przechodzimy do Fazy C.")]),
      spacer(),
      p([bold("Je\u015Bli TAK \u2014 KL\u0118SKA G\u0141ODU:")]),
      numbered([bold("Pastwisko si\u0119 kurczy"), t(" \u2014 pojemno\u015B\u0107 spada o liczb\u0119 graczy (trwa\u0142e zniszczenie ekologiczne)")]),
      numbered([bold("Ka\u017Cdy gracz traci po\u0142ow\u0119 warto\u015Bci stada"), t(" \u2014 serwer automatycznie zabiera zwierz\u0119ta, zaczynaj\u0105c od najdro\u017Cszych")]),
      numbered("Stracone zwierz\u0119ta wracaj\u0105 do puli"),
      numbered("Je\u015Bli po przyci\u0119ciu stada wci\u0105\u017C nie mieszcz\u0105 si\u0119 na pastwisku \u2014 przycinanie powtarza si\u0119"),
      hr(),

      // Faza C
      h2("Faza C \u2014 Danina"),
      p([t("Ka\u017Cdy gracz "), bold("musi odda\u0107 dok\u0142adnie 1 zwierz\u0119"), t(" z powrotem na wsp\u00F3lne pastwisko. Sam wybiera kt\u00F3re.")]),
      spacer(),
      p([bold("Efekt:"), t(" Pojemno\u015B\u0107 pastwiska ro\u015Bnie o warto\u015B\u0107 oddanych zwierz\u0105t.")]),
      spacer(),
      p([bold("Dylemat:")]),
      bullet("Oddanie kr\u00F3lika (1) \u2192 minimalna pomoc dla pastwiska, minimalny koszt dla gracza"),
      bullet("Oddanie krowy (8) \u2192 ogromna pomoc dla pastwiska, ale ogromna strata dla gracza"),
      bullet([bold("To jest serce gry:"), t(" kto po\u015Bwi\u0119ci wi\u0119cej dla dobra wsp\u00F3lnego?")]),
      spacer(),
      p("Gracz z tylko 1 zwierz\u0119ciem jest zwolniony z daniny."),
      p([bold("Czas:"), t(" 30 sekund / 20 sekund.")]),
      hr(),

      // Faza D
      h2("Faza D \u2014 Porachunki"),
      p([t("Ka\u017Cdy gracz "), bold("mo\u017Ce (ale nie musi)"), t(" ukara\u0107 jednego innego gracza.")]),
      spacer(),
      p([bold("Koszt kary:"), t(" oboje (karz\u0105cy i karany) trac\u0105 po 1 najta\u0144szym zwierz\u0119ciu. Kara jest kosztowna dla obu stron.")]),
      spacer(),
      p([bold("Zasady:")]),
      bullet("Gracz z tylko 1 zwierz\u0119ciem nie mo\u017Ce kara\u0107 (straci\u0142by ostatnie)"),
      bullet("Gracz z tylko 1 zwierz\u0119ciem nie mo\u017Ce by\u0107 dalej karany"),
      bullet("Jeden gracz mo\u017Ce by\u0107 ukarany przez wielu \u2014 traci 1 zwierz\u0119 za ka\u017Cdego karz\u0105cego"),
      bullet("Stracone zwierz\u0119ta wracaj\u0105 do puli"),
      spacer(),
      p([bold("Czas:"), t(" 30 sekund / 20 sekund.")]),
      hr(),

      // ─── Koniec gry ───────────────────────────────────
      h1("Koniec gry"),
      p([t("Gra ko\u0144czy si\u0119 gdy wyst\u0105pi "), bold("cokolwiek"), t(" z poni\u017Cszych:")]),
      bullet([t("Min\u0119\u0142o "), bold("5 rund")]),
      bullet([t("Nast\u0105pi\u0142y "), bold("2 kl\u0119ski g\u0142odu")]),
      bullet([bold("Pula zwierz\u0105t"), t(" jest pusta")]),
      bullet([t("Prowadz\u0105cy "), bold("r\u0119cznie zako\u0144czy\u0142"), t(" gr\u0119")]),
      spacer(),
      p([bold("Wynik gracza"), t(" = warto\u015B\u0107 jego stada na koniec gry.")]),
      hr(),

      // ─── Struktura sesji ──────────────────────────────
      h1("Struktura sesji \u2014 dwie gry"),
      p([t("Sesja sk\u0142ada si\u0119 z "), bold("dw\u00F3ch gier"), t(" rozgrywanych jedna po drugiej:")]),
      spacer(),
      h3("Gra 1 \u2014 Bez komunikacji"),
      bullet([t("Studenci graj\u0105 "), bold("w ciszy"), t(" \u2014 nie wolno rozmawia\u0107")]),
      bullet("Pokazuje tragedi\u0119: racjonalne decyzje jednostek prowadz\u0105 do ruiny wsp\u00F3lnej"),
      spacer(),
      h3("Gra 2 \u2014 Z komunikacj\u0105"),
      bullet("Prowadz\u0105cy resetuje gr\u0119 (nowe pastwisko, nowe stada, pe\u0142na pula)"),
      bullet([t("Studenci "), bold("mog\u0105 swobodnie rozmawia\u0107")]),
      bullet("Timery skr\u00F3cone do 20 sekund (studenci ju\u017C znaj\u0105 interfejs)"),
      bullet("Pokazuje rozwi\u0105zanie: komunikacja, zaufanie i normy spo\u0142eczne umo\u017Cliwiaj\u0105 zarz\u0105dzanie wsp\u00F3lnym dobrem"),
      spacer(),
      p([t("Na koniec wy\u015Bwietlane jest "), bold("por\u00F3wnanie"), t(" obu gier.")]),
      hr(),

      // ─── Sterowanie ───────────────────────────────────
      h1("Sterowanie gr\u0105 (panel prowadz\u0105cego)"),
      p([t("Kliknij "), bold("\u2699 (ko\u0142o z\u0119bate)"), t(" w prawym dolnym rogu panelu, aby otworzy\u0107 kontrolki:")]),
      spacer(),
      table2(
        ["Przycisk", "Dzia\u0142anie"],
        [
          ["\u23F8 Pauza", "Zatrzymuje timer"],
          ["\u25B6 Wzn\u00F3w", "Wznawia gr\u0119"],
          ["\u23ED Pomi\u0144 faz\u0119", "Wymusza koniec bie\u017C\u0105cej fazy (gracze, kt\u00F3rzy nie zdecydowali, dostaj\u0105 warto\u015Bci domy\u015Blne)"],
          ["\u23F9 Zako\u0144cz gr\u0119", "Natychmiast ko\u0144czy gr\u0119"],
          ["\uD83D\uDD04 Reset \u2014 Gra 2", "Resetuje wszystko i przechodzi do Gry 2"],
          ["\uD83D\uDC41 Poka\u017C/ukryj nazwy", "Prze\u0142\u0105cza anonimowo\u015B\u0107 kar na dashboardzie"],
          ["Timer 15s/30s/45s/60s", "Zmienia czas na faz\u0119"],
        ],
        [3200, 6160]
      ),
      hr(),

      // ─── Co widzisz ───────────────────────────────────
      h1("Co widzisz na panelu prowadz\u0105cego"),
      bullet([bold("Miernik pastwiska"), t(" \u2014 pasek pokazuj\u0105cy zape\u0142nienie (zielony \u2192 \u017C\u00F3\u0142ty \u2192 pomara\u0144czowy \u2192 czerwony)")]),
      bullet([bold("Licznik kl\u0119sk g\u0142odu"), t(" \u2014 ile z max 2")]),
      bullet([bold("Wykres"), t(" \u2014 pojemno\u015B\u0107 pastwiska vs \u0142\u0105czna warto\u015B\u0107 stad w kolejnych rundach (gdy linie si\u0119 krzy\u017Cuj\u0105 = kl\u0119ska)")]),
      bullet([bold("Status fazy"), t(" \u2014 ilu graczy ju\u017C zdecydowa\u0142o (np. \u201CDecyzje: 14/30 \u2713\u201D)")]),
      bullet([bold("Ranking"), t(" \u2014 top 5 i bottom 3 graczy wg warto\u015Bci stada")]),

      // Page break before didactic section
      new Paragraph({ children: [new PageBreak()] }),

      // ─── Aspekt dydaktyczny ───────────────────────────
      h1("Aspekt dydaktyczny \u2014 czego ucz\u0105 si\u0119 studenci"),
      spacer(),

      h2("Tragedia wsp\u00F3lnego pastwiska (Garrett Hardin, 1968)"),
      p("Gra bezpo\u015Brednio modeluje klasyczny problem z socjologii \u015Brodowiskowej: gdy zas\u00F3b jest wsp\u00F3lny i nieograniczony w dost\u0119pie, ka\u017Cda jednostka ma racjonaln\u0105 motywacj\u0119, by eksploatowa\u0107 go ponad miar\u0119. Indywidualny zysk z dodatkowego zwierz\u0119cia trafia do jednego gracza, ale koszty (degradacja pastwiska) rozk\u0142adaj\u0105 si\u0119 na wszystkich. W efekcie \u2014 wszyscy trac\u0105."),
      p([bold("Studenci do\u015Bwiadczaj\u0105 tego na w\u0142asnej sk\u00F3rze w Grze 1."), t(" Wi\u0119kszo\u015B\u0107 grup doprowadza do kl\u0119ski g\u0142odu w ci\u0105gu 2\u20133 rund.")]),
      spacer(),

      h2("Rozwi\u0105zanie Ostrom \u2014 zarz\u0105dzanie wsp\u00F3lnym dobrem (Elinor Ostrom, Nobel 2009)"),
      p("Elinor Ostrom udowodni\u0142a, \u017Ce wsp\u00F3lne zasoby nie musz\u0105 by\u0107 ani sprywatyzowane, ani zarz\u0105dzane przez pa\u0144stwo. Spo\u0142eczno\u015Bci mog\u0105 same zarz\u0105dza\u0107 wsp\u00F3lnym dobrem, je\u015Bli maj\u0105 mo\u017Cliwo\u015B\u0107:"),
      numbered([bold("Komunikacji"), t(" \u2014 mog\u0105 rozmawia\u0107 i ustala\u0107 regu\u0142y")]),
      numbered([bold("Monitorowania"), t(" \u2014 widz\u0105, kto ile bierze (dashboard to umo\u017Cliwia)")]),
      numbered([bold("Sankcji"), t(" \u2014 mog\u0105 kara\u0107 \u0142ami\u0105cych zasady (Faza D)")]),
      numbered([bold("Budowania zaufania"), t(" \u2014 powtarzane interakcje tworz\u0105 normy")]),
      spacer(),
      p([bold("Gra 2 (z komunikacj\u0105) to demonstruje."), t(" Studenci zwykle:")]),
      bullet("Ustalaj\u0105 limity pobierania"),
      bullet("Umawiaj\u0105 si\u0119 na oddawanie cenniejszych zwierz\u0105t w daninie"),
      bullet("Gro\u017C\u0105 karami chciwym graczom (i je realizuj\u0105)"),
      bullet("Osi\u0105gaj\u0105 znacznie lepsze wyniki zbiorowe"),
      spacer(),

      h2("Kosztowna kara (altruistic punishment)"),
      p("Faza D modeluje zjawisko z ekonomii behawioralnej: ludzie s\u0105 gotowi ponosi\u0107 koszty, aby kara\u0107 tych, kt\u00F3rzy \u0142ami\u0105 normy spo\u0142eczne \u2014 nawet gdy nie maj\u0105 z tego bezpo\u015Bredniego zysku. W Grze 1 kary s\u0105 chaotyczne i nieefektywne (nikt nie wie, za co karze). W Grze 2 kary staj\u0105 si\u0119 narz\u0119dziem egzekwowania wsp\u00F3lnie ustalonych regu\u0142."),
      spacer(),

      h2("Nier\u00F3wno\u015B\u0107 a wsp\u00F3lne dobra"),
      p([t("Mechanika \u201Cbogaci mog\u0105 bra\u0107 wi\u0119cej\u201D (limit pobrania = warto\u015B\u0107 stada) pokazuje, jak nier\u00F3wno\u015B\u0107 nap\u0119dza nadmiern\u0105 eksploatacj\u0119. "), bold("Wsp\u00F3\u0142czynnik Giniego"), t(" wy\u015Bwietlany na ko\u0144cu pozwala zmierzy\u0107, jak nier\u00F3wna by\u0142a dystrybucja zasob\u00F3w.")]),
      spacer(),

      h2("Degradacja ekologiczna jest nieodwracalna"),
      p([t("Pastwisko po kl\u0119sce g\u0142odu "), bold("trwale si\u0119 kurczy"), t(" \u2014 nie wraca do pierwotnego stanu. To modeluje realny problem: wyeksploatowane ekosystemy nie regeneruj\u0105 si\u0119 automatycznie, nawet gdy presja ustanie.")]),
      hr(),

      // ─── Porównanie gier ──────────────────────────────
      h1("Por\u00F3wnanie gier \u2014 na co zwr\u00F3ci\u0107 uwag\u0119 w dyskusji"),
      p("Po zako\u0144czeniu obu gier, na panelu pojawi si\u0119 por\u00F3wnanie. Kluczowe pytania do dyskusji:"),
      spacer(),
      table2(
        ["Pytanie", "Czego szuka\u0107"],
        [
          ["Ile rund przetrwa\u0142y obie gry?", "Gra 2 zwykle trwa d\u0142u\u017Cej"],
          ["Ile by\u0142o kl\u0119sk g\u0142odu?", "Gra 2 zwykle mniej lub zero"],
          ["Jaka by\u0142a \u015Brednia warto\u015B\u0107 stada?", "Gra 2 zwykle wy\u017Csza \u2014 wszyscy zyskuj\u0105 na wsp\u00F3\u0142pracy"],
          ["Jak wygl\u0105da\u0142 wsp\u00F3\u0142czynnik Giniego?", "Gra 2 zwykle ni\u017Cszy \u2014 bardziej r\u00F3wny podzia\u0142"],
          ["Ile by\u0142o kar?", "Paradoks: w Grze 2 bywa ich wi\u0119cej, ale s\u0105 celowe i skuteczne"],
          ["Jak wygl\u0105da\u0142 wykres pastwiska?", "Gra 1: linie szybko si\u0119 krzy\u017Cuj\u0105. Gra 2: pastwisko ro\u015Bnie dzi\u0119ki daninom"],
        ],
        [4000, 5360]
      ),
      spacer(),

      h3("Sugerowane pytania do student\u00F3w"),
      numbered("Co czuli\u015Bcie, gdy kto\u015B wzi\u0105\u0142 du\u017Co zwierz\u0105t? Czy chcieli\u015Bcie go ukara\u0107?"),
      numbered("Czy w Grze 2 uda\u0142o si\u0119 ustali\u0107 wsp\u00F3lne zasady? Jakie?"),
      numbered("Czy kto\u015B z\u0142ama\u0142 ustalone zasady? Co si\u0119 wtedy sta\u0142o?"),
      numbered("Kto oddawa\u0142 krowy w daninie? Kto tylko kr\u00F3liki? Dlaczego?"),
      numbered("Czy kary w Grze 1 mia\u0142y sens? A w Grze 2?"),
      numbered("Jak to si\u0119 ma do realnych problem\u00F3w \u015Brodowiskowych (np. prze\u0142owienie, zanieczyszczenie powietrza, zmiana klimatu)?"),
      numbered("Co by si\u0119 sta\u0142o, gdyby gra trwa\u0142a 50 rund zamiast 5?"),
      hr(),

      // ─── Harmonogram ──────────────────────────────────
      h1("Sugerowany harmonogram sesji (90 minut)"),
      table2(
        ["Czas", "Co si\u0119 dzieje"],
        [
          ["0:00\u20130:05", "Wprowadzenie: czym jest tragedia wsp\u00F3lnego pastwiska (2\u20133 zdania, bez spoiler\u00F3w)"],
          ["0:05\u20130:10", "Studenci \u0142\u0105cz\u0105 si\u0119 z gr\u0105 na telefonach"],
          ["0:10\u20130:12", "Kr\u00F3tkie wyja\u015Bnienie zasad (lub rozdaj wydrukowane)"],
          ["0:12\u20130:35", "Gra 1 \u2014 Bez komunikacji (cisza na sali!)"],
          ["0:35\u20130:40", "Om\u00F3wienie wynik\u00F3w Gry 1, kr\u00F3tka dyskusja"],
          ["0:40\u20130:42", "Reset do Gry 2, wyja\u015Bnienie: teraz wolno rozmawia\u0107"],
          ["0:42\u20131:05", "Gra 2 \u2014 Z komunikacj\u0105"],
          ["1:05\u20131:10", "Por\u00F3wnanie wynik\u00F3w obu gier na projektorze"],
          ["1:10\u20131:30", "Dyskusja: Hardin, Ostrom, wsp\u00F3lne dobra, pytania do student\u00F3w"],
        ],
        [2000, 7360]
      ),
      hr(),

      // ─── Rozwiązywanie problemów ──────────────────────
      h1("Rozwi\u0105zywanie problem\u00F3w"),
      table2(
        ["Problem", "Rozwi\u0105zanie"],
        [
          ["Strona si\u0119 nie \u0142aduje", "Serwer Render usn\u0105\u0142 \u2014 poczekaj 30 sekund i od\u015Bwie\u017C"],
          ["Student nie widzi kodu pokoju", "Niech od\u015Bwie\u017Cy stron\u0119 na telefonie"],
          ["Student si\u0119 roz\u0142\u0105czy\u0142", "Niech wpisze ten sam kod i to samo imi\u0119 \u2014 odzyska swoje stado"],
          ["Gra si\u0119 zawiesi\u0142a na jednej fazie", "U\u017Cyj \u201C\u23ED Pomi\u0144 faz\u0119\u201D w kontrolkach"],
          ["Za ma\u0142o czasu na decyzje", "Zwi\u0119ksz timer w kontrolkach (45s lub 60s)"],
          ["Studenci ko\u0144cz\u0105 za szybko", "Zmniejsz timer (15s)"],
          ["Student do\u0142\u0105czy\u0142 za p\u00F3\u017Ano", "Dostanie 2 kr\u00F3liki i do\u0142\u0105czy od bie\u017C\u0105cej rundy"],
        ],
        [3500, 5860]
      ),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/Users/arkadiuszszlaga/PROJECTS/pastwisko/ZASADY-GRY.docx", buffer);
  console.log("ZASADY-GRY.docx created successfully");
});
