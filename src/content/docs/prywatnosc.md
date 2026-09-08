---
title: Prywatność i cookies
description: "Jak KursN8N.pl traktuje prywatność: analityka Google tylko za zgodą, pomiar Cloudflare bez cookies, zero sprzedaży danych."
head:
  - tag: title
    content: "Prywatność, cookies i analityka | KursN8N.pl"
---

## Krótko

Strona liczy odwiedziny na dwa sposoby. Pierwszy nie wymaga Twojej zgody, bo nic nie
zapisuje na Twoim urządzeniu. Drugi to Google Analytics 4 i ten rusza dopiero wtedy, gdy
klikniesz "Akceptuję". Decyzję zmienisz w każdej chwili linkiem "Ustawienia cookies"
w stopce. Danych nikomu nie sprzedaję.

## Co strona zapisuje na Twoim urządzeniu

Zgody wymaga samo zapisanie lub odczytanie informacji w Twoim urządzeniu - tak stanowi
art. 399 ustawy Prawo komunikacji elektronicznej, obowiązującej od 10 listopada 2024.
Art. 399 ust. 3 zwalnia z tego to, co konieczne do świadczenia usługi, o którą sam
poprosiłeś. Dlatego pierwsza grupa poniżej działa bez pytania.

| Zapis | Do czego | Zgoda |
| --- | --- | --- |
| Wybrany motyw jasny lub ciemny | żeby strona wyglądała tak, jak ustawiłeś | nie jest wymagana |
| Twoja decyzja o cookies | żebym nie pytał przy każdej wizycie i umiał wykazać zgodę | nie jest wymagana |
| Kopia strony zastępczej offline | żeby coś się otworzyło, gdy stracisz internet | nie jest wymagana |
| `_ga`, `_ga_HXB91H6WT6` | Google Analytics 4, rozróżnienie przeglądarek i sesji, 2 lata | wymagana |
| `_gcl_au` | pomiar skuteczności reklam Google, 90 dni | wymagana |

Trzy pierwsze pozycje to pamięć przeglądarki, nie pliki cookie. Nie opuszczają Twojego
urządzenia.

## Analityka Google

Ruch mierzy Google Analytics 4 wdrożone przez Google Tag Manager. Zbieram z tego liczbę
odwiedzin, oglądane podstrony, czas na stronie, źródło wejścia, przybliżoną lokalizację
na poziomie miasta oraz typ urządzenia i przeglądarki.

Google nie zapisuje Twojego adresu IP. Dla ruchu z Unii Europejskiej adres służy wyłącznie
do wyliczenia przybliżonej lokalizacji na serwerach w UE i jest natychmiast odrzucany -
opisuje to
[dokumentacja Google](https://support.google.com/analytics/answer/12017362).

Dane w Google Analytics przechowuję przez 14 miesięcy, po czym znikają automatycznie.

### Co dzieje się, zanim klikniesz

Mówię wprost, bo to jest ta część, którą polityki prywatności zwykle przemilczają.
Kontener Google Tag Manager ładuje się u każdego, kto wejdzie na stronę. Zanim podejmiesz
decyzję, nie zapisuje żadnego pliku cookie i nie tworzy Twojego identyfikatora, ale wysyła
do Google sygnał zawierający czas wizyty, typ przeglądarki, adres strony odsyłającej oraz
informację, czy trafiłeś tu z reklamy. To jest tak zwany tryb zaawansowany Google Consent
Mode v2.

Po kliknięciu "Tylko niezbędne" nic ponad to nie zostaje wysłane i żaden plik cookie nie
powstaje. Po kliknięciu "Akceptuję" ruszają pliki cookie wymienione w tabeli wyżej.

## Pomiar Cloudflare, bez zgody i bez cookies

Niezależnie od Twojej decyzji strona korzysta z Cloudflare Web Analytics. To narzędzie
nie zapisuje plików cookie, nie używa pamięci przeglądarki i nie rozpoznaje Cię po adresie
IP ani po konfiguracji urządzenia. Cloudflare stwierdza to wprost: _"We don't use any
client-side state (like cookies or localStorage) for analytics purposes"_
([blog Cloudflare](https://blog.cloudflare.com/privacy-first-web-analytics/)).

Skoro nic nie trafia na Twoje urządzenie i nic z niego nie jest odczytywane, art. 399 PKE
w ogóle się nie stosuje i nie mam o co pytać. Podstawą przetwarzania jest mój prawnie
uzasadniony interes w postaci wiedzy, które materiały są czytane - art. 6 ust. 1 lit. f
RODO. Możesz się temu sprzeciwić, pisząc na adres podany niżej.

## Marketing i remarketing

Zgoda marketingowa jest w banerze od początku, ale dziś nic nie uruchamia - nie prowadzę
kampanii reklamowych dla tej strony. Kiedy je uruchomię, ta zgoda pozwoli mi pokazywać Ci
reklamy tej wiki w usługach Google na podstawie wcześniejszej wizyty. Nie wywołuje to
wobec Ciebie żadnych skutków prawnych i nie zmienia tego, co widzisz na stronie.

## Newsletter

Zapis wymaga adresu e-mail i zaznaczenia zgody. Listę obsługuje Sendy zainstalowane na
moim serwerze, a nie zewnętrzna platforma marketingowa; wiadomości doręcza Amazon Simple
Email Service w regionie Europa - Frankfurt. Rezygnacja jednym kliknięciem w stopce każdej
wiadomości. Szczegóły opisuje [Regulamin](/regulamin).

## Komu przekazuję dane

| Odbiorca | W jakim zakresie |
| --- | --- |
| Cloudflare | hosting, dostarczanie strony, pomiar bez cookies |
| Google Ireland Limited | analityka i reklama, po wyrażeniu zgody |
| Amazon Web Services EMEA SARL | wysyłka newslettera, region Frankfurt |

Google Ireland korzysta z infrastruktury Google LLC w USA. Google LLC uczestniczy
w programie EU-US Data Privacy Framework, wobec którego Komisja Europejska wydała
10 lipca 2023 decyzję stwierdzającą odpowiedni stopień ochrony. Przekazanie odbywa się
więc na podstawie decyzji adekwatności.

Danych osobowych nie sprzedaję i nie udostępniam nikomu poza podmiotami z tabeli, które
przetwarzają je na moje zlecenie.

## Podstawy prawne

| Co przetwarzam | Podstawa |
| --- | --- |
| Pamięć niezbędna do działania strony | art. 399 ust. 3 PKE, usługa żądana przez Ciebie |
| Pomiar Cloudflare bez cookies | prawnie uzasadniony interes, art. 6 ust. 1 lit. f RODO |
| Analityka Google i marketing | Twoja zgoda, art. 6 ust. 1 lit. a RODO |
| Newsletter | Twoja zgoda, art. 6 ust. 1 lit. a RODO |
| Zapis Twojej decyzji o cookies | obowiązek wykazania zgody, art. 7 ust. 1 RODO |

## Twoje prawa

Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia
przetwarzania, sprzeciwu, przenoszenia oraz wycofania zgody w dowolnym momencie. Wycofanie
zgody nie wpływa na zgodność z prawem przetwarzania sprzed wycofania. Przysługuje Ci też
skarga do Prezesa Urzędu Ochrony Danych Osobowych.

Zgodę na cookies zmienisz bez pisania do mnie: link "Ustawienia cookies" w stopce otwiera
to samo okno, które widziałeś przy pierwszej wizycie.

## Administrator

Administratorem danych jest Łukasz Podgórski prowadzący działalność gospodarczą pod firmą
aitomate Łukasz Podgórski. Kontakt: <kontakt@lukaszpodgorski.pl>. Szczegółowe informacje
o przetwarzaniu, okresach przechowywania i pozostałych usługach znajdziesz w
[Polityce prywatności](https://aitomate.pl/polityka-prywatnosci).

Wersja tego dokumentu: **2026-09-08**. Przy każdej zmianie zakresu przetwarzania podbijam
tę datę oraz `CONSENT_VERSION` w kodzie, więc baner pyta Cię ponownie.
