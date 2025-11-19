# eDEX-UI v3.0 - Aktuální Stav Projektu

**Datum:** 2025-11-18
**Session:** `session_01XoKhTbFR4edisNA3T6py9A`
**Branch:** `claude/analyze-codebase-principles-01XoKhTbFR4edisNA3T6py9A`

---

## 🎯 CO BYLO UDĚLÁNO

### 1. Kompletní Refaktoring (v3.0)
Projekt byl kompletně přepsán z Electron na **Tauri 2.0**:

- ✅ **Dokumentace refaktoringu:** `docs/v3.0-refactoring/`
  - `00-overview.md` - Celkový přehled změn
  - `01-architecture.md` - Nová architektura
  - `02-tauri-migration.md` - Migrace z Electronu
  - `03-webgpu-renderer.md` - WebGPU rendering (bez Three.js)
  - `04-terminal-integration.md` - PTY terminál s xterm.js
  - `05-system-monitoring.md` - System monitoring v Tauri
  - `06-theme-system.md` - Nový theme systém
  - `07-settings-management.md` - Nastavení
  - `08-testing-strategy.md` - Testovací strategie
  - `09-deployment.md` - Deployment guide

### 2. Google Cloud VM pro Testování
Vytvořena testovací VM na Google Cloud s GPU pro testování eDEX-UI:

- ✅ **Setup skripty:** `gcloud-setup/`
  - `vm-startup.sh` - Automatický instalační skript
  - `QUICK_START.md` - Rychlý návod (5 příkazů)
  - `CREATE_VM.md` - Detailní návod

### 3. Hlasové Služby (Speech-to-Text / Text-to-Speech)
Dokumentace hlasových služeb pro zjednodušení práce s Claudem:

- ✅ **Dokumentace:** `docs/VOICE_SERVICES.md`
  - Možnosti diktování (vestavěné Claude.ai, Google Cloud, Whisper, OS)
  - Možnosti přehrávání odpovědí (vestavěné Claude.ai, browser extensions, Google Cloud TTS, lokální TTS)
  - Doporučené setup varianty
  - Wrapper skript pro kompletní hlasové rozhraní

---

## 🖥️ BĚŽÍCÍ VM NA GOOGLE CLOUD

### VM Detaily:
- **Název:** `edex-ui-test`
- **Projekt:** `new-has-477501` (display name: "new-HAS")
- **Zóna:** `europe-west4-a` (Holandsko)
- **External IP:** `34.141.153.47`
- **Machine Type:** `n1-standard-4` (4 vCPU, 15 GB RAM)
- **GPU:** NVIDIA Tesla T4
- **Disk:** 50 GB
- **Status:** ✅ RUNNING (vytvořeno 18.11.2025 ~06:36 UTC)

### VNC Přístup:
- **Adresa:** `34.141.153.47:5901`
- **Heslo:** `edexui2025`
- **Desktop:** Ubuntu 22.04 LTS + XFCE

### SSH Přístup:
```bash
gcloud compute ssh edex-ui-test --zone=europe-west4-a
```

### Co je na VM nainstalováno (automaticky):
- Ubuntu Desktop (XFCE)
- VNC Server (TightVNC)
- Rust + Cargo (stable)
- Node.js 20.x + pnpm
- Všechny Tauri dependencies (webkit2gtk, gtk-3, atd.)
- Firefox + Chromium
- Git + development tools
- **eDEX-UI repository** naklonovaný v `/home/ubuntu/edex-ui`
  - Branch: `claude/analyze-codebase-principles-01XoKhTbFR4edisNA3T6py9A`

---

## ⏳ AKTUÁLNÍ STAV VM

**Startup instalace běží** (spuštěno ~06:36 UTC, trvá 10-15 minut).

### Jak zkontrolovat, jestli je hotová:

```bash
# SSH do VM
gcloud compute ssh edex-ui-test --zone=europe-west4-a

# Zkontrolovat, jestli je setup hotový
cat /home/ubuntu/SETUP_COMPLETE.txt

# Sledovat progress instalace
sudo journalctl -u google-startup-scripts.service -f
```

Když soubor `SETUP_COMPLETE.txt` existuje, instalace je hotová a můžete se připojit přes VNC.

---

## 📋 CO DĚLAT DÁLE

### 1. Počkat na dokončení VM setupu (~10-15 minut od vytvoření)
Instalace běží automaticky. Zkontrolujte pomocí:
```bash
gcloud compute ssh edex-ui-test --zone=europe-west4-a -- "cat /home/ubuntu/SETUP_COMPLETE.txt"
```

### 2. Připojit se přes VNC
**Linux:**
```bash
# Nainstalovat VNC viewer
sudo apt install tigervnc-viewer
# nebo
sudo apt install xtightvncviewer

# Připojit se
vncviewer 34.141.153.47:5901
# Heslo: edexui2025
```

**Windows:**
1. Stáhnout TightVNC Viewer nebo RealVNC Viewer
2. Připojit na: `34.141.153.47:5901`
3. Heslo: `edexui2025`

### 3. Buildovat eDEX-UI ve VNC session
V terminále ve VNC:
```bash
cd ~/edex-ui
pnpm install
pnpm tauri build
```

### 4. Testovat aplikaci
Po buildu spustit:
```bash
./src-tauri/target/release/edex-ui
```

---

## 💰 NÁKLADY A SPRÁVA VM

### Ceny:
- **Running VM**: ~£0.43/hodinu (s GPU)
- **Stopped VM**: ~£0.01/hodinu (jen disk)
- **Celkem kreditů**: £910+ (vyprší různě 2025-2026)

### Správa VM:

**Zastavit VM** (když netestujete, ušetříte kredity):
```bash
gcloud compute instances stop edex-ui-test --zone=europe-west4-a
```

**Spustit zpět:**
```bash
gcloud compute instances start edex-ui-test --zone=europe-west4-a
```

**Získat novou IP** (po restartu se může změnit):
```bash
gcloud compute instances describe edex-ui-test \
    --zone=europe-west4-a \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

**Smazat VM** (když už ji nepotřebujete):
```bash
gcloud compute instances delete edex-ui-test --zone=europe-west4-a
```

---

## 🔧 ZNÁMÉ PROBLÉMY

### 1. Claude CLI Teleport nefunguje
Session `session_01XoKhTbFR4edisNA3T6py9A` má poškozenou historii:
```
API Error 400: tool_result without corresponding tool_use
```

**Workaround:** Začít nový chat a říct Claudeovi: "Přečti si CURRENT_STATE.md"

### 2. VM Startup může selhat
Pokud `SETUP_COMPLETE.txt` neexistuje i po 20 minutách:
```bash
# SSH do VM
gcloud compute ssh edex-ui-test --zone=europe-west4-a

# Zkontrolovat logy
sudo journalctl -u google-startup-scripts.service --no-pager

# Případně spustit startup skript manuálně
sudo bash /root/startup-script.sh
```

### 3. VNC nefunguje
```bash
# SSH do VM
gcloud compute ssh edex-ui-test --zone=europe-west4-a

# Zkontrolovat VNC status
sudo systemctl status vncserver@1

# Restartovat VNC
sudo systemctl restart vncserver@1
```

---

## 📚 DALŠÍ DOKUMENTACE

### V repository:
- `docs/v3.0-refactoring/` - Kompletní refaktoring dokumentace
- `docs/VOICE_SERVICES.md` - **Hlasové služby (Speech-to-Text / TTS)** 🎤🔊
- `gcloud-setup/` - Google Cloud setup skripty
- `README.md` - Hlavní README (možná zastaralý, refaktoring je nový)

### Git:
- **Remote:** `https://github.com/milhy545/edex-ui`
- **Current Branch:** `claude/analyze-codebase-principles-01XoKhTbFR4edisNA3T6py9A`
- **Last Commit:** `8dda569` - "feat: Add Google Cloud VM setup scripts for testing"

---

## 🎯 NEXT STEPS PRO NOVÉHO CLAUDA

Když začínáte nový chat:

1. **Přečtěte si tento soubor** (`CURRENT_STATE.md`)
2. **Zkontrolujte stav VM** (jestli běží a je setup hotový)
3. **Připojte se přes VNC** a otestujte build
4. **Reportujte problémy** nebo pokračujte ve vývoji

---

## 📞 KONTAKT / SESSION INFO

- **User Email (gcloud):** `stanislavmuller3@gmail.com`
- **User Local:** `milhy777` (`/home/milhy777/Plocha/Develop/edex-ui`)
- **Google Cloud Project:** `new-has-477501`
- **Original Session:** `session_01XoKhTbFR4edisNA3T6py9A` (poškozená, nepoužívat teleport)

---

**Vytvořeno:** 2025-11-18 ~07:00 UTC
**Poslední update:** 2025-11-18 ~07:00 UTC
**Status:** ✅ VM běží, čeká se na dokončení setupu
