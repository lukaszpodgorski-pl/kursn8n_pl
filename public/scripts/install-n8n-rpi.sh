#!/usr/bin/env bash
# ============================================================================
#  n8n installer for Raspberry Pi (Docker + PostgreSQL + Cloudflare Tunnel)
# ----------------------------------------------------------------------------
#  Version : 5.2
#  Released: 2026-11-09
#  License : MIT - Copyright (c) 2026 Lukasz Podgorski (kursn8n.pl)
#            https://github.com/lukaszpodgorski-pl/kursn8n_pl/blob/main/LICENSE
#  Docs    : https://kursn8n.pl/modul-1-instalacja-hosting#instalator-dla-raspberry-pi
# ----------------------------------------------------------------------------
#
#  DESCRIPTION
#    End-to-end installer for a self-hosted n8n instance on a Raspberry Pi
#    (64-bit OS; also works on any Debian-based arm64/amd64 Linux). It sets up
#    a single-instance stack and is safe to re-run.
#
#    The installer provisions:
#      - n8n in Docker, pinned to a tested 2.x version (N8N_VERSION below)
#      - PostgreSQL 15 with the pgvector extension (AI / embedding workflows)
#      - your own N8N_ENCRYPTION_KEY and DB password (openssl rand, .env 600)
#      - Cloudflare Tunnel for HTTPS access with no port-forwarding required
#      - daily local backups with 7-version rotation (DB + volume + config)
#      - restore from a backup archive, e.g. after moving to a new SD card/SSD
#      - n8n-update <version>: backup first, then switch the pinned version
#      - existing-installation detection to prevent accidental overwrites
#      - FHS paths, systemd unit for cloudflared, full install log
#      - UI in English / Polski / Deutsch
#
#  USAGE - download, READ, then run (do not pipe it into a shell):
#      curl -fsSLo install-n8n-rpi.sh https://kursn8n.pl/scripts/install-n8n-rpi.sh
#      less install-n8n-rpi.sh
#      sudo bash install-n8n-rpi.sh
#
#    After installation, the following admin commands are available in PATH:
#      sudo n8n-backup             - run a manual backup now
#      sudo n8n-restore --help     - restore from a local backup archive
#      sudo n8n-update <version>   - backup, then move to another n8n version
#
#  REQUIREMENTS
#    - Raspberry Pi 4 / 5 with a 64-bit OS (arm64), or Debian-based amd64
#    - 4 GB RAM minimum (8 GB recommended), SSD preferred over microSD
#    - a domain added to a Cloudflare account (for the tunnel)
#    - root privileges (sudo)
# ============================================================================

set -euo pipefail

# Force UTF-8 so the box-drawing UI renders correctly.
export LANG="${LANG:-C.UTF-8}"
export LC_ALL="${LC_ALL:-C.UTF-8}"

# -------- Paths (FHS-compliant) --------
N8N_DIR="/opt/n8n"
ENV_FILE="${N8N_DIR}/.env"
COMPOSE_FILE="${N8N_DIR}/docker-compose.yml"
INIT_DB_FILE="${N8N_DIR}/init-db.sh"
BACKUP_DIR="/var/lib/n8n/backups"
LOG_DIR="/var/log/n8n"
INSTALL_LOG="${LOG_DIR}/install.log"
BACKUP_SCRIPT="/usr/local/sbin/n8n-backup"
RESTORE_SCRIPT="/usr/local/sbin/n8n-restore"
UPDATE_SCRIPT="/usr/local/sbin/n8n-update"
CF_DIR="/etc/cloudflared"
LANG_CODE="EN"

# -------- Pinned images --------
# Written to .env and read by docker-compose.yml. n8n: stable 2.x verified for
# this release. Do not jump to 3.x here - the 2.x -> 3.x upgrade is one-way;
# follow the migration steps in Module 1 and use: sudo n8n-update --major 3.x.y
# (The helper container used by n8n-backup / n8n-restore is alpine:3.24.)
N8N_VERSION="2.46.6"
POSTGRES_IMAGE="pgvector/pgvector:0.8.7-pg15"
CURRENT_STEP="initialization"

# -------- Colors --------
if [ -t 1 ]; then
    BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
    RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
    BLUE=$'\033[34m'; MAGENTA=$'\033[35m'; CYAN=$'\033[36m'
else
    BOLD=""; DIM=""; RESET=""
    RED=""; GREEN=""; YELLOW=""; BLUE=""; MAGENTA=""; CYAN=""
fi

# -------- DOS / Norton Commander styling --------
if [ -t 1 ]; then
    DOS_BG=$'\033[44m'           # blue background
    DOS_FG=$'\033[1;97m'         # bright white text
    DOS_HI=$'\033[1;93m'         # bright yellow highlight
    DOS_OK=$'\033[1;92m'         # bright green
    DOS_ER=$'\033[1;91m'         # bright red
    DOS_CY=$'\033[1;96m'         # bright cyan
else
    DOS_BG=""; DOS_FG=""; DOS_HI=""; DOS_OK=""; DOS_ER=""; DOS_CY=""
fi

# Box-drawing characters (Unicode). Files are saved as UTF-8.
B_TL="╔"; B_TR="╗"; B_BL="╚"; B_BR="╝"; B_H="═"; B_V="║"
B_ML="╠"; B_MR="╣"

WIDTH=68
INNER=$((WIDTH-2))

# repeat a string N times
repeat_char() {
    local s="$1" n="$2" out=""
    local i
    for ((i=0; i<n; i++)); do out+="$s"; done
    printf '%s' "$out"
}

dos_top()   { printf "${DOS_BG}${DOS_FG}${B_TL}%s${B_TR}${RESET}\n" "$(repeat_char "$B_H" "$INNER")"; }
dos_bot()   { printf "${DOS_BG}${DOS_FG}${B_BL}%s${B_BR}${RESET}\n" "$(repeat_char "$B_H" "$INNER")"; }
dos_sep()   { printf "${DOS_BG}${DOS_FG}${B_ML}%s${B_MR}${RESET}\n" "$(repeat_char "$B_H" "$INNER")"; }
dos_empty() { printf "${DOS_BG}${DOS_FG}${B_V}%${INNER}s${B_V}${RESET}\n" ""; }

# dos_text "text" [color]   - left-aligned, single-space margin
dos_text() {
    local text="$1"
    local color="${2:-$DOS_FG}"
    local len=${#text}
    local pad=$((INNER - len - 2))
    [ "$pad" -lt 0 ] && pad=0
    printf "${DOS_BG}${DOS_FG}${B_V}${color} %s%${pad}s ${DOS_FG}${B_V}${RESET}\n" "$text" ""
}

# dos_center "text" [color]
dos_center() {
    local text="$1"
    local color="${2:-$DOS_FG}"
    local len=${#text}
    local left=$(( (INNER - len) / 2 ))
    local right=$(( INNER - len - left ))
    [ "$left" -lt 0 ] && left=0
    [ "$right" -lt 0 ] && right=0
    printf "${DOS_BG}${DOS_FG}${B_V}%${left}s${color}%s${DOS_FG}%${right}s${B_V}${RESET}\n" "" "$text" ""
}

# dos_kv "label" "value"   - two-column line: label left, value right
dos_kv() {
    local label="$1" value="$2"
    local llen=${#label} vlen=${#value}
    local space=$(( INNER - llen - vlen - 4 ))
    [ "$space" -lt 1 ] && space=1
    printf "${DOS_BG}${DOS_FG}${B_V} ${DOS_FG}%s%${space}s${DOS_HI}%s ${DOS_FG}${B_V}${RESET}\n" "$label" "" "$value"
}

clear_screen() { printf '\033[2J\033[H'; }

# -------- Error handling --------
init_logging() {
    mkdir -p "$LOG_DIR"
    chmod 750 "$LOG_DIR"
    : > "$INSTALL_LOG"
    chmod 640 "$INSTALL_LOG"
    # Mirror everything to the log file while keeping the TTY UI.
    exec > >(tee -a "$INSTALL_LOG") 2> >(tee -a "$INSTALL_LOG" >&2)
}

on_error() {
    local exit_code=$1
    local line_no=$2
    local cmd="${BASH_COMMAND:-unknown}"

    # Disable further traps so the error window itself cannot loop.
    trap - ERR EXIT

    printf "\n"
    dos_top
    dos_empty
    dos_center "$(t err_title)" "$DOS_ER"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t err_step)   ${CURRENT_STEP}" "$DOS_FG"
    dos_text "$(t err_line)   ${line_no}" "$DOS_FG"
    dos_text "$(t err_cmd)   ${cmd:0:55}" "$DOS_FG"
    dos_text "$(t err_exit)   ${exit_code}" "$DOS_FG"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t err_log)" "$DOS_HI"
    dos_text "   ${INSTALL_LOG}" "$DOS_CY"
    dos_empty
    if [ -s "$INSTALL_LOG" ]; then
        dos_text "$(t err_tail)" "$DOS_HI"
        local tail_line
        while IFS= read -r tail_line; do
            local trimmed="${tail_line//$'\r'/}"
            trimmed="${trimmed//$'\033'\[[0-9;]*m/}"
            dos_text "   ${trimmed:0:60}"
        done < <(tail -n 5 "$INSTALL_LOG" 2>/dev/null)
        dos_empty
        dos_sep
        dos_empty
    fi
    dos_text "$(t err_help)" "$DOS_HI"
    dos_text "   $(t err_help_1)"
    dos_text "   $(t err_help_2)"
    dos_text "   $(t err_help_3)"
    dos_empty
    dos_bot
    printf "\n"

    exit "$exit_code"
}

trap 'on_error $? $LINENO' ERR

# -------- i18n table --------
declare -A T_EN T_PL T_DE

# English
T_EN[banner_line]="================================================================"
T_EN[banner_title]="  N8N Installer for Raspberry Pi  -  v5.2"
T_EN[lang_prompt]="Language / Jezyk / Sprache"
T_EN[lang_select]="Select [1]:"
T_EN[need_root]="This script requires root privileges. Run as root or with sudo."
T_EN[not_rpi]="This script is optimized for Raspberry Pi but may work on other Debian-based systems."
T_EN[ask_continue]="Continue?"
T_EN[yes_no]="[y/n]:"
T_EN[menu_title]="Choose operation:"
T_EN[menu_fresh]="Fresh installation"
T_EN[menu_restore]="Restore from backup"
T_EN[menu_status]="Show status"
T_EN[menu_exit]="Exit"
T_EN[menu_prompt]="Selection [1]:"
T_EN[invalid_choice]="Invalid choice."
T_EN[step_check]="Checking environment"
T_EN[step_apt]="Updating package index"
T_EN[step_upgrade]="Upgrading system packages (this may take a while)"
T_EN[step_docker]="Installing Docker"
T_EN[err_title]="INSTALLATION FAILED"
T_EN[err_step]="Step:"
T_EN[err_line]="Line:"
T_EN[err_cmd]="Command:"
T_EN[err_exit]="Exit code:"
T_EN[err_log]="Full log:"
T_EN[err_tail]="Last lines from log:"
T_EN[err_help]="What to do:"
T_EN[err_help_1]="1) Check the log file shown above"
T_EN[err_help_2]="2) Verify network connectivity and disk space"
T_EN[err_help_3]="3) Re-run the installer - it is safe to retry"
T_EN[exist_title]="EXISTING INSTALLATION DETECTED"
T_EN[exist_intro]="The following components were found on this system:"
T_EN[exist_warn]="Continuing will OVERWRITE the existing configuration."
T_EN[exist_keep]="Docker volumes are preserved unless removed manually."
T_EN[exist_recommend]="RECOMMENDED before continuing - take a fresh backup:"
T_EN[exist_continue]="Continue anyway and overwrite?"
T_EN[exist_aborted]="Installation aborted. Existing setup left untouched."
T_EN[exist_proceeding]="Proceeding - existing configuration will be overwritten."
T_EN[step_autoupdate]="Installing the update command"
T_EN[autoupdate_on]="Update later with: sudo n8n-update <version> (backup runs first)."
T_EN[arch_hint]="n8n images exist only for arm64 and amd64 - install a 64-bit OS."
T_EN[notice_321]="Best practice: 3-2-1 rule - 3 copies, 2 media types, 1 off-site."
T_EN[notice_offsite_title]="OFF-SITE BACKUP POLICY"
T_EN[notice_responsibility]="Backups remain LOCAL by design. Off-site replication is the"
T_EN[notice_responsibility2]="operator's responsibility - this installer ships no credentials"
T_EN[notice_responsibility3]="for third-party storage."
T_EN[pulling_images]="Pulling Docker images (5-10 min on first run, logged to install.log)..."
T_EN[images_pulled]="Docker images pulled"
T_EN[pull_warn]="Image pull had issues, attempting to continue (check install.log)"
T_EN[creating_containers]="Creating and starting containers..."
T_EN[disc_title]="DISCLAIMER - PLEASE READ BEFORE CONTINUING"
T_EN[disc_l1]="This installer was prepared with care to avoid bugs."
T_EN[disc_l2]="However, it is provided AS-IS, without any warranty."
T_EN[disc_l3]="The author accepts no responsibility for damages caused"
T_EN[disc_l4]="by its use or any malfunction."
T_EN[disc_l5]="ALWAYS take a fresh backup before running this script"
T_EN[disc_l6]="on a system that already holds important data."
T_EN[disc_accept]="Do you accept these terms and continue?"
T_EN[disc_cancel]="Installation cancelled by user. Nothing has been changed."
T_EN[about_title]="ABOUT THIS INSTALLER"
T_EN[about_author]="Author:"
T_EN[about_version]="Version:"
T_EN[about_support]="Bugs and suggestions (GitHub issues):"
T_EN[about_source]="Source / docs:"
T_EN[about_thanks]="Thank you for using this installer."
T_EN[step_utils]="Installing utilities"
T_EN[step_secrets]="Generating secrets"
T_EN[step_config]="Creating n8n configuration"
T_EN[step_cf_install]="Installing Cloudflared"
T_EN[step_cf_tunnel]="Configuring Cloudflare Tunnel"
T_EN[step_cf_service]="Setting up Cloudflared service"
T_EN[step_backup]="Setting up automated backups"
T_EN[step_start]="Starting n8n"
T_EN[step_done]="Installation complete"
T_EN[docker_present]="Docker already installed:"
T_EN[docker_installed]="Docker installed:"
T_EN[docker_failed]="Docker installation failed."
T_EN[compose_present]="Docker Compose plugin already present:"
T_EN[arch_detected]="Detected architecture:"
T_EN[arch_unsupported]="Unsupported architecture:"
T_EN[cf_present]="Cloudflared already installed:"
T_EN[cf_dl]="Downloading Cloudflared from:"
T_EN[cf_dl_failed]="Failed to download Cloudflared."
T_EN[ask_domain]="Domain for n8n (e.g. n8n.example.com):"
T_EN[ask_tz]="Timezone [Europe/Warsaw]:"
T_EN[ask_tunnel]="Cloudflare tunnel name [n8n-tunnel]:"
T_EN[secrets_generated]="Secrets generated and saved to:"
T_EN[secrets_reused]="Existing DB password and encryption key kept from:"
T_EN[cf_warning]="You need a domain added to Cloudflare. A browser login window will open."
T_EN[cf_tunnel_exists]="Tunnel already exists, reusing it. ID:"
T_EN[cf_tunnel_creating]="Creating tunnel:"
T_EN[cf_tunnel_created]="Tunnel created. ID:"
T_EN[cf_tunnel_id_fail]="Could not extract tunnel ID."
T_EN[cf_tunnel_id_manual]="Enter tunnel ID manually:"
T_EN[cf_id_invalid]="Invalid UUID format. Aborting."
T_EN[cf_cred_not_found]="Credential file not found. Enter path manually:"
T_EN[cf_cred_missing]="File does not exist. Aborting."
T_EN[cf_service_active]="Cloudflared service is active."
T_EN[cf_service_fail]="Cloudflared service failed to start. Check: journalctl -u cloudflared"
T_EN[backup_cron_set]="Backups will run daily at 03:XX."
T_EN[backup_created]="Backup script created:"
T_EN[restore_created]="Restore script created:"
T_EN[n8n_running]="n8n container is running."
T_EN[n8n_failed]="n8n container did not start. Check: docker logs n8n-main"
T_EN[summary_url]="Your n8n is available at:"
T_EN[summary_files]="Files:"
T_EN[summary_creds]="Generated credentials (saved to .env):"
T_EN[summary_save]="SAVE THE ENCRYPTION KEY IN A SAFE PLACE!"
T_EN[summary_user]="DB user:"
T_EN[summary_pass]="DB password:"
T_EN[summary_key]="Encryption key:"
T_EN[restore_title]="Restore mode"
T_EN[restore_no_local]="No local backups found in"
T_EN[restore_no_local_help]="Copy a backup file (n8n_full_backup_*.tar.gz) to that directory, then run this script again."
T_EN[restore_examples]="Examples to copy a backup ONTO the Pi:"
T_EN[restore_list]="Available backups:"
T_EN[restore_select]="Select backup number (empty = newest):"
T_EN[restore_not_found]="Selected backup not found."
T_EN[restore_warning]="This will replace the current n8n installation!"
T_EN[restore_stopping]="Stopping services"
T_EN[restore_unpacking]="Unpacking backup"
T_EN[restore_compose]="Restoring docker-compose.yml"
T_EN[restore_env]="Restoring .env"
T_EN[restore_db]="Restoring database"
T_EN[restore_db_wait]="Waiting for PostgreSQL"
T_EN[restore_db_import]="Importing database dump"
T_EN[restore_volume]="Restoring n8n volume"
T_EN[restore_cf]="Restoring Cloudflare config"
T_EN[restore_starting]="Starting services"
T_EN[restore_done]="Restore complete."
T_EN[status_title]="Status:"
T_EN[status_n8n_up]="n8n: running"
T_EN[status_n8n_down]="n8n: stopped"
T_EN[status_cf_up]="Cloudflared: running"
T_EN[status_cf_down]="Cloudflared: stopped"
T_EN[notice_title]="BACKUP NOTICE - PLEASE READ"
T_EN[notice_local]="Backups are stored LOCALLY at:"
T_EN[notice_schedule]="Daily at 03:XX, last 7 backups kept (auto-rotation)."
T_EN[notice_warn]="WARNING: SD card / disk failure = all backups lost too."
T_EN[notice_action]="You MUST copy backups OFF the Raspberry Pi regularly. Examples:"
T_EN[notice_ex_pull]="From another machine (pull over SSH):"
T_EN[notice_ex_usb]="To a USB drive plugged into the Pi:"
T_EN[notice_ex_cloud]="To cloud storage (using rclone):"
T_EN[bye]="Bye."

# Polish
T_PL[banner_line]="================================================================"
T_PL[banner_title]="  Instalator N8N dla Raspberry Pi  -  v5.2"
T_PL[lang_prompt]="Language / Jezyk / Sprache"
T_PL[lang_select]="Wybor [1]:"
T_PL[need_root]="Ten skrypt wymaga uprawnien root. Uruchom jako root lub przez sudo."
T_PL[not_rpi]="Skrypt jest zoptymalizowany dla Raspberry Pi, ale moze dzialac na innych systemach Debian."
T_PL[ask_continue]="Kontynuowac?"
T_PL[yes_no]="[t/n]:"
T_PL[menu_title]="Wybierz operacje:"
T_PL[menu_fresh]="Swieza instalacja"
T_PL[menu_restore]="Przywracanie z backupu"
T_PL[menu_status]="Pokaz status"
T_PL[menu_exit]="Wyjscie"
T_PL[menu_prompt]="Wybor [1]:"
T_PL[invalid_choice]="Nieprawidlowy wybor."
T_PL[step_check]="Sprawdzanie srodowiska"
T_PL[step_apt]="Aktualizacja indeksu pakietow"
T_PL[step_upgrade]="Aktualizacja pakietow systemu (moze zajac chwile)"
T_PL[step_docker]="Instalacja Docker"
T_PL[err_title]="INSTALACJA NIE POWIODLA SIE"
T_PL[err_step]="Krok:"
T_PL[err_line]="Linia:"
T_PL[err_cmd]="Komenda:"
T_PL[err_exit]="Kod wyjscia:"
T_PL[err_log]="Pelny log:"
T_PL[err_tail]="Ostatnie linie logu:"
T_PL[err_help]="Co zrobic:"
T_PL[err_help_1]="1) Sprawdz plik logu pokazany powyzej"
T_PL[err_help_2]="2) Zweryfikuj polaczenie sieciowe i miejsce na dysku"
T_PL[err_help_3]="3) Uruchom instalator ponownie - mozna bezpiecznie powtorzyc"
T_PL[exist_title]="WYKRYTO ISTNIEJACA INSTALACJE"
T_PL[exist_intro]="Znaleziono nastepujace komponenty w systemie:"
T_PL[exist_warn]="Kontynuacja NADPISZE istniejaca konfiguracje."
T_PL[exist_keep]="Wolumeny Docker zostana zachowane (chyba ze usuniete recznie)."
T_PL[exist_recommend]="ZALECANE przed kontynuacja - wykonaj swiezy backup:"
T_PL[exist_continue]="Kontynuowac mimo to i nadpisac?"
T_PL[exist_aborted]="Instalacja przerwana. Istniejaca konfiguracja nie zostala ruszona."
T_PL[exist_proceeding]="Kontynuuje - istniejaca konfiguracja zostanie nadpisana."
T_PL[step_autoupdate]="Instalacja polecenia aktualizacji"
T_PL[autoupdate_on]="Aktualizacja pozniej: sudo n8n-update <wersja> (najpierw backup)."
T_PL[arch_hint]="Obrazy n8n sa tylko dla arm64 i amd64 - zainstaluj system 64-bitowy."
T_PL[notice_321]="Dobra praktyka: regula 3-2-1 - 3 kopie, 2 nosniki, 1 off-site."
T_PL[notice_offsite_title]="POLITYKA BACKUPU OFF-SITE"
T_PL[notice_responsibility]="Backupy sa LOKALNE z zalozenia. Replikacja off-site lezy"
T_PL[notice_responsibility2]="po stronie operatora - instalator nie przechowuje danych"
T_PL[notice_responsibility3]="dostepowych do uslug zewnetrznych."
T_PL[pulling_images]="Pobieranie obrazow Docker (5-10 min za pierwszym razem, log: install.log)..."
T_PL[images_pulled]="Obrazy Docker pobrane"
T_PL[pull_warn]="Pull mial problemy, probuje kontynuowac (sprawdz install.log)"
T_PL[creating_containers]="Tworzenie i uruchamianie kontenerow..."
T_PL[disc_title]="DISCLAIMER - PROSZE PRZECZYTAC PRZED KONTYNUACJA"
T_PL[disc_l1]="Skrypt przygotowano z duza dbaloscia o jakosc."
T_PL[disc_l2]="Jest jednak dostarczany TAK JAK JEST, bez zadnej gwarancji."
T_PL[disc_l3]="Autor nie ponosi odpowiedzialnosci za szkody spowodowane"
T_PL[disc_l4]="uzyciem skryptu lub jego bledami."
T_PL[disc_l5]="ZAWSZE wykonaj swiezy backup przed uruchomieniem tego"
T_PL[disc_l6]="skryptu na systemie zawierajacym wazne dane."
T_PL[disc_accept]="Czy akceptujesz warunki i chcesz kontynuowac?"
T_PL[disc_cancel]="Instalacja anulowana przez uzytkownika. Nic nie zmieniono."
T_PL[about_title]="O TYM INSTALATORZE"
T_PL[about_author]="Autor:"
T_PL[about_version]="Wersja:"
T_PL[about_support]="Bledy i sugestie (GitHub issues):"
T_PL[about_source]="Zrodlo / dokumentacja:"
T_PL[about_thanks]="Dziekuje za skorzystanie z instalatora."
T_PL[step_utils]="Instalacja narzedzi pomocniczych"
T_PL[step_secrets]="Generowanie sekretow"
T_PL[step_config]="Tworzenie konfiguracji n8n"
T_PL[step_cf_install]="Instalacja Cloudflared"
T_PL[step_cf_tunnel]="Konfiguracja tunelu Cloudflare"
T_PL[step_cf_service]="Konfiguracja uslugi Cloudflared"
T_PL[step_backup]="Konfiguracja automatycznych backupow"
T_PL[step_start]="Uruchamianie n8n"
T_PL[step_done]="Instalacja zakonczona"
T_PL[docker_present]="Docker juz zainstalowany:"
T_PL[docker_installed]="Docker zainstalowany:"
T_PL[docker_failed]="Blad instalacji Docker."
T_PL[compose_present]="Plugin Docker Compose juz obecny:"
T_PL[arch_detected]="Wykryta architektura:"
T_PL[arch_unsupported]="Nieobslugiwana architektura:"
T_PL[cf_present]="Cloudflared juz zainstalowany:"
T_PL[cf_dl]="Pobieranie Cloudflared z:"
T_PL[cf_dl_failed]="Nie udalo sie pobrac Cloudflared."
T_PL[ask_domain]="Domena dla n8n (np. n8n.przyklad.pl):"
T_PL[ask_tz]="Strefa czasowa [Europe/Warsaw]:"
T_PL[ask_tunnel]="Nazwa tunelu Cloudflare [n8n-tunnel]:"
T_PL[secrets_generated]="Sekrety wygenerowane i zapisane w:"
T_PL[secrets_reused]="Zachowano istniejace haslo DB i klucz szyfrowania z:"
T_PL[cf_warning]="Musisz posiadac domene dodana do Cloudflare. Otworzy sie okno logowania w przegladarce."
T_PL[cf_tunnel_exists]="Tunel juz istnieje, uzywam go. ID:"
T_PL[cf_tunnel_creating]="Tworzenie tunelu:"
T_PL[cf_tunnel_created]="Tunel utworzony. ID:"
T_PL[cf_tunnel_id_fail]="Nie udalo sie wyodrebnic ID tunelu."
T_PL[cf_tunnel_id_manual]="Podaj ID tunelu recznie:"
T_PL[cf_id_invalid]="Nieprawidlowy format UUID. Przerwanie."
T_PL[cf_cred_not_found]="Nie znaleziono pliku z poswiadczeniami. Podaj sciezke recznie:"
T_PL[cf_cred_missing]="Plik nie istnieje. Przerwanie."
T_PL[cf_service_active]="Usluga Cloudflared aktywna."
T_PL[cf_service_fail]="Usluga Cloudflared nie wystartowala. Sprawdz: journalctl -u cloudflared"
T_PL[backup_cron_set]="Backupy beda uruchamiane codziennie o 03:XX."
T_PL[backup_created]="Skrypt backupu utworzony:"
T_PL[restore_created]="Skrypt restore utworzony:"
T_PL[n8n_running]="Kontener n8n dziala."
T_PL[n8n_failed]="Kontener n8n nie wystartowal. Sprawdz: docker logs n8n-main"
T_PL[summary_url]="Twoj n8n jest dostepny pod:"
T_PL[summary_files]="Pliki:"
T_PL[summary_creds]="Wygenerowane dane (zapisane w .env):"
T_PL[summary_save]="ZAPISZ KLUCZ SZYFROWANIA W BEZPIECZNYM MIEJSCU!"
T_PL[summary_user]="Uzytkownik DB:"
T_PL[summary_pass]="Haslo DB:"
T_PL[summary_key]="Klucz szyfrowania:"
T_PL[restore_title]="Tryb przywracania"
T_PL[restore_no_local]="Brak lokalnych backupow w katalogu"
T_PL[restore_no_local_help]="Skopiuj plik backupu (n8n_full_backup_*.tar.gz) do tego katalogu i uruchom skrypt ponownie."
T_PL[restore_examples]="Przyklady skopiowania backupu NA Raspberry Pi:"
T_PL[restore_list]="Dostepne backupy:"
T_PL[restore_select]="Numer backupu (puste = najnowszy):"
T_PL[restore_not_found]="Nie znaleziono wybranego backupu."
T_PL[restore_warning]="To zastapi obecna instalacje n8n!"
T_PL[restore_stopping]="Zatrzymywanie uslug"
T_PL[restore_unpacking]="Rozpakowywanie backupu"
T_PL[restore_compose]="Przywracanie docker-compose.yml"
T_PL[restore_env]="Przywracanie .env"
T_PL[restore_db]="Przywracanie bazy danych"
T_PL[restore_db_wait]="Oczekiwanie na PostgreSQL"
T_PL[restore_db_import]="Import danych z backupu"
T_PL[restore_volume]="Przywracanie wolumenu n8n"
T_PL[restore_cf]="Przywracanie konfiguracji Cloudflare"
T_PL[restore_starting]="Uruchamianie uslug"
T_PL[restore_done]="Przywracanie zakonczone."
T_PL[status_title]="Status:"
T_PL[status_n8n_up]="n8n: uruchomione"
T_PL[status_n8n_down]="n8n: zatrzymane"
T_PL[status_cf_up]="Cloudflared: uruchomiony"
T_PL[status_cf_down]="Cloudflared: zatrzymany"
T_PL[notice_title]="WAZNE - INFORMACJA O BACKUPACH"
T_PL[notice_local]="Backupy zapisywane sa LOKALNIE w:"
T_PL[notice_schedule]="Codziennie o 03:XX, trzymane 7 ostatnich (auto-rotacja)."
T_PL[notice_warn]="UWAGA: Awaria karty SD / dysku = utrata wszystkich backupow."
T_PL[notice_action]="MUSISZ regularnie kopiowac backupy POZA Raspberry Pi. Przyklady:"
T_PL[notice_ex_pull]="Z innego komputera (pobranie przez SSH):"
T_PL[notice_ex_usb]="Na pendrive/dysk USB podlaczony do Pi:"
T_PL[notice_ex_cloud]="Do chmury (uzywajac rclone):"
T_PL[bye]="Do widzenia."

# German
T_DE[banner_line]="================================================================"
T_DE[banner_title]="  N8N Installer fuer Raspberry Pi  -  v5.2"
T_DE[lang_prompt]="Language / Jezyk / Sprache"
T_DE[lang_select]="Auswahl [1]:"
T_DE[need_root]="Dieses Skript benoetigt Root-Rechte. Als root oder mit sudo starten."
T_DE[not_rpi]="Dieses Skript ist fuer Raspberry Pi optimiert, funktioniert aber auch auf anderen Debian-Systemen."
T_DE[ask_continue]="Fortfahren?"
T_DE[yes_no]="[j/n]:"
T_DE[menu_title]="Operation waehlen:"
T_DE[menu_fresh]="Neuinstallation"
T_DE[menu_restore]="Wiederherstellung aus Backup"
T_DE[menu_status]="Status anzeigen"
T_DE[menu_exit]="Beenden"
T_DE[menu_prompt]="Auswahl [1]:"
T_DE[invalid_choice]="Ungueltige Auswahl."
T_DE[step_check]="Umgebung pruefen"
T_DE[step_apt]="Paketindex aktualisieren"
T_DE[step_upgrade]="Systempakete aktualisieren (kann dauern)"
T_DE[step_docker]="Docker installieren"
T_DE[err_title]="INSTALLATION FEHLGESCHLAGEN"
T_DE[err_step]="Schritt:"
T_DE[err_line]="Zeile:"
T_DE[err_cmd]="Befehl:"
T_DE[err_exit]="Exit-Code:"
T_DE[err_log]="Vollstaendiges Log:"
T_DE[err_tail]="Letzte Zeilen aus dem Log:"
T_DE[err_help]="Was tun:"
T_DE[err_help_1]="1) Logdatei oben pruefen"
T_DE[err_help_2]="2) Netzwerk und Speicherplatz pruefen"
T_DE[err_help_3]="3) Installer erneut starten - ist sicher"
T_DE[exist_title]="BESTEHENDE INSTALLATION ERKANNT"
T_DE[exist_intro]="Folgende Komponenten wurden im System gefunden:"
T_DE[exist_warn]="Fortsetzen UEBERSCHREIBT die bestehende Konfiguration."
T_DE[exist_keep]="Docker-Volumes bleiben erhalten (sofern nicht manuell entfernt)."
T_DE[exist_recommend]="EMPFOHLEN vor dem Fortsetzen - frisches Backup anlegen:"
T_DE[exist_continue]="Trotzdem fortsetzen und ueberschreiben?"
T_DE[exist_aborted]="Installation abgebrochen. Bestehende Konfiguration unberuehrt."
T_DE[exist_proceeding]="Wird fortgesetzt - bestehende Konfiguration wird ueberschrieben."
T_DE[step_autoupdate]="Update-Befehl einrichten"
T_DE[autoupdate_on]="Spaeter aktualisieren: sudo n8n-update <Version> (vorher Backup)."
T_DE[arch_hint]="n8n-Images gibt es nur fuer arm64 und amd64 - 64-Bit-OS installieren."
T_DE[notice_321]="Best Practice: 3-2-1 Regel - 3 Kopien, 2 Medien, 1 ausserhalb."
T_DE[notice_offsite_title]="OFF-SITE BACKUP-RICHTLINIE"
T_DE[notice_responsibility]="Backups bleiben bewusst LOKAL. Off-site Replikation liegt in"
T_DE[notice_responsibility2]="der Verantwortung des Betreibers - der Installer enthaelt keine"
T_DE[notice_responsibility3]="Zugangsdaten fuer Drittanbieter-Speicher."
T_DE[pulling_images]="Docker-Images werden geladen (5-10 Min beim ersten Mal, install.log)..."
T_DE[images_pulled]="Docker-Images geladen"
T_DE[pull_warn]="Pull hatte Probleme, versuche fortzufahren (siehe install.log)"
T_DE[creating_containers]="Container werden erstellt und gestartet..."
T_DE[disc_title]="HAFTUNGSAUSSCHLUSS - BITTE VOR DEM FORTSETZEN LESEN"
T_DE[disc_l1]="Dieser Installer wurde mit Sorgfalt erstellt."
T_DE[disc_l2]="Er wird jedoch OHNE jegliche Gewaehrleistung bereitgestellt."
T_DE[disc_l3]="Der Autor uebernimmt keine Verantwortung fuer Schaeden,"
T_DE[disc_l4]="die durch die Nutzung oder Fehlfunktion entstehen."
T_DE[disc_l5]="Erstellen Sie IMMER ein frisches Backup, bevor Sie dieses"
T_DE[disc_l6]="Skript auf einem System mit wichtigen Daten ausfuehren."
T_DE[disc_accept]="Akzeptieren Sie diese Bedingungen und moechten fortfahren?"
T_DE[disc_cancel]="Installation vom Benutzer abgebrochen. Nichts wurde geaendert."
T_DE[about_title]="UEBER DIESEN INSTALLER"
T_DE[about_author]="Autor:"
T_DE[about_version]="Version:"
T_DE[about_support]="Fehler und Vorschlaege (GitHub Issues):"
T_DE[about_source]="Quelle / Dokumentation:"
T_DE[about_thanks]="Danke fuer die Nutzung dieses Installers."
T_DE[step_utils]="Hilfswerkzeuge installieren"
T_DE[step_secrets]="Geheimnisse generieren"
T_DE[step_config]="n8n-Konfiguration erstellen"
T_DE[step_cf_install]="Cloudflared installieren"
T_DE[step_cf_tunnel]="Cloudflare-Tunnel konfigurieren"
T_DE[step_cf_service]="Cloudflared-Dienst einrichten"
T_DE[step_backup]="Automatische Backups einrichten"
T_DE[step_start]="n8n starten"
T_DE[step_done]="Installation abgeschlossen"
T_DE[docker_present]="Docker bereits installiert:"
T_DE[docker_installed]="Docker installiert:"
T_DE[docker_failed]="Docker-Installation fehlgeschlagen."
T_DE[compose_present]="Docker Compose Plugin bereits vorhanden:"
T_DE[arch_detected]="Erkannte Architektur:"
T_DE[arch_unsupported]="Nicht unterstuetzte Architektur:"
T_DE[cf_present]="Cloudflared bereits installiert:"
T_DE[cf_dl]="Cloudflared herunterladen von:"
T_DE[cf_dl_failed]="Cloudflared-Download fehlgeschlagen."
T_DE[ask_domain]="Domain fuer n8n (z.B. n8n.beispiel.de):"
T_DE[ask_tz]="Zeitzone [Europe/Warsaw]:"
T_DE[ask_tunnel]="Cloudflare-Tunnel-Name [n8n-tunnel]:"
T_DE[secrets_generated]="Geheimnisse generiert und gespeichert in:"
T_DE[secrets_reused]="Vorhandenes DB-Passwort und Schluessel beibehalten aus:"
T_DE[cf_warning]="Sie benoetigen eine in Cloudflare hinzugefuegte Domain. Ein Browser-Login wird geoeffnet."
T_DE[cf_tunnel_exists]="Tunnel existiert bereits, wird wiederverwendet. ID:"
T_DE[cf_tunnel_creating]="Tunnel wird erstellt:"
T_DE[cf_tunnel_created]="Tunnel erstellt. ID:"
T_DE[cf_tunnel_id_fail]="Tunnel-ID konnte nicht extrahiert werden."
T_DE[cf_tunnel_id_manual]="Tunnel-ID manuell eingeben:"
T_DE[cf_id_invalid]="Ungueltiges UUID-Format. Abbruch."
T_DE[cf_cred_not_found]="Anmeldedatei nicht gefunden. Pfad manuell eingeben:"
T_DE[cf_cred_missing]="Datei existiert nicht. Abbruch."
T_DE[cf_service_active]="Cloudflared-Dienst ist aktiv."
T_DE[cf_service_fail]="Cloudflared-Dienst konnte nicht gestartet werden. Pruefen: journalctl -u cloudflared"
T_DE[backup_cron_set]="Backups laufen taeglich um 03:XX Uhr."
T_DE[backup_created]="Backup-Skript erstellt:"
T_DE[restore_created]="Restore-Skript erstellt:"
T_DE[n8n_running]="n8n-Container laeuft."
T_DE[n8n_failed]="n8n-Container konnte nicht gestartet werden. Pruefen: docker logs n8n-main"
T_DE[summary_url]="Ihr n8n ist erreichbar unter:"
T_DE[summary_files]="Dateien:"
T_DE[summary_creds]="Generierte Zugangsdaten (in .env gespeichert):"
T_DE[summary_save]="VERSCHLUESSELUNGSSCHLUESSEL AN SICHEREM ORT SPEICHERN!"
T_DE[summary_user]="DB-Benutzer:"
T_DE[summary_pass]="DB-Passwort:"
T_DE[summary_key]="Verschluesselungsschluessel:"
T_DE[restore_title]="Wiederherstellungsmodus"
T_DE[restore_no_local]="Keine lokalen Backups gefunden in"
T_DE[restore_no_local_help]="Kopieren Sie eine Backup-Datei (n8n_full_backup_*.tar.gz) in dieses Verzeichnis und starten Sie das Skript erneut."
T_DE[restore_examples]="Beispiele zum Kopieren eines Backups AUF den Pi:"
T_DE[restore_list]="Verfuegbare Backups:"
T_DE[restore_select]="Backup-Nummer (leer = neuestes):"
T_DE[restore_not_found]="Ausgewaehltes Backup nicht gefunden."
T_DE[restore_warning]="Dies ueberschreibt die aktuelle n8n-Installation!"
T_DE[restore_stopping]="Dienste stoppen"
T_DE[restore_unpacking]="Backup entpacken"
T_DE[restore_compose]="docker-compose.yml wiederherstellen"
T_DE[restore_env]=".env wiederherstellen"
T_DE[restore_db]="Datenbank wiederherstellen"
T_DE[restore_db_wait]="Warten auf PostgreSQL"
T_DE[restore_db_import]="Datenbank-Dump importieren"
T_DE[restore_volume]="n8n-Volume wiederherstellen"
T_DE[restore_cf]="Cloudflare-Konfiguration wiederherstellen"
T_DE[restore_starting]="Dienste starten"
T_DE[restore_done]="Wiederherstellung abgeschlossen."
T_DE[status_title]="Status:"
T_DE[status_n8n_up]="n8n: laeuft"
T_DE[status_n8n_down]="n8n: gestoppt"
T_DE[status_cf_up]="Cloudflared: laeuft"
T_DE[status_cf_down]="Cloudflared: gestoppt"
T_DE[notice_title]="WICHTIG - BACKUP-HINWEIS"
T_DE[notice_local]="Backups werden LOKAL gespeichert in:"
T_DE[notice_schedule]="Taeglich um 03:XX, letzte 7 behalten (Auto-Rotation)."
T_DE[notice_warn]="ACHTUNG: SD-Karten- / Plattenausfall = alle Backups verloren."
T_DE[notice_action]="Backups regelmaessig VOM Pi wegkopieren. Beispiele:"
T_DE[notice_ex_pull]="Von einem anderen Rechner (per SSH abholen):"
T_DE[notice_ex_usb]="Auf eine am Pi angeschlossene USB-Festplatte:"
T_DE[notice_ex_cloud]="In die Cloud (mit rclone):"
T_DE[bye]="Auf Wiedersehen."

t() {
    local key="$1" value=""
    case "$LANG_CODE" in
        PL) value="${T_PL[$key]:-}" ;;
        DE) value="${T_DE[$key]:-}" ;;
    esac
    [ -n "$value" ] || value="${T_EN[$key]:-$key}"
    printf '%s' "$value"
}

# -------- Logging --------
log_info()  { printf "${CYAN}[INFO]${RESET} %s\n" "$*"; }
log_ok()    { printf "${GREEN}[ OK ]${RESET} %s\n" "$*"; }
log_warn()  { printf "${YELLOW}[WARN]${RESET} %s\n" "$*"; }
log_err()   { printf "${RED}[FAIL]${RESET} %s\n" "$*" >&2; }
log_step()  { CURRENT_STEP="$*"; printf "\n${BOLD}${BLUE}==> %s${RESET}\n" "$*"; }
# Prompts always go to /dev/tty so they are visible:
#   - inside $() command substitution (which captures stdout),
#   - after init_logging redirects stdout through tee (which buffers prompts
#     that lack a trailing newline).
log_ask()   { printf "${MAGENTA}[ ?? ]${RESET} %s " "$*" > /dev/tty; }

banner() {
    clear_screen
    dos_top
    dos_empty
    dos_center "N8N INSTALLER  for  Raspberry Pi" "$DOS_HI"
    dos_center "version  5.2   -   2026-11-09   -   n8n ${N8N_VERSION}" "$DOS_CY"
    dos_empty
    dos_bot
    printf "\n"
}

# -------- Helpers --------
is_yes() {
    case "${1,,}" in
        y|t|j|yes|tak|ja) return 0 ;;
        *) return 1 ;;
    esac
}

confirm() {
    local response
    log_ask "$(t ask_continue) $(t yes_no)"
    read -r response < /dev/tty
    is_yes "$response"
}

ask() {
    local prompt="$1"
    local default="${2:-}"
    local var
    log_ask "$prompt"
    read -r var < /dev/tty
    printf '%s' "${var:-$default}"
}

ask_secret() {
    local prompt="$1"
    local var
    log_ask "$prompt"
    read -rs var < /dev/tty
    printf '\n' > /dev/tty
    printf '%s' "$var"
}

choose_language() {
    clear_screen
    dos_top
    dos_empty
    dos_center "Language   /   Jezyk   /   Sprache" "$DOS_HI"
    dos_empty
    dos_sep
    dos_empty
    dos_text "    [ 1 ]   English" "$DOS_FG"
    dos_text "    [ 2 ]   Polski" "$DOS_FG"
    dos_text "    [ 3 ]   Deutsch" "$DOS_FG"
    dos_empty
    dos_bot
    printf "\n"
    local choice
    log_ask "Select [1]:"
    read -r choice < /dev/tty
    case "${choice:-1}" in
        2) LANG_CODE="PL" ;;
        3) LANG_CODE="DE" ;;
        *) LANG_CODE="EN" ;;
    esac
}

require_root() {
    if [ "$(id -u)" != "0" ]; then
        log_err "$(t need_root)"
        exit 1
    fi
}

check_raspberry_pi() {
    # n8n publishes images for arm64 and amd64 only. dpkg reports the userland
    # architecture, which catches a 32-bit OS running on a 64-bit kernel.
    local deb_arch
    deb_arch="$(dpkg --print-architecture 2>/dev/null || uname -m)"
    case "$deb_arch" in
        arm64|aarch64|amd64|x86_64) ;;
        *)
            log_err "$(t arch_unsupported) ${deb_arch}"
            log_err "$(t arch_hint)"
            exit 1
            ;;
    esac
    if [ ! -f /proc/device-tree/model ] || ! grep -qi "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
        log_warn "$(t not_rpi)"
        confirm || exit 1
    fi
}

detect_compose() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
    else
        return 1
    fi
}

dc() {
    (cd "$N8N_DIR" && $(detect_compose) "$@")
}

# Newest first. Sorted by the timestamp in the file name, not by mtime -
# archives copied back with scp/rsync get a fresh mtime.
list_backup_files() {
    [ -d "$BACKUP_DIR" ] || return 0
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'n8n_full_backup_*.tar.gz' | sort -r
}

# -------- Installation steps --------
apt_update() {
    log_step "$(t step_apt)"
    DEBIAN_FRONTEND=noninteractive apt-get update -y
    log_ok "package index refreshed"
}

apt_upgrade() {
    log_step "$(t step_upgrade)"
    DEBIAN_FRONTEND=noninteractive apt-get \
        -o Dpkg::Options::="--force-confold" \
        -o Dpkg::Options::="--force-confdef" \
        upgrade -y
    DEBIAN_FRONTEND=noninteractive apt-get autoremove -y --purge
    log_ok "system packages upgraded"
}

prepare_directories() {
    log_step "$(t step_check)"
    mkdir -p "$N8N_DIR" "$BACKUP_DIR" "$LOG_DIR" "$CF_DIR"
    chmod 750 "$N8N_DIR" "$BACKUP_DIR" "$LOG_DIR"
    log_ok "FHS layout prepared"
}

# Returns 0 if an existing installation was found and listed any components.
detect_existing_installation() {
    EXIST_ITEMS=()
    [ -f "$ENV_FILE" ]                                && EXIST_ITEMS+=("config: $ENV_FILE")
    [ -f "$COMPOSE_FILE" ]                            && EXIST_ITEMS+=("compose: $COMPOSE_FILE")
    [ -f "$BACKUP_SCRIPT" ]                           && EXIST_ITEMS+=("backup script: $BACKUP_SCRIPT")
    [ -f "$RESTORE_SCRIPT" ]                          && EXIST_ITEMS+=("restore script: $RESTORE_SCRIPT")
    [ -f /etc/cloudflared/config.yml ]                && EXIST_ITEMS+=("cloudflared: /etc/cloudflared/config.yml")
    [ -f /etc/systemd/system/cloudflared.service ]    && EXIST_ITEMS+=("systemd unit: cloudflared.service")
    if command -v docker >/dev/null 2>&1; then
        docker volume ls --format '{{.Name}}' 2>/dev/null | grep -q '^n8n_n8n_data$' \
            && EXIST_ITEMS+=("docker volume: n8n_n8n_data")
        docker volume ls --format '{{.Name}}' 2>/dev/null | grep -q '^n8n_postgres_data$' \
            && EXIST_ITEMS+=("docker volume: n8n_postgres_data")
        docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^n8n-main$' \
            && EXIST_ITEMS+=("container: n8n-main")
        docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^n8n-postgres$' \
            && EXIST_ITEMS+=("container: n8n-postgres")
    fi
    [ "${#EXIST_ITEMS[@]}" -gt 0 ]
}

check_existing_installation() {
    if ! detect_existing_installation; then
        return 0
    fi

    printf "\n"
    dos_top
    dos_empty
    dos_center "$(t exist_title)" "$DOS_ER"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t exist_intro)" "$DOS_HI"
    dos_empty
    local item
    for item in "${EXIST_ITEMS[@]}"; do
        dos_text "   - ${item}" "$DOS_CY"
    done
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t exist_warn)" "$DOS_ER"
    dos_text "$(t exist_keep)" "$DOS_FG"
    dos_empty
    dos_text "$(t exist_recommend)" "$DOS_HI"
    if [ -x "$BACKUP_SCRIPT" ]; then
        dos_text "   sudo ${BACKUP_SCRIPT}" "$DOS_CY"
    else
        dos_text "   (no backup script available yet)" "$DOS_FG"
    fi
    dos_empty
    dos_bot
    printf "\n"

    log_ask "$(t exist_continue) $(t yes_no)"
    local r; read -r r < /dev/tty
    if ! is_yes "$r"; then
        log_info "$(t exist_aborted)"
        trap - ERR
        exit 0
    fi
    log_warn "$(t exist_proceeding)"
}

install_docker() {
    log_step "$(t step_docker)"
    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        log_ok "$(t docker_present) $(docker --version)"
    else
        apt-get remove -y docker docker-engine docker.io containerd runc >/dev/null 2>&1 || true
        curl -fsSL https://get.docker.com | sh
        systemctl enable --now docker
        if ! docker --version >/dev/null 2>&1; then
            log_err "$(t docker_failed)"
            exit 1
        fi
        log_ok "$(t docker_installed) $(docker --version)"
    fi

    if docker compose version >/dev/null 2>&1; then
        log_ok "$(t compose_present) $(docker compose version --short 2>/dev/null || docker compose version)"
    elif ! command -v docker-compose >/dev/null 2>&1; then
        apt-get install -y docker-compose-plugin 2>/dev/null || apt-get install -y docker-compose || true
    fi
}

install_utilities() {
    log_step "$(t step_utils)"
    apt-get install -y curl tar gzip openssl ca-certificates cron >/dev/null
    systemctl enable --now cron 2>/dev/null || true
    log_ok "OK"
}

install_cloudflared() {
    log_step "$(t step_cf_install)"
    if command -v cloudflared >/dev/null 2>&1; then
        log_ok "$(t cf_present) $(cloudflared --version 2>&1 | head -n1)"
        return 0
    fi

    local arch url
    arch="$(uname -m)"
    log_info "$(t arch_detected) $arch"
    case "$arch" in
        aarch64|arm64) url="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64" ;;
        x86_64|amd64) url="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" ;;
        *) log_err "$(t arch_unsupported) $arch"; exit 1 ;;
    esac

    log_info "$(t cf_dl) $url"
    local tmp_bin
    tmp_bin="$(mktemp)"
    if curl -fsSL "$url" -o "$tmp_bin"; then
        install -m 0755 "$tmp_bin" /usr/local/bin/cloudflared
        rm -f "$tmp_bin"
        ln -sf /usr/local/bin/cloudflared /usr/bin/cloudflared
        log_ok "$(/usr/local/bin/cloudflared version 2>&1 | head -n1)"
    else
        log_err "$(t cf_dl_failed)"
        exit 1
    fi
}

generate_secrets() {
    log_step "$(t step_secrets)"
    local db_user="n8n"
    local db_pass="" enc_key=""

    # Re-run over an existing install: keep the DB password and encryption key.
    # The preserved Docker volumes were initialised with them - new values
    # would lock n8n out of its database and its stored credentials.
    if [ -f "$ENV_FILE" ]; then
        db_pass="$(sed -n 's/^DB_PASSWORD=//p' "$ENV_FILE" | head -n1)"
        enc_key="$(sed -n 's/^N8N_ENCRYPTION_KEY=//p' "$ENV_FILE" | head -n1)"
        if [ -n "$db_pass" ] && [ -n "$enc_key" ]; then
            log_info "$(t secrets_reused) $ENV_FILE"
        fi
    fi
    [ -n "$db_pass" ] || db_pass="$(openssl rand -base64 24 | tr -d '+/=' | cut -c1-32)"
    [ -n "$enc_key" ] || enc_key="$(openssl rand -hex 24)"

    mkdir -p "$N8N_DIR"

    local domain tz
    domain="$(ask "$(t ask_domain)")"
    while [ -z "$domain" ]; do
        domain="$(ask "$(t ask_domain)")"
    done
    tz="$(ask "$(t ask_tz)" "Europe/Warsaw")"

    # Create the file with 600 before any secret is written into it.
    ( umask 077 && : > "$ENV_FILE" )
    chmod 600 "$ENV_FILE"
    cat > "$ENV_FILE" <<EOF
# n8n configuration - generated $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# Change N8N_VERSION only through: sudo n8n-update <version>
N8N_VERSION=${N8N_VERSION}
POSTGRES_IMAGE=${POSTGRES_IMAGE}

DOMAIN_NAME=${domain}
TIMEZONE=${tz}

DB_USER=${db_user}
DB_PASSWORD=${db_pass}
DB_NAME=n8n

N8N_ENCRYPTION_KEY=${enc_key}
N8N_HOST_PORT=8443
EOF
    chmod 600 "$ENV_FILE"
    log_ok "$(t secrets_generated) $ENV_FILE"
}

write_n8n_config() {
    log_step "$(t step_config)"
    mkdir -p "$N8N_DIR"

    cat > "$INIT_DB_FILE" <<'EOF'
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS vector;
EOSQL
EOF
    chmod +x "$INIT_DB_FILE"

    cat > "$COMPOSE_FILE" <<'EOF'
services:
  postgres:
    image: ${POSTGRES_IMAGE}
    container_name: n8n-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sh:/docker-entrypoint-initdb.d/init-db.sh:ro
    healthcheck:
      # -h 127.0.0.1: during first-run init Postgres listens on the socket only,
      # so a TCP check stays red until the real server is up.
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 20
    networks:
      - n8n_net

  n8n:
    image: docker.n8n.io/n8nio/n8n:${N8N_VERSION}
    container_name: n8n-main
    restart: unless-stopped
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_DATABASE: ${DB_NAME}
      DB_POSTGRESDB_USER: ${DB_USER}
      DB_POSTGRESDB_PASSWORD: ${DB_PASSWORD}
      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY}
      N8N_HOST: ${DOMAIN_NAME}
      N8N_PORT: 5678
      N8N_PROTOCOL: https
      N8N_EDITOR_BASE_URL: https://${DOMAIN_NAME}
      WEBHOOK_URL: https://${DOMAIN_NAME}/
      NODE_ENV: production
      GENERIC_TIMEZONE: ${TIMEZONE}
      TZ: ${TIMEZONE}
      N8N_PROXY_HOPS: 1
      N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: "true"
    ports:
      - "127.0.0.1:${N8N_HOST_PORT}:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - n8n_net

networks:
  n8n_net:
    name: n8n_net

volumes:
  postgres_data:
    name: n8n_postgres_data
  n8n_data:
    name: n8n_n8n_data
EOF
    log_ok "$COMPOSE_FILE"
}

find_credential_file() {
    local tunnel_id="$1"
    local dir
    for dir in /root/.cloudflared "$HOME/.cloudflared"; do
        [ -d "$dir" ] || continue
        local f
        f="$(find "$dir" -maxdepth 1 -name "${tunnel_id}.json" -type f | head -n1)"
        if [ -n "$f" ]; then
            echo "$f"; return 0
        fi
    done
    for dir in /root/.cloudflared "$HOME/.cloudflared"; do
        [ -d "$dir" ] || continue
        local f
        f="$(find "$dir" -maxdepth 1 -name "*.json" -type f | head -n1)"
        if [ -n "$f" ]; then
            echo "$f"; return 0
        fi
    done
    return 1
}

configure_cloudflare_tunnel() {
    log_step "$(t step_cf_tunnel)"
    log_warn "$(t cf_warning)"
    confirm || exit 1

    mkdir -p "$CF_DIR"

    # shellcheck disable=SC1090
    source "$ENV_FILE"

    cloudflared tunnel login

    if [ -f /root/.cloudflared/cert.pem ]; then
        cp /root/.cloudflared/cert.pem "$CF_DIR/"
        chmod 600 "$CF_DIR/cert.pem"
    fi

    local tunnel_name tunnel_id
    tunnel_name="$(ask "$(t ask_tunnel)" "n8n-tunnel")"

    if cloudflared tunnel list 2>/dev/null | awk '{print $2}' | grep -Fxq "$tunnel_name"; then
        tunnel_id="$(cloudflared tunnel list 2>/dev/null | awk -v n="$tunnel_name" '$2==n{print $1; exit}')"
        log_warn "$(t cf_tunnel_exists) $tunnel_id"
    else
        log_info "$(t cf_tunnel_creating) $tunnel_name"
        local out
        out="$(cloudflared tunnel create "$tunnel_name" 2>&1)"
        echo "$out"
        tunnel_id="$(echo "$out" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -n1)"
        if [ -z "$tunnel_id" ]; then
            log_err "$(t cf_tunnel_id_fail)"
            tunnel_id="$(ask "$(t cf_tunnel_id_manual)")"
        fi
        if ! [[ "$tunnel_id" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]]; then
            log_err "$(t cf_id_invalid)"
            exit 1
        fi
        log_ok "$(t cf_tunnel_created) $tunnel_id"
    fi

    local cred
    cred="$(find_credential_file "$tunnel_id" || true)"
    if [ -z "$cred" ] || [ ! -f "$cred" ]; then
        cred="$(ask "$(t cf_cred_not_found)")"
        if [ ! -f "$cred" ]; then
            log_err "$(t cf_cred_missing)"
            exit 1
        fi
    fi

    cp -f "$cred" "$CF_DIR/${tunnel_id}.json"
    chmod 600 "$CF_DIR/${tunnel_id}.json"

    cat > "$CF_DIR/config.yml" <<EOF
tunnel: ${tunnel_id}
credentials-file: ${CF_DIR}/${tunnel_id}.json
ingress:
  - hostname: ${DOMAIN_NAME}
    service: http://localhost:${N8N_HOST_PORT}
  - service: http_status:404
EOF
    chmod 644 "$CF_DIR/config.yml"

    cloudflared tunnel route dns "$tunnel_name" "$DOMAIN_NAME" || true
    log_ok "$CF_DIR/config.yml"
}

setup_cloudflared_service() {
    log_step "$(t step_cf_service)"
    # cloudflared may come from this script (/usr/local/bin) or from a package.
    local cf_bin
    cf_bin="$(command -v cloudflared)"
    cat > /etc/systemd/system/cloudflared.service <<EOF
[Unit]
Description=cloudflared
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=${cf_bin} --config ${CF_DIR}/config.yml tunnel run
Restart=on-failure
RestartSec=5s
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable --now cloudflared
    sleep 2
    if systemctl is-active --quiet cloudflared; then
        log_ok "$(t cf_service_active)"
    else
        log_warn "$(t cf_service_fail)"
    fi
}

write_backup_script() {
    log_step "$(t step_backup)"
    cat > "$BACKUP_SCRIPT" <<'BACKUP_EOF'
#!/usr/bin/env bash
# n8n backup script - generated by install-n8n-rpi.sh
# The archive holds .env (DB password + N8N_ENCRYPTION_KEY): keep it private.
set -euo pipefail
umask 077

N8N_DIR="/opt/n8n"
ENV_FILE="${N8N_DIR}/.env"
BACKUP_DIR="/var/lib/n8n/backups"
LOG_DIR="/var/log/n8n"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
LOG="${LOG_DIR}/backup.log"

mkdir -p "$BACKUP_DIR" "$LOG_DIR"
exec >>"$LOG" 2>&1

if [ ! -f "$ENV_FILE" ]; then
    echo "[$(date)] FAIL: missing $ENV_FILE"; exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

echo "================================================================"
echo "[$(date)] Backup start: $TIMESTAMP"

detect_compose() {
    if docker compose version >/dev/null 2>&1; then echo "docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then echo "docker-compose"
    else echo ""; fi
}
COMPOSE="$(detect_compose)"
if [ -z "$COMPOSE" ]; then echo "[$(date)] FAIL: no compose"; exit 1; fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# 1) PostgreSQL dump
cd "$N8N_DIR"
$COMPOSE exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges \
    > "$WORK/n8n_db_${TIMESTAMP}.sql"
echo "[$(date)] OK  pg_dump $(du -h "$WORK/n8n_db_${TIMESTAMP}.sql" | awk '{print $1}')"

# 2) n8n volume (custom nodes, binary data, .n8n config)
docker run --rm \
    -v n8n_n8n_data:/source:ro \
    -v "$WORK":/backup \
    alpine:3.24 sh -c "cd /source && tar czf /backup/n8n_volume_${TIMESTAMP}.tar.gz ."
echo "[$(date)] OK  volume n8n_n8n_data"

# 3) docker-compose.yml + .env + init-db.sh
tar czf "$WORK/n8n_config_${TIMESTAMP}.tar.gz" -C "$N8N_DIR" docker-compose.yml .env init-db.sh
echo "[$(date)] OK  config bundle"

# 4) Cloudflare config (optional)
if [ -d /etc/cloudflared ]; then
    tar czf "$WORK/cloudflared_${TIMESTAMP}.tar.gz" -C / etc/cloudflared
    echo "[$(date)] OK  cloudflared"
fi

# 5) Combine into one archive
FINAL="$BACKUP_DIR/n8n_full_backup_${TIMESTAMP}.tar.gz"
tar czf "$FINAL" -C "$WORK" .
SIZE="$(du -h "$FINAL" | awk '{print $1}')"
echo "[$(date)] OK  archive: $FINAL ($SIZE)"

# 6) Rotation: keep 7 newest local copies
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'n8n_full_backup_*.tar.gz' | sort -r | tail -n +8 | xargs -r rm -f

echo "[$(date)] Backup done"
echo "[$(date)] REMINDER: Copy this archive OFF the Pi to survive disk failure."
BACKUP_EOF
    chmod 700 "$BACKUP_SCRIPT"
    log_ok "$(t backup_created) $BACKUP_SCRIPT"

    local minute
    minute="$(( RANDOM % 60 ))"
    # Drop entries from earlier runs (old name backup-n8n.sh too), add one.
    (crontab -l 2>/dev/null | grep -v -e "n8n-backup" -e "backup-n8n.sh" || true; echo "${minute} 3 * * * ${BACKUP_SCRIPT}") | crontab -
    log_ok "$(t backup_cron_set)"
}

write_restore_script() {
    cat > "$RESTORE_SCRIPT" <<'RESTORE_EOF'
#!/usr/bin/env bash
# n8n restore script - generated by install-n8n-rpi.sh
set -euo pipefail

N8N_DIR="/opt/n8n"
ENV_FILE="${N8N_DIR}/.env"
BACKUP_DIR="/var/lib/n8n/backups"
LOG_DIR="/var/log/n8n"
LOG="${LOG_DIR}/restore.log"
mkdir -p "$LOG_DIR"

log() { printf "[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }

usage() {
    cat <<USAGE
Usage: $0 [TIMESTAMP|--latest|--list]
  --latest        Use newest local backup
  --list          List local backups in /var/lib/n8n/backups
  TIMESTAMP       e.g. 2026-11-09_03-00-00 (or partial date 2026-11-09)

NOTE: Backups must be present locally in /var/lib/n8n/backups/.
      Copy them from your off-site storage first, e.g.:
        scp backup.tar.gz pi:/var/lib/n8n/backups/
        rsync -av ./my-backups/ pi:/var/lib/n8n/backups/
USAGE
}

require_root() {
    [ "$(id -u)" = "0" ] || { echo "Root required: sudo $0 $*"; exit 1; }
}

detect_compose() {
    if docker compose version >/dev/null 2>&1; then echo "docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then echo "docker-compose"
    else echo ""; fi
}

list_backups() {
    if ls "$BACKUP_DIR"/n8n_full_backup_*.tar.gz >/dev/null 2>&1; then
        ls -lht "$BACKUP_DIR"/n8n_full_backup_*.tar.gz
    else
        echo "No backups in $BACKUP_DIR"
    fi
}

find_backup() {
    local input="$1"
    case "$input" in
        --latest)
            find "$BACKUP_DIR" -maxdepth 1 -type f -name 'n8n_full_backup_*.tar.gz' | sort -r | head -n1
            ;;
        *)
            local file="$BACKUP_DIR/n8n_full_backup_${input}.tar.gz"
            if [ -f "$file" ]; then
                echo "$file"
            else
                find "$BACKUP_DIR" -maxdepth 1 -type f -name "n8n_full_backup_${input}*.tar.gz" | sort -r | head -n1
            fi
            ;;
    esac
}

do_restore() {
    local backup_file="$1"
    [ -f "$backup_file" ] || { log "FAIL: backup not found: $backup_file"; exit 1; }

    local compose
    compose="$(detect_compose)"
    [ -n "$compose" ] || { log "FAIL: no docker compose"; exit 1; }

    log "================================================================"
    log "Restore from: $backup_file"

    local work; work="$(mktemp -d)"
    trap 'rm -rf "$work"' EXIT

    log "Unpacking archive..."
    tar xzf "$backup_file" -C "$work"

    # 1) Restore config (docker-compose.yml + .env + init-db.sh)
    mkdir -p "$N8N_DIR"
    local cfg
    cfg="$(find "$work" -name "n8n_config_*.tar.gz" -type f | head -1)"
    if [ -n "$cfg" ]; then
        log "Restoring config bundle..."
        tar xzf "$cfg" -C "$N8N_DIR"
    else
        log "WARN: no config bundle in backup"
    fi

    [ -f "$ENV_FILE" ] || { log "FAIL: no .env after restore"; exit 1; }
    # shellcheck disable=SC1090
    source "$ENV_FILE"

    # 2) Stop services
    log "Stopping services..."
    systemctl stop cloudflared 2>/dev/null || true
    (cd "$N8N_DIR" && $compose down -v 2>/dev/null) || true

    # 3) Restore n8n volume (binary data, custom nodes, .n8n config dir)
    local vol
    vol="$(find "$work" -name "n8n_volume_*.tar.gz" -type f | head -1)"
    if [ -n "$vol" ]; then
        log "Restoring n8n volume..."
        docker volume create n8n_n8n_data >/dev/null
        docker run --rm \
            -v n8n_n8n_data:/target \
            -v "$work":/source:ro \
            alpine:3.24 sh -c "cd /target && tar xzf /source/$(basename "$vol")"
        log "OK n8n volume"
    fi

    # 4) Restore Cloudflare config
    local cf
    cf="$(find "$work" -name "cloudflared_*.tar.gz" -type f | head -1)"
    if [ -n "$cf" ]; then
        log "Restoring cloudflared..."
        tar xzf "$cf" -C /
    fi

    # 5) Start postgres and import DB dump
    local db
    db="$(find "$work" -name "n8n_db_*.sql" -type f | head -1)"
    if [ -n "$db" ]; then
        log "Starting PostgreSQL..."
        (cd "$N8N_DIR" && $compose up -d postgres)

        log "Waiting for PostgreSQL..."
        for _ in $(seq 1 60); do
            # TCP check: the socket answers already during first-run init,
            # before the init scripts finish and the server restarts.
            if (cd "$N8N_DIR" && $compose exec -T postgres pg_isready -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME") >/dev/null 2>&1; then
                break
            fi
            sleep 1
        done

        log "Importing database dump..."
        (cd "$N8N_DIR" && $compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME") < "$db"
        log "OK database restored"
    fi

    # 6) Start everything
    log "Starting n8n..."
    (cd "$N8N_DIR" && $compose up -d)

    if [ -f /etc/cloudflared/config.yml ] && [ -f /etc/systemd/system/cloudflared.service ]; then
        systemctl start cloudflared || true
    fi

    log "Restore complete."
    log "================================================================"
    docker ps --filter "name=n8n-" --format "table {{.Names}}\t{{.Status}}"
}

# Main
require_root "$@"

case "${1:-}" in
    -h|--help|"") usage; exit 0 ;;
    --list) list_backups; exit 0 ;;
    *)
        FILE="$(find_backup "$1")"
        [ -n "$FILE" ] || { log "FAIL: no backup matched: $1"; list_backups; exit 1; }
        do_restore "$FILE"
        ;;
esac
RESTORE_EOF
    chmod 700 "$RESTORE_SCRIPT"
    log_ok "$(t restore_created) $RESTORE_SCRIPT"
}

write_update_script() {
    cat > "$UPDATE_SCRIPT" <<'UPDATE_EOF'
#!/usr/bin/env bash
# n8n update script - generated by install-n8n-rpi.sh
# Steps: backup -> set N8N_VERSION in .env -> pull -> up -d -> health check.
set -euo pipefail
umask 077

N8N_DIR="/opt/n8n"
ENV_FILE="${N8N_DIR}/.env"
LOG_DIR="/var/log/n8n"
LOG="${LOG_DIR}/update.log"
BACKUP_BIN="/usr/local/sbin/n8n-backup"

usage() {
    cat <<USAGE
Usage: $0 <version>            e.g. $0 2.46.7
       $0 --major <version>    allow a major jump (2.x -> 3.x is ONE-WAY)
       $0 --current            show the pinned version

Before a major jump read the release notes and the Migration Report
(Settings -> Migration Report) - see Module 1 on kursn8n.pl.
Downgrades are refused: restore the backup instead (sudo n8n-restore --latest).
USAGE
}

log() { printf "[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }

[ "$(id -u)" = "0" ] || { echo "Root required: sudo $0 $*"; exit 1; }
mkdir -p "$LOG_DIR"
[ -f "$ENV_FILE" ] || { echo "FAIL: missing $ENV_FILE"; exit 1; }

allow_major=0
case "${1:-}" in
    -h|--help|"") usage; exit 0 ;;
    --current) sed -n 's/^N8N_VERSION=//p' "$ENV_FILE"; exit 0 ;;
    --major) allow_major=1; shift ;;
esac

target="${1:-}"
if ! [[ "$target" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "FAIL: version must look like 2.46.7 (got: '${target}')"; exit 1
fi

current="$(sed -n 's/^N8N_VERSION=//p' "$ENV_FILE" | head -n1)"
if [ -z "$current" ]; then
    echo "FAIL: N8N_VERSION is missing in $ENV_FILE (installed by an older installer)."
    echo "      Re-run the installer, or set the image tag in docker-compose.yml by hand."
    exit 1
fi
if [ "$target" = "$current" ]; then
    echo "n8n is already pinned to ${current}."; exit 0
fi
if [ "$(printf '%s\n%s\n' "$current" "$target" | sort -V | head -n1)" = "$target" ]; then
    echo "FAIL: ${target} is older than ${current}. Database migrations do not run"
    echo "      backwards - restore the backup instead: sudo n8n-restore --latest"
    exit 1
fi
if [ "${target%%.*}" != "${current%%.*}" ] && [ "$allow_major" -ne 1 ]; then
    echo "FAIL: ${current} -> ${target} is a major upgrade and cannot be undone."
    echo "      Check the Migration Report first, then run: sudo $0 --major ${target}"
    exit 1
fi

if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then COMPOSE="docker-compose"
else echo "FAIL: docker compose not found"; exit 1; fi

log "================================================================"
log "Update ${current} -> ${target}"

# 1) Backup first - no backup, no update.
if [ ! -x "$BACKUP_BIN" ] || ! "$BACKUP_BIN"; then
    log "FAIL: pre-update backup did not succeed (see ${LOG_DIR}/backup.log). Aborting."
    exit 1
fi
log "OK  pre-update backup"

# 2) Switch the pinned version and pull it. On a failed pull, switch back.
sed -i "s/^N8N_VERSION=.*/N8N_VERSION=${target}/" "$ENV_FILE"
cd "$N8N_DIR"
if ! $COMPOSE pull n8n >>"$LOG" 2>&1; then
    sed -i "s/^N8N_VERSION=.*/N8N_VERSION=${current}/" "$ENV_FILE"
    log "FAIL: could not pull ${target}. Version reverted to ${current}, nothing restarted."
    exit 1
fi
log "OK  pulled ${target}"

# 3) Recreate the container and wait for /healthz.
$COMPOSE up -d >>"$LOG" 2>&1
port="$(sed -n 's/^N8N_HOST_PORT=//p' "$ENV_FILE" | head -n1)"
for _ in $(seq 1 36); do
    if curl -fsS "http://127.0.0.1:${port:-8443}/healthz" >/dev/null 2>&1; then
        log "OK  n8n ${target} is up"
        exit 0
    fi
    sleep 5
done
log "FAIL: n8n did not become healthy within 3 minutes."
docker logs --tail 50 n8n-main >>"$LOG" 2>&1 || true
log "      Logs: docker logs n8n-main | Roll back: sudo n8n-restore --latest"
exit 1
UPDATE_EOF
    chmod 700 "$UPDATE_SCRIPT"
}

install_update_command() {
    log_step "$(t step_autoupdate)"
    write_update_script
    # v5.1 could schedule weekly unattended updates. With a pinned version
    # that job is pointless, and on "latest" it could jump to 3.x - remove it.
    (crontab -l 2>/dev/null | grep -v "n8n-update" || true) | crontab -
    log_ok "$(t autoupdate_on)"
}

start_n8n() {
    log_step "$(t step_start)"
    # Pulls and container creation produce a lot of progress noise (per-layer
    # download lines). Route that to the install log so the on-screen UI stays
    # readable. The user just sees a single "Pulling..." / "Starting..." line.
    log_info "$(t pulling_images)"
    if ! dc pull >>"$INSTALL_LOG" 2>&1; then
        log_warn "$(t pull_warn)"
    else
        log_ok "$(t images_pulled)"
    fi
    log_info "$(t creating_containers)"
    dc up -d >>"$INSTALL_LOG" 2>&1
    sleep 6
    if docker ps --format '{{.Names}}' | grep -q '^n8n-main$'; then
        log_ok "$(t n8n_running)"
    else
        log_warn "$(t n8n_failed)"
    fi
}

show_summary() {
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    # The install log gets a one-liner. The box with the DB password and the
    # encryption key goes to the terminal only, never into install.log.
    log_ok "$(t step_done): https://${DOMAIN_NAME}"
    # shellcheck disable=SC2153  # DB_USER and friends come from the sourced .env
    {
    printf "\n"
    dos_top
    dos_empty
    dos_center "$(t step_done)" "$DOS_OK"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t summary_url)" "$DOS_FG"
    dos_text "   https://${DOMAIN_NAME}" "$DOS_CY"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t summary_files)" "$DOS_HI"
    dos_text "   ${COMPOSE_FILE}"
    dos_text "   ${ENV_FILE}"
    dos_text "   ${CF_DIR}/config.yml"
    dos_text "   ${BACKUP_SCRIPT}"
    dos_text "   ${RESTORE_SCRIPT}"
    dos_text "   ${UPDATE_SCRIPT}"
    dos_empty
    dos_kv "n8n" "${N8N_VERSION:-?}"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t summary_creds)" "$DOS_HI"
    dos_empty
    dos_text "$(t summary_user)" "$DOS_FG"
    dos_text "   ${DB_USER}" "$DOS_HI"
    dos_text "$(t summary_pass)" "$DOS_FG"
    dos_text "   ${DB_PASSWORD}" "$DOS_HI"
    dos_text "$(t summary_key)" "$DOS_FG"
    dos_text "   ${N8N_ENCRYPTION_KEY}" "$DOS_HI"
    dos_empty
    dos_text "$(t summary_save)" "$DOS_ER"
    dos_empty
    dos_bot
    printf "\n"
    } > /dev/tty

    show_backup_notice
    show_about_section
}

show_backup_notice() {
    local host_label
    host_label="$(hostname -s 2>/dev/null || echo pi)"

    dos_top
    dos_empty
    dos_center "$(t notice_offsite_title)" "$DOS_HI"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t notice_responsibility)" "$DOS_FG"
    dos_text "$(t notice_responsibility2)" "$DOS_FG"
    dos_text "$(t notice_responsibility3)" "$DOS_FG"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t notice_local)" "$DOS_FG"
    dos_text "   ${BACKUP_DIR}" "$DOS_CY"
    dos_text "$(t notice_schedule)" "$DOS_FG"
    dos_empty
    dos_text "$(t notice_warn)" "$DOS_ER"
    dos_text "$(t notice_321)" "$DOS_HI"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t notice_action)" "$DOS_HI"
    dos_empty
    dos_text "# $(t notice_ex_pull)" "$DOS_CY"
    dos_text "  rsync -av root@${host_label}:${BACKUP_DIR}/ ./n8n-backups/"
    dos_empty
    dos_text "# $(t notice_ex_usb)" "$DOS_CY"
    dos_text "  cp ${BACKUP_DIR}/n8n_full_backup_*.tar.gz /mnt/usb/"
    dos_empty
    dos_text "# $(t notice_ex_cloud)" "$DOS_CY"
    dos_text "  rclone copy ${BACKUP_DIR}/ remote:n8n-backups/"
    dos_empty
    dos_bot
    printf "\n"
}

# -------- Fresh install --------
do_fresh_install() {
    check_raspberry_pi
    check_existing_installation
    prepare_directories
    apt_update
    apt_upgrade
    install_docker
    install_utilities
    install_cloudflared
    generate_secrets
    write_n8n_config
    configure_cloudflare_tunnel
    setup_cloudflared_service
    write_backup_script
    write_restore_script
    install_update_command
    start_n8n
    show_summary
}

# -------- Restore flow --------
do_restore_flow() {
    log_step "$(t restore_title)"

    check_raspberry_pi
    prepare_directories
    apt_update
    install_docker
    install_utilities
    install_cloudflared

    if [ -z "$(list_backup_files)" ]; then
        local host_label; host_label="$(hostname -s 2>/dev/null || echo pi)"
        printf "\n"
        log_warn "$(t restore_no_local) $BACKUP_DIR"
        printf "  %s\n\n" "$(t restore_no_local_help)"
        printf "  ${BOLD}%s${RESET}\n\n" "$(t restore_examples)"
        printf '  %s# from another machine:%s\n' "$DIM" "$RESET"
        printf "  ${CYAN}scp ./n8n_full_backup_*.tar.gz root@%s:%s/${RESET}\n" "$host_label" "$BACKUP_DIR"
        printf "  ${CYAN}rsync -av ./n8n-backups/ root@%s:%s/${RESET}\n\n" "$host_label" "$BACKUP_DIR"
        printf '  %s# from a USB drive on the Pi:%s\n' "$DIM" "$RESET"
        printf "  ${CYAN}cp /mnt/usb/n8n_full_backup_*.tar.gz %s/${RESET}\n\n" "$BACKUP_DIR"
        exit 1
    fi

    log_info "$(t restore_list)"
    local f
    list_backup_files | while IFS= read -r f; do
        printf '%s  (%s)\n' "$(basename "$f")" "$(du -h "$f" | cut -f1)"
    done | nl -w2 -s') '
    echo
    local num backup_file=""
    num="$(ask "$(t restore_select)")"
    if [ -z "$num" ]; then
        backup_file="$(list_backup_files | head -n1)"
    elif [[ "$num" =~ ^[0-9]+$ ]]; then
        backup_file="$(list_backup_files | sed -n "${num}p")"
    fi

    [ -f "$backup_file" ] || { log_err "$(t restore_not_found)"; exit 1; }

    log_warn "$(t restore_warning)"
    confirm || exit 0

    write_restore_script
    "$RESTORE_SCRIPT" "$(basename "$backup_file" | sed 's/n8n_full_backup_\(.*\)\.tar\.gz/\1/')"

    # On a fresh SD card / SSD the restored files are not enough: the
    # cloudflared unit, the daily backup job and the update command live
    # outside the archive. Recreate them.
    if [ -f "$CF_DIR/config.yml" ]; then
        setup_cloudflared_service
    fi
    write_backup_script
    install_update_command
}

# -------- Status --------
do_status() {
    printf "\n"
    dos_top
    dos_empty
    dos_center "$(t status_title)" "$DOS_HI"
    dos_empty
    dos_sep
    dos_empty
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^n8n-main$'; then
        dos_text "  [ OK ]   $(t status_n8n_up)" "$DOS_OK"
    else
        dos_text "  [FAIL]   $(t status_n8n_down)" "$DOS_ER"
    fi
    if systemctl is-active --quiet cloudflared 2>/dev/null; then
        dos_text "  [ OK ]   $(t status_cf_up)" "$DOS_OK"
    else
        dos_text "  [FAIL]   $(t status_cf_down)" "$DOS_ER"
    fi
    dos_empty
    dos_bot
    printf "\n"
    docker ps --filter "name=n8n-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true
}

# -------- Main --------
show_disclaimer() {
    printf "\n"
    dos_top
    dos_empty
    dos_center "$(t disc_title)" "$DOS_ER"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t disc_l1)" "$DOS_FG"
    dos_text "$(t disc_l2)" "$DOS_FG"
    dos_empty
    dos_text "$(t disc_l3)" "$DOS_ER"
    dos_text "$(t disc_l4)" "$DOS_ER"
    dos_empty
    dos_text "$(t disc_l5)" "$DOS_HI"
    dos_text "$(t disc_l6)" "$DOS_HI"
    dos_empty
    dos_bot
    printf "\n"

    log_ask "$(t disc_accept) $(t yes_no)"
    local r; read -r r < /dev/tty
    if ! is_yes "$r"; then
        log_info "$(t disc_cancel)"
        # Disable ERR trap so a clean exit does not render the failure window.
        trap - ERR
        exit 0
    fi
}

show_about_section() {
    printf "\n"
    dos_top
    dos_empty
    dos_center "$(t about_title)" "$DOS_HI"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t about_author)" "$DOS_FG"
    dos_text "   kursn8n.pl  (MIT License)" "$DOS_HI"
    dos_empty
    dos_text "$(t about_version)" "$DOS_FG"
    dos_text "   5.2   (2026-11-09)" "$DOS_HI"
    dos_empty
    dos_sep
    dos_empty
    dos_text "$(t about_support)" "$DOS_HI"
    dos_text "   https://github.com/lukaszpodgorski-pl/kursn8n_pl/issues" "$DOS_CY"
    dos_empty
    dos_text "$(t about_source)" "$DOS_FG"
    dos_text "   https://kursn8n.pl/modul-1-instalacja-hosting" "$DOS_CY"
    dos_empty
    dos_sep
    dos_empty
    dos_center "$(t about_thanks)" "$DOS_OK"
    dos_empty
    dos_bot
    printf "\n"
}

show_main_menu() {
    dos_top
    dos_empty
    dos_center "$(t menu_title)" "$DOS_HI"
    dos_empty
    dos_sep
    dos_empty
    dos_text "    [ 1 ]   $(t menu_fresh)"
    dos_text "    [ 2 ]   $(t menu_restore)"
    dos_text "    [ 3 ]   $(t menu_status)"
    dos_text "    [ 4 ]   $(t menu_exit)"
    dos_empty
    dos_bot
    printf "\n"
}

main() {
    choose_language
    require_root
    init_logging
    banner
    show_disclaimer
    show_main_menu

    local op
    log_ask "$(t menu_prompt)"
    read -r op < /dev/tty
    op="${op:-1}"

    case "$op" in
        1) do_fresh_install ;;
        2) do_restore_flow ;;
        3) do_status ;;
        4) log_info "$(t bye)"; exit 0 ;;
        *) log_err "$(t invalid_choice)"; exit 1 ;;
    esac
}

main "$@"
