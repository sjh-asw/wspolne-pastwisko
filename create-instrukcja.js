const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber, PageBreak } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

// A4 page
const PAGE_WIDTH = 11906;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN; // 9026

function heading1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}

function heading2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}

function heading3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}

function para(text, opts = {}) {
  const runs = [];
  if (typeof text === 'string') {
    runs.push(new TextRun({ text, ...opts }));
  } else {
    for (const t of text) runs.push(new TextRun(t));
  }
  return new Paragraph({ spacing: { after: 120 }, children: runs });
}

function bold(text) {
  return new TextRun({ text, bold: true });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 60 }, children: [] });
}

function animalRow(emoji, name, value, desc) {
  const colWidths = [1200, 2000, 1500, 4326];
  return new TableRow({
    children: [
      new TableCell({ borders, width: { size: colWidths[0], type: WidthType.DXA }, margins: cellMargins, verticalAlign: "center",
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: emoji, size: 28 })] })] }),
      new TableCell({ borders, width: { size: colWidths[1], type: WidthType.DXA }, margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun({ text: name, bold: true })] })] }),
      new TableCell({ borders, width: { size: colWidths[2], type: WidthType.DXA }, margins: cellMargins,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun(value)] })] }),
      new TableCell({ borders, width: { size: colWidths[3], type: WidthType.DXA }, margins: cellMargins,
        children: [new Paragraph({ children: [new TextRun(desc)] })] }),
    ]
  });
}

function headerRow(texts, colWidths, fillColor) {
  return new TableRow({
    children: texts.map((t, i) => new TableCell({
      borders, width: { size: colWidths[i], type: WidthType.DXA }, margins: cellMargins,
      shading: { fill: fillColor || "5D4037", type: ShadingType.CLEAR },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, color: fillColor ? "000000" : "FFFFFF", font: "Arial" })] })]
    }))
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "5D4037" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "795548" },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "8D6E63" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ]},
      { reference: "phases", levels: [
        { level: 0, format: LevelFormat.UPPER_LETTER, text: "Faza %1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 720 } } } },
      ]},
      { reference: "numbers1", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
      { reference: "numbers2", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
      { reference: "numbers3", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
    ]
  },
  sections: [
    // ═══════════════════ TITLE PAGE ═══════════════════
    {
      properties: {
        page: { size: { width: PAGE_WIDTH, height: 16838 }, margin: { top: 2880, right: MARGIN, bottom: MARGIN, left: MARGIN } }
      },
      children: [
        emptyLine(), emptyLine(), emptyLine(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
          children: [new TextRun({ text: "\uD83D\uDC07 \uD83D\uDC11 \uD83D\uDC37 \uD83D\uDC04", size: 72 })] }),
        emptyLine(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
          children: [new TextRun({ text: "WSPÓLNE PASTWISKO", size: 56, bold: true, color: "5D4037", font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
          children: [new TextRun({ text: "Gra o tragedii wspólnego pastwiska", size: 28, italics: true, color: "795548" })] }),
        emptyLine(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "A1887F", space: 8 } },
          children: [] }),
        emptyLine(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 },
          children: [new TextRun({ text: "Instrukcja gry", size: 32, color: "5D4037" })] }),
        emptyLine(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
          children: [new TextRun({ text: "Cyfrowa adaptacja gry planszowej", size: 22, color: "8D6E63" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
          children: [
            new TextRun({ text: "na podstawie gry platformowej stworzonej przez ", size: 22, color: "8D6E63" }),
            new TextRun({ text: "Jarosława Flisa", size: 22, color: "8D6E63", bold: true }),
          ] }),
        emptyLine(), emptyLine(), emptyLine(), emptyLine(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
          children: [new TextRun({ text: "Wersja cyfrowa do użytku dydaktycznego", size: 20, color: "A1887F" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Socjologia Środowiskowa", size: 20, color: "A1887F" })] }),
      ]
    },

    // ═══════════════════ MAIN CONTENT ═══════════════════
    {
      properties: {
        page: { size: { width: PAGE_WIDTH, height: 16838 }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } }
      },
      headers: {
        default: new Header({ children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "D7CCC8", space: 4 } },
          children: [new TextRun({ text: "Wspólne Pastwisko — Instrukcja gry", size: 18, color: "A1887F", italics: true })]
        })] })
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Strona ", size: 18, color: "A1887F" }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "A1887F" })]
        })] })
      },
      children: [
        // ─── 1. WPROWADZENIE ───
        heading1("1. Wprowadzenie"),
        para([
          new TextRun("Wspólne Pastwisko to wieloosobowa gra symulacyjna ilustrująca "),
          bold("tragedię wspólnego pastwiska"),
          new TextRun(" (ang. "),
          new TextRun({ text: "Tragedy of the Commons", italics: true }),
          new TextRun(") — sytuację, w której jednostki działające racjonalnie we własnym interesie niszczą wspólny zasób."),
        ]),
        para("Gra została zaprojektowana jako narzędzie dydaktyczne do zajęć z Socjologii Środowiskowej. Studenci doświadczają na własnej skórze, jak indywidualne decyzje wpływają na wspólne dobro — i jak komunikacja (lub jej brak) zmienia dynamikę grupy."),

        heading2("1.1. Cel gry"),
        para([
          new TextRun("Każdy gracz zarządza swoim stadem zwierząt pasących się na "),
          bold("wspólnym pastwisku"),
          new TextRun(". Celem jest "),
          bold("zgromadzenie jak najwartościowszego stada"),
          new TextRun(". Jednakże pastwisko ma ograniczoną pojemność — jeśli suma wartości wszystkich stad przekroczy pojemność pastwiska, następuje "),
          bold("klęska głodu"),
          new TextRun(", niszcząca stada wszystkich graczy."),
        ]),

        heading2("1.2. Struktura rozgrywki"),
        para("Gra składa się z dwóch części:"),
        new Paragraph({ numbering: { reference: "numbers1", level: 0 }, spacing: { after: 80 },
          children: [bold("Gra 1 — Bez komunikacji"), new TextRun(" — gracze nie mogą ze sobą rozmawiać. Demonstruje czystą tragedię wspólnego pastwiska.")] }),
        new Paragraph({ numbering: { reference: "numbers1", level: 0 }, spacing: { after: 120 },
          children: [bold("Gra 2 — Z komunikacją"), new TextRun(" — gracze mogą swobodnie rozmawiać i negocjować. Pokazuje wpływ komunikacji na zarządzanie wspólnym zasobem.")] }),
        para("Po zakończeniu obu gier następuje porównanie wyników — czy komunikacja pomogła uchronić pastwisko?"),

        // ─── 2. ZWIERZĘTA ───
        heading1("2. Zwierzęta"),
        para("W grze występują cztery typy zwierząt, różniące się wartością (koszt utrzymania na pastwisku):"),
        emptyLine(),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [1200, 2000, 1500, 4326],
          rows: [
            headerRow(["", "Zwierzę", "Wartość", "Opis"], [1200, 2000, 1500, 4326]),
            animalRow("\uD83D\uDC07", "Królik", "1", "Najtańsze zwierzę, najłatwiej dostępne"),
            animalRow("\uD83D\uDC11", "Owca", "2", "Dwukrotnie wartościowsza od królika"),
            animalRow("\uD83D\uDC37", "Świnia", "4", "Średnia wartość, ograniczona dostępność"),
            animalRow("\uD83D\uDC04", "Krowa", "8", "Najcenniejsze zwierzę, bardzo rzadkie"),
          ]
        }),
        emptyLine(),
        para([
          new TextRun("Wartość zwierzęcia oznacza jednocześnie "),
          bold("ile miejsca zajmuje na pastwisku"),
          new TextRun(". Krowa (wartość 8) zajmuje 8 razy więcej miejsca niż królik (wartość 1)."),
        ]),

        // ─── 3. WARUNKI POCZĄTKOWE ───
        heading1("3. Warunki początkowe"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Każdy gracz zaczyna z "), bold("2 królikami"), new TextRun(" (wartość stada = 2).")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Pojemność pastwiska = "), bold("4 × liczba graczy"), new TextRun(". Np. przy 10 graczach pastwisko mieści 40 jednostek.")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Pula dostępnych zwierząt: "), bold("3n królików, 2n owiec, n świń, n/3 krów"), new TextRun(" (n = liczba graczy).")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 120 },
          children: [new TextRun("Czas na decyzję w każdej fazie: "), bold("5 minut"), new TextRun(" (konfigurowalne przez prowadzącego).")] }),

        // ─── 4. PRZEBIEG RUNDY ───
        heading1("4. Przebieg rundy"),
        para("Każda runda składa się z czterech faz, następujących zawsze w tej samej kolejności:"),
        emptyLine(),

        // Phase A
        heading2("Faza A — Dobranie zwierząt"),
        para([
          new TextRun("Każdy gracz "),
          bold("jednocześnie"),
          new TextRun(" wybiera, jakie zwierzęta chce pozyskać z puli. Limit dobrania wynosi "),
          bold("maksymalnie tyle jednostek, ile wynosi obecna wartość twojego stada"),
          new TextRun(" (ale nie mniej niż 2). Np. jeśli masz stado warte 6 jednostek, możesz dobrać zwierzęta o łącznej wartości do 6."),
        ]),
        para([
          bold("Konflikty: "),
          new TextRun("Jeśli gracze chcą więcej zwierząt danego typu niż jest w puli, następuje proporcjonalny podział z losowym rozstrzygnięciem remisów."),
        ]),
        para([
          bold("Nie wybrałeś? "),
          new TextRun("Jeśli czas minie i nie zatwierdzisz wyboru, nie dostajesz niczego w tej rundzie."),
        ]),
        emptyLine(),

        // Phase B
        heading2("Faza B — Sprawdzenie pastwiska (klęska głodu)"),
        para("System automatycznie sprawdza, czy łączna wartość wszystkich stad mieści się na pastwisku:"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Jeśli "), bold("suma stad \u2264 pojemność pastwiska"), new TextRun(" — wszystko w porządku, przechodzimy do Fazy C.")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Jeśli "), bold("suma stad > pojemność"), new TextRun(" — następuje "), bold("KLĘSKA GŁODU!"), new TextRun("")] }),
        emptyLine(),
        heading3("Co się dzieje podczas klęski głodu?"),
        new Paragraph({ numbering: { reference: "numbers2", level: 0 }, spacing: { after: 80 },
          children: [bold("Pastwisko się kurczy"), new TextRun(" — pojemność zmniejsza się o liczbę graczy.")] }),
        new Paragraph({ numbering: { reference: "numbers2", level: 0 }, spacing: { after: 80 },
          children: [bold("Ubój stad"), new TextRun(" — każdy gracz traci zwierzęta warte około połowy wartości swojego stada. Najdroższe zwierzęta giną jako pierwsze.")] }),
        new Paragraph({ numbering: { reference: "numbers2", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Ubój powtarza się, dopóki stada nie zmieszczą się na pastwisku.")] }),
        new Paragraph({ numbering: { reference: "numbers2", level: 0 }, spacing: { after: 120 },
          children: [new TextRun("Gracz, którego stado spadnie do wartości 0, zostaje "), bold("wyeliminowany"), new TextRun(".")] }),
        para([
          new TextRun({ text: "\u26A0 Uwaga: ", bold: true, color: "D32F2F" }),
          new TextRun("Klęska głodu karze WSZYSTKICH graczy, nawet tych ostrożnych. To sedno tragedii wspólnego pastwiska — wystarczy, że kilka osób będzie chciwych."),
        ]),
        emptyLine(),

        // Phase C
        heading2("Faza C — Danina"),
        para([
          new TextRun("Każdy gracz "),
          bold("oddaje jedno zwierzę"),
          new TextRun(" ze swojego stada z powrotem na pastwisko. Pojemność pastwiska rośnie o wartość oddanego zwierzęcia."),
        ]),
        para([
          new TextRun("Np. oddanie krowy (wartość 8) zwiększy pojemność o 8. Oddanie królika — tylko o 1."),
        ]),
        para([
          bold("Zwolnienie: "),
          new TextRun("Jeśli masz tylko 1 zwierzę, jesteś zwolniony z daniny (nie można oddać ostatniego zwierzęcia)."),
        ]),
        para([
          bold("Nie wybrałeś? "),
          new TextRun("Po upływie czasu automatycznie oddawane jest najtańsze zwierzę z twojego stada."),
        ]),
        emptyLine(),

        // Phase D
        heading2("Faza D — Porachunki (kara)"),
        para([
          new TextRun("Każdy gracz może "),
          bold("ukarać jednego innego gracza"),
          new TextRun(". Kara jest kosztowna — oba strony tracą:"),
        ]),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [bold("Karzący"), new TextRun(" traci swoje najtańsze zwierzę")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [bold("Karany"), new TextRun(" traci swoje najtańsze zwierzę")] }),
        emptyLine(),
        para("Jeden gracz może zostać ukarany przez wielu graczy jednocześnie (traci po jednym zwierzęciu za każdą karę)."),
        para([
          bold("Ograniczenia: "),
          new TextRun("Nie możesz karać, jeśli masz tylko 1 zwierzę. Gracz nie może zostać ukarany poniżej 1 zwierzęcia."),
        ]),
        para([
          bold("Komu wyświetlają się imiona? "),
          new TextRun("Po rozstrzygnięciu porachunków każdy gracz widzi, kto go ukarał i jakie zwierzę stracił."),
        ]),
        para([
          new TextRun({ text: "Strategia: ", bold: true, italics: true }),
          new TextRun({ text: "Kara jest narzędziem społecznym — można nią dyscyplinować graczy, którzy nadmiernie eksploatują pastwisko. Ale pamiętaj, że kara kosztuje też ciebie!", italics: true }),
        ]),

        new Paragraph({ children: [new PageBreak()] }),

        // ─── 5. KONIEC GRY ───
        heading1("5. Koniec gry"),
        para("Gra kończy się, gdy zajdzie jeden z poniższych warunków:"),
        emptyLine(),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [4000, 5026],
          rows: [
            headerRow(["Warunek", "Opis"], [4000, 5026]),
            new TableRow({ children: [
              new TableCell({ borders, width: { size: 4000, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [bold("Limit rund")] })] }),
              new TableCell({ borders, width: { size: 5026, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun("Rozegrano ustaloną liczbę rund (5, 10 lub 15)")] })] }),
            ]}),
            new TableRow({ children: [
              new TableCell({ borders, width: { size: 4000, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [bold("Klęski głodu")] })] }),
              new TableCell({ borders, width: { size: 5026, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun("Wystąpiły 2 klęski głodu (lub 3 w trybie nieskończonym)")] })] }),
            ]}),
            new TableRow({ children: [
              new TableCell({ borders, width: { size: 4000, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [bold("Pusta pula")] })] }),
              new TableCell({ borders, width: { size: 5026, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun("Wszystkie zwierzęta z puli zostały zabrane")] })] }),
            ]}),
            new TableRow({ children: [
              new TableCell({ borders, width: { size: 4000, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [bold("Decyzja prowadzącego")] })] }),
              new TableCell({ borders, width: { size: 5026, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun("Prowadzący może zakończyć grę w dowolnym momencie")] })] }),
            ]}),
          ]
        }),
        emptyLine(),
        para([
          bold("Wynik końcowy"),
          new TextRun(" = wartość twojego stada w momencie zakończenia gry. Wygrywa gracz z najwartościowszym stadem."),
        ]),
        para([
          new TextRun("Po grze wyświetlany jest "),
          bold("współczynnik Giniego"),
          new TextRun(" — miara nierówności w grupie (0 = pełna równość, 1 = skrajna nierówność)."),
        ]),

        // ─── 6. TRYB NIESKOŃCZONY ───
        heading1("6. Tryb nieskończony"),
        para("Prowadzący może wybrać tryb bez limitu rund. W tym trybie:"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Gra trwa bez ograniczeń rundowych")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Gra kończy się po "), bold("3 klęskach głodu"), new TextRun(" (zamiast 2)")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 120 },
          children: [new TextRun("Lub gdy prowadzący zdecyduje o zakończeniu")] }),

        // ─── 7. DWA ETAPY GRY ───
        heading1("7. Dwa etapy — porównanie"),
        heading2("Gra 1 — Bez komunikacji"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Gracze "), bold("nie mogą ze sobą rozmawiać"), new TextRun(" (cisza na sali!)")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Każdy podejmuje decyzje samodzielnie")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 120 },
          children: [new TextRun("Symulacja czystej tragedii wspólnego pastwiska")] }),

        heading2("Gra 2 — Z komunikacją"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Gracze "), bold("mogą swobodnie rozmawiać"), new TextRun(", negocjować, zawierać umowy")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Stada i pastwisko resetują się — świeży start")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 120 },
          children: [new TextRun("Pokazuje, czy komunikacja pomaga chronić wspólny zasób")] }),

        para([
          new TextRun("Po obu grach wyświetla się "),
          bold("ekran porównania"),
          new TextRun(" — ile rund przetrwało pastwisko, ile było klęsk, jaka nierówność."),
        ]),

        // ─── 8. ZNACZENIE MECHANIZMÓW ───
        heading1("8. Co symbolizują mechanizmy gry?"),
        emptyLine(),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [2800, 6226],
          rows: [
            headerRow(["Mechanizm", "Znaczenie w rzeczywistości"], [2800, 6226]),
            ...[
              ["Pastwisko", "Wspólny zasób naturalny (woda, powietrze, ryby, lasy, klimat)"],
              ["Zwierzęta", "Eksploatacja zasobu — im więcej bierzesz, tym bardziej obciążasz wspólne dobro"],
              ["Pojemność pastwiska", "Nośność środowiska (ang. carrying capacity) — maksymalna eksploatacja, którą ekosystem wytrzyma"],
              ["Klęska głodu", "Katastrofa ekologiczna — następuje gdy eksploatacja przekracza możliwości regeneracji"],
              ["Danina", "Podatek ekologiczny, inwestycja we wspólne dobro, restytucja środowiska"],
              ["Kara (porachunki)", "Sankcje społeczne — możliwość dyscyplinowania tych, którzy nadmiernie eksploatują (ale kosztem własnym)"],
              ["Gra 1 (cisza)", "Brak koordynacji — tak działa rynek bez regulacji"],
              ["Gra 2 (rozmowa)", "Instytucje, negocjacje, umowy społeczne — zarządzanie wspólnym dobrem"],
              ["Wsp. Giniego", "Nierówność społeczna — czy korzyści z zasobu rozkładają się równomiernie?"],
            ].map(([mech, meaning]) => new TableRow({ children: [
              new TableCell({ borders, width: { size: 2800, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [bold(mech)] })] }),
              new TableCell({ borders, width: { size: 6226, type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun(meaning)] })] }),
            ]}))
          ]
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ─── 9. INSTRUKCJA DLA GRACZA ───
        heading1("9. Instrukcja dla gracza (krok po kroku)"),
        new Paragraph({ numbering: { reference: "numbers3", level: 0 }, spacing: { after: 100 },
          children: [new TextRun("Zeskanuj "), bold("QR kod"), new TextRun(" wyświetlony na ekranie prowadzącego (lub wpisz adres ręcznie).")] }),
        new Paragraph({ numbering: { reference: "numbers3", level: 0 }, spacing: { after: 100 },
          children: [new TextRun("Wpisz "), bold("4-znakowy kod pokoju"), new TextRun(" i swoje "), bold("imię"), new TextRun(". Kliknij Dołącz.")] }),
        new Paragraph({ numbering: { reference: "numbers3", level: 0 }, spacing: { after: 100 },
          children: [new TextRun("Czekaj na rozpoczęcie gry przez prowadzącego.")] }),
        new Paragraph({ numbering: { reference: "numbers3", level: 0 }, spacing: { after: 100 },
          children: [bold("Faza A"), new TextRun(": Wybierz zwierzęta do pozyskania i kliknij "), bold("Zatwierdź"), new TextRun(".")] }),
        new Paragraph({ numbering: { reference: "numbers3", level: 0 }, spacing: { after: 100 },
          children: [bold("Faza B"), new TextRun(": Obserwuj — system sprawdza, czy stada mieszczą się na pastwisku.")] }),
        new Paragraph({ numbering: { reference: "numbers3", level: 0 }, spacing: { after: 100 },
          children: [bold("Faza C"), new TextRun(": Wybierz zwierzę do oddania i kliknij "), bold("Zatwierdź"), new TextRun(".")] }),
        new Paragraph({ numbering: { reference: "numbers3", level: 0 }, spacing: { after: 100 },
          children: [bold("Faza D"), new TextRun(": Zdecyduj, czy chcesz kogoś ukarać. Wybierz gracza lub kliknij "), bold("Nie karzę"), new TextRun(".")] }),
        new Paragraph({ numbering: { reference: "numbers3", level: 0 }, spacing: { after: 100 },
          children: [new TextRun("Powtarzaj od kroku 4 w kolejnych rundach.")] }),
        new Paragraph({ numbering: { reference: "numbers3", level: 0 }, spacing: { after: 120 },
          children: [new TextRun("Na koniec sprawdź swój wynik i porównaj z innymi!")] }),
        emptyLine(),
        para([
          new TextRun({ text: "Wskazówka: ", bold: true, color: "2E7D32" }),
          new TextRun("Jeśli przypadkowo odświeżysz stronę — nie martw się! Gra automatycznie połączy cię z powrotem."),
        ]),

        // ─── 10. INSTRUKCJA DLA PROWADZĄCEGO ───
        heading1("10. Instrukcja dla prowadzącego"),
        heading2("Uruchomienie"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Wersja online: otwórz adres gry w przeglądarce")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Wersja offline: kliknij dwukrotnie "), bold("URUCHOM.command"), new TextRun(" (Mac) lub "), bold("URUCHOM.bat"), new TextRun(" (Windows)")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Otwórz "), bold("panel prowadzącego"), new TextRun(" (dashboard) w przeglądarce")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 120 },
          children: [new TextRun("Wyświetl ekran na projektorze — studenci zobaczą QR kod")] }),

        heading2("Konfiguracja (przed rozpoczęciem)"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [bold("Liczba rund"), new TextRun(": 5, 10, 15 lub nieskończoność")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [bold("Czas na fazę"), new TextRun(": 15s do 5 minut (domyślnie 5 minut)")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 120 },
          children: [bold("Anonimowość kar"), new TextRun(": włącz/wyłącz w panelu sterowania")] }),

        heading2("Podczas gry"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Przycisk "), bold("Dalej"), new TextRun(" — przejście do następnej fazy (wymagane po każdej fazie automatycznej)")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Przycisk "), bold("Pauza"), new TextRun(" — wstrzymuje timer (np. na pytania)")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Przycisk "), bold("Pomiń fazę"), new TextRun(" — wymusza zakończenie fazy (niedecydujący gracze dostają wartości domyślne)")] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 120 },
          children: [new TextRun("Przycisk "), bold("Zakończ grę"), new TextRun(" — natychmiast kończy bieżącą grę")] }),

        heading2("Scenariusz zajęć (sugerowany)"),
        new Paragraph({ numbering: { reference: "numbers2", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Krótkie wprowadzenie teoretyczne (5 min)")] }),
        new Paragraph({ numbering: { reference: "numbers2", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Gra 1 — bez komunikacji (15-20 min)")] }),
        new Paragraph({ numbering: { reference: "numbers2", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Krótka dyskusja: co się stało? (5 min)")] }),
        new Paragraph({ numbering: { reference: "numbers2", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Gra 2 — z komunikacją (15-20 min)")] }),
        new Paragraph({ numbering: { reference: "numbers2", level: 0 }, spacing: { after: 80 },
          children: [new TextRun("Porównanie wyników i dyskusja (10-15 min)")] }),

        emptyLine(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 2, color: "D7CCC8", space: 8 } },
          spacing: { before: 400 },
          children: [new TextRun({ text: "Miłej gry! \uD83D\uDC07\uD83D\uDC11\uD83D\uDC37\uD83D\uDC04", size: 24, color: "795548", italics: true })]
        }),
      ]
    }
  ]
});

const OUTPUT = "/Users/arkadiuszszlaga/PROJECTS/pastwisko/Instrukcja-Wspolne-Pastwisko.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log("Created: " + OUTPUT);
});
