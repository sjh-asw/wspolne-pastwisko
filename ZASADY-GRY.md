# Wspólne Pastwisko — Zasady gry i przewodnik dla prowadzącego

## O grze

"Wspólne Pastwisko" to gra multiplayer rozgrywana w przeglądarce, oparta na grze planszowej Jarosława Flisa. Demonstruje **tragedię wspólnego pastwiska** (tragedy of the commons) — sytuację, w której jednostki działające we własnym interesie niszczą wspólne dobro.

Gracze są rolnikami dzielącymi jedno pastwisko. Hodują zwierzęta, które zajmują miejsce na pastwisku. Jeśli łączne zapotrzebowanie stad przekroczy pojemność pastwiska — następuje klęska głodu i zwierzęta giną.

---

## Przygotowanie

### Co potrzebujesz
- Laptop podłączony do projektora (panel prowadzącego)
- Studenci z telefonami i dostępem do internetu
- Adres gry: **https://wspolne-pastwisko.onrender.com**

### Przed zajęciami
- Wejdź na adres gry **2-3 minuty wcześniej** — darmowy serwer Render usypia po 15 min nieaktywności i potrzebuje chwili na obudzenie się

### Uruchomienie
1. Na laptopie otwórz adres gry → kliknij **"Panel prowadzącego"**
2. Na projektorze pojawi się **4-literowy kod pokoju** (duże litery)
3. Studenci na telefonach otwierają ten sam adres → klikają **"Dołącz do gry"** → wpisują kod z projektora i swoje imię
4. Na panelu prowadzącego widzisz listę dołączonych graczy
5. Gdy wszyscy dołączą — kliknij **"Rozpocznij Grę 1 — Bez komunikacji"**

---

## Zwierzęta

| Zwierzę | Emoji | Wartość | Ile zajmuje pastwiska |
|---------|-------|---------|----------------------|
| Królik  | 🐇   | 1       | 1                    |
| Owca    | 🐑   | 2       | 2                    |
| Świnia  | 🐷   | 4       | 4                    |
| Krowa   | 🐄   | 8       | 8                    |

Wartość zwierzęcia = ile punktów jest warte na koniec gry = ile pastwiska zajmuje.

---

## Warunki startowe

- Każdy gracz zaczyna z **2 królikami** (wartość stada = 2)
- **Pojemność pastwiska** = 4 × liczba graczy (np. 30 graczy → 120)
- W **puli** jest ograniczona liczba zwierząt do wzięcia:
  - Króliki: 3 × liczba graczy
  - Owce: 2 × liczba graczy
  - Świnie: 1 × liczba graczy
  - Krowy: liczba graczy ÷ 3 (zaokr. w dół)

---

## Przebieg rundy

Gra trwa **maksymalnie 5 rund**. Każda runda ma 4 fazy:

### Faza A — Dobranie zwierząt

Każdy gracz jednocześnie (i w tajemnicy) wybiera zwierzęta z puli, które chce dodać do swojego stada.

**Limit pobrania:**
- Możesz wziąć zwierzęta o łącznej wartości nie większej niż **twoja obecna wartość stada** (minimum 2)
- Przykład: masz stado warte 8 → możesz wziąć zwierzęta za max 8 (np. 1 krowę, albo 2 świnie, albo 4 owce itd.)
- Na starcie każdy ma stado warte 2, więc może wziąć za max 2 (np. 1 owcę albo 2 króliki)

**Ważne:** Im bogatszy gracz, tym więcej może brać — bogaci bogacą się szybciej.

Jeśli kilku graczy chce tego samego zwierzęcia, a w puli nie starcza — dzielone proporcjonalnie z losowym rozstrzyganiem remisów.

**Czas:** 30 sekund (Gra 1) / 20 sekund (Gra 2). Po upływie czasu — kto nie zatwierdził, nie dostaje nic.

---

### Faza B — Klęska głodu (automatyczna)

Serwer sprawdza: czy suma wartości wszystkich stad przekracza pojemność pastwiska?

**Jeśli NIE** — nic się nie dzieje, przechodzimy do Fazy C.

**Jeśli TAK — KLĘSKA GŁODU:**
1. **Pastwisko się kurczy** — pojemność spada o liczbę graczy (trwałe zniszczenie ekologiczne)
2. **Każdy gracz traci połowę wartości stada** — serwer automatycznie zabiera zwierzęta, zaczynając od najdroższych
3. Stracone zwierzęta wracają do puli
4. Jeśli po przycięciu stada wciąż nie mieszczą się na pastwisku — przycinanie powtarza się

---

### Faza C — Danina

Każdy gracz **musi oddać dokładnie 1 zwierzę** z powrotem na wspólne pastwisko. Sam wybiera które.

**Efekt:** Pojemność pastwiska rośnie o wartość oddanych zwierząt.

**Dylemat:**
- Oddanie królika (1) → minimalna pomoc dla pastwiska, minimalny koszt dla gracza
- Oddanie krowy (8) → ogromna pomoc dla pastwiska, ale ogromna strata dla gracza
- To jest serce gry: kto poświęci więcej dla dobra wspólnego?

Gracz z tylko 1 zwierzęciem jest zwolniony z daniny.

**Czas:** 30 sekund / 20 sekund.

---

### Faza D — Porachunki

Każdy gracz **może (ale nie musi)** ukarać jednego innego gracza.

**Koszt kary:** oboje (karzący i karany) tracą po 1 najtańszym zwierzęciu. Kara jest kosztowna dla obu stron.

**Zasady:**
- Gracz z tylko 1 zwierzęciem nie może karać (straciłby ostatnie)
- Gracz z tylko 1 zwierzęciem nie może być dalej karany
- Jeden gracz może być ukarany przez wielu — traci 1 zwierzę za każdego karzącego
- Stracone zwierzęta wracają do puli

**Czas:** 30 sekund / 20 sekund.

---

## Koniec gry

Gra kończy się gdy wystąpi **cokolwiek** z poniższych:
- Minęło **5 rund**
- Nastąpiły **2 klęski głodu**
- **Pula zwierząt** jest pusta
- Prowadzący **ręcznie zakończył** grę

**Wynik gracza** = wartość jego stada na koniec gry.

---

## Struktura sesji — dwie gry

Sesja składa się z **dwóch gier** rozgrywanych jedna po drugiej:

### Gra 1 — Bez komunikacji
- Studenci grają **w ciszy** — nie wolno rozmawiać
- Pokazuje tragedię: racjonalne decyzje jednostek prowadzą do ruiny wspólnej

### Gra 2 — Z komunikacją
- Prowadzący resetuje grę (nowe pastwisko, nowe stada, pełna pula)
- Studenci **mogą swobodnie rozmawiać**
- Timery skrócone do 20 sekund (studenci już znają interfejs)
- Pokazuje rozwiązanie: komunikacja, zaufanie i normy społeczne umożliwiają zarządzanie wspólnym dobrem

Na koniec wyświetlane jest **porównanie** obu gier.

---

## Sterowanie grą (panel prowadzącego)

Kliknij **⚙** (koło zębate) w prawym dolnym rogu panelu, aby otworzyć kontrolki:

| Przycisk | Działanie |
|----------|-----------|
| ⏸ Pauza | Zatrzymuje timer |
| ▶ Wznów | Wznawia grę |
| ⏭ Pomiń fazę | Wymusza koniec bieżącej fazy (gracze, którzy nie zdecydowali, dostają wartości domyślne) |
| ⏹ Zakończ grę | Natychmiast kończy grę |
| 🔄 Reset — Gra 2 | Resetuje wszystko i przechodzi do Gry 2 |
| 👁 Pokaż/ukryj nazwy | Przełącza anonimowość kar na dashboardzie |
| Timer 15s/30s/45s/60s | Zmienia czas na fazę |

---

## Co widzisz na panelu prowadzącego

- **Miernik pastwiska** — pasek pokazujący zapełnienie (zielony → żółty → pomarańczowy → czerwony)
- **Licznik klęsk głodu** — ile z max 2
- **Wykres** — pojemność pastwiska vs łączna wartość stad w kolejnych rundach (gdy linie się krzyżują = klęska)
- **Status fazy** — ilu graczy już zdecydowało (np. "Decyzje: 14/30 ✓")
- **Ranking** — top 5 i bottom 3 graczy wg wartości stada

---

## Aspekt dydaktyczny — czego uczą się studenci

### Tragedia wspólnego pastwiska (Garrett Hardin, 1968)
Gra bezpośrednio modeluje klasyczny problem z socjologii środowiskowej: gdy zasób jest wspólny i nieograniczony w dostępie, każda jednostka ma racjonalną motywację, by eksploatować go ponad miarę. Indywidualny zysk z dodatkowego zwierzęcia trafia do jednego gracza, ale koszty (degradacja pastwiska) rozkładają się na wszystkich. W efekcie — wszyscy tracą.

**Studenci doświadczają tego na własnej skórze w Grze 1.** Większość grup doprowadza do klęski głodu w ciągu 2-3 rund.

### Rozwiązanie Ostrom — zarządzanie wspólnym dobrem (Elinor Ostrom, Nobel 2009)
Elinor Ostrom udowodniła, że wspólne zasoby nie muszą być ani sprywatyzowane, ani zarządzane przez państwo. Społeczności mogą same zarządzać wspólnym dobrem, jeśli mają możliwość:

1. **Komunikacji** — mogą rozmawiać i ustalać reguły
2. **Monitorowania** — widzą, kto ile bierze (dashboard to umożliwia)
3. **Sankcji** — mogą karać łamiących zasady (Faza D)
4. **Budowania zaufania** — powtarzane interakcje tworzą normy

**Gra 2 (z komunikacją) to demonstruje.** Studenci zwykle:
- Ustalają limity pobierania
- Umawiają się na oddawanie cenniejszych zwierząt w daninie
- Grożą karami chciwym graczom (i je realizują)
- Osiągają znacznie lepsze wyniki zbiorowe

### Kosztowna kara (altruistic punishment)
Faza D modeluje zjawisko z ekonomii behawioralnej: ludzie są gotowi ponosić koszty, aby karać tych, którzy łamią normy społeczne — nawet gdy nie mają z tego bezpośredniego zysku. W Grze 1 kary są chaotyczne i nieefektywne (nikt nie wie, za co karze). W Grze 2 kary stają się narzędziem egzekwowania wspólnie ustalonych reguł.

### Nierówność a wspólne dobra
Mechanika "bogaci mogą brać więcej" (limit pobrania = wartość stada) pokazuje, jak nierówność napędza nadmierną eksploatację. Współczynnik Giniego wyświetlany na końcu pozwala zmierzyć, jak nierówna była dystrybucja zasobów.

### Degradacja ekologiczna jest nieodwracalna
Pastwisko po klęsce głodu **trwale się kurczy** — nie wraca do pierwotnego stanu. To modeluje realny problem: wyeksploatowane ekosystemy nie regenerują się automatycznie, nawet gdy presja ustanie.

---

## Porównanie gier — na co zwrócić uwagę w dyskusji

Po zakończeniu obu gier, na panelu pojawi się porównanie. Kluczowe pytania do dyskusji:

| Pytanie | Czego szukać |
|---------|-------------|
| Ile rund przetrwały obie gry? | Gra 2 zwykle trwa dłużej |
| Ile było klęsk głodu? | Gra 2 zwykle mniej lub zero |
| Jaka była średnia wartość stada? | Gra 2 zwykle wyższa — wszyscy zyskują na współpracy |
| Jak wyglądał współczynnik Giniego? | Gra 2 zwykle niższy — bardziej równy podział |
| Ile było kar? | Paradoks: w Grze 2 bywa ich więcej, ale są celowe i skuteczne |
| Jak wyglądał wykres pastwiska? | Gra 1: linie szybko się krzyżują. Gra 2: pastwisko rośnie dzięki daninom |

### Sugerowane pytania do studentów
1. Co czuliście, gdy ktoś wziął dużo zwierząt? Czy chcieliście go ukarać?
2. Czy w Grze 2 udało się ustalić wspólne zasady? Jakie?
3. Czy ktoś złamał ustalone zasady? Co się wtedy stało?
4. Kto oddawał krowy w daninie? Kto tylko króliki? Dlaczego?
5. Czy kary w Grze 1 miały sens? A w Grze 2?
6. Jak to się ma do realnych problemów środowiskowych (np. przełowienie, zanieczyszczenie powietrza, zmiana klimatu)?
7. Co by się stało, gdyby gra trwała 50 rund zamiast 5?

---

## Sugerowany harmonogram sesji (90 minut)

| Czas | Co się dzieje |
|------|--------------|
| 0:00–0:05 | Wprowadzenie: czym jest tragedia wspólnego pastwiska (2-3 zdania, bez spoilerów) |
| 0:05–0:10 | Studenci łączą się z grą na telefonach |
| 0:10–0:12 | Krótkie wyjaśnienie zasad (lub rozdaj wydrukowane) |
| 0:12–0:35 | **Gra 1 — Bez komunikacji** (cisza na sali!) |
| 0:35–0:40 | Omówienie wyników Gry 1, krótka dyskusja |
| 0:40–0:42 | Reset do Gry 2, wyjaśnienie: teraz wolno rozmawiać |
| 0:42–1:05 | **Gra 2 — Z komunikacją** |
| 1:05–1:10 | Porównanie wyników obu gier na projektorze |
| 1:10–1:30 | Dyskusja: Hardin, Ostrom, wspólne dobra, pytania do studentów |

---

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
|---------|-------------|
| Strona się nie ładuje | Serwer Render usnął — poczekaj 30 sekund i odśwież |
| Student nie widzi kodu pokoju | Niech odświeży stronę na telefonie |
| Student się rozłączył | Niech wpisze ten sam kod i to samo imię — odzyska swoje stado |
| Gra się zawiesiła na jednej fazie | Użyj "⏭ Pomiń fazę" w kontrolkach |
| Za mało czasu na decyzje | Zwiększ timer w kontrolkach (45s lub 60s) |
| Studenci kończą za szybko | Zmniejsz timer (15s) |
| Student dołączył za późno | Dostanie 2 króliki i dołączy od bieżącej rundy |
