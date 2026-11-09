"""
Test obciążeniowy webhooka n8n w Locust - test T-02 z poradnika
https://kursn8n.pl/porownanie-n8n-hostingow

Po stronie n8n potrzebujesz opublikowanego workflow:
Webhook (POST, ścieżka "test") -> Set -> Respond to Webhook.

Instalacja (Python 3.11 lub nowszy, najlepiej w osobnym venv):
    pip install -r requirements.txt

Uruchomienie z panelem w przeglądarce (http://localhost:8089):
    locust -f locustfile.py --host https://twoj-n8n.pl

Uruchomienie bez panelu - trzy profile obciążenia:
    locust -f locustfile.py --host https://twoj-n8n.pl --headless -u 10 -r 10 --run-time 30s
    locust -f locustfile.py --host https://twoj-n8n.pl --headless -u 50 -r 25 --run-time 60s
    locust -f locustfile.py --host https://twoj-n8n.pl --headless -u 100 -r 50 --run-time 120s

-u to liczba równoczesnych użytkowników, -r tempo ich dokładania na sekundę.
Dopisz --csv wyniki, żeby zapisać statystyki (z percentylami P50/P95/P99) do plików CSV.

Testuj tylko własną instancję. Uruchomienie tego skryptu na cudzym serwerze
to atak DoS, nie benchmark.
"""

import os
import time

from locust import HttpUser, between, task

# Ścieżka webhooka. Adres produkcyjny ma postać /webhook/<ścieżka>; adres testowy
# z edytora (/webhook-test/<ścieżka>) działa tylko podczas nasłuchiwania w edytorze.
WEBHOOK_PATH = os.environ.get("N8N_WEBHOOK_PATH", "/webhook/test")


class WebhookUser(HttpUser):
    """Wirtualny użytkownik, który wysyła POST z małym JSON-em na webhook n8n."""

    # Domyślny adres - podmień na swój albo podaj --host w wierszu poleceń.
    host = "https://twoj-n8n.pl"

    # Przerwa między zadaniami jednego użytkownika: losowo od 0,1 do 0,5 s.
    wait_time = between(0.1, 0.5)

    @task
    def post_webhook(self):
        """Jedno zadanie = jeden POST na webhook. Każdy status spoza 2xx to błąd."""
        payload = {
            "test": True,
            "timestamp": time.time(),
        }
        with self.client.post(
            WEBHOOK_PATH,
            json=payload,
            name="POST webhook",
            catch_response=True,
        ) as response:
            if response.status_code == 429:
                response.failure("429 - limit zapytań (rate limit) po stronie hostingu")
            elif response.status_code >= 500:
                response.failure(f"{response.status_code} - błąd serwera lub proxy")
            elif not 200 <= response.status_code < 300:
                response.failure(f"Nieoczekiwany status {response.status_code}")
            else:
                response.success()
