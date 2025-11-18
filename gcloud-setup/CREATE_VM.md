# Vytvoření eDEX-UI testovací VM na Google Cloud

## Krok 1: Nastavte projekt

```bash
gcloud config set project new-has
```

## Krok 2: Povolte potřebná API

```bash
gcloud services enable compute.googleapis.com
```

## Krok 3: Vytvořte firewall pravidlo pro VNC

```bash
gcloud compute firewall-rules create allow-vnc \
    --allow tcp:5901 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow VNC connections on port 5901"
```

## Krok 4: Vytvořte VM instanci

**VARIANTA A: S GPU (doporučeno pro WebGPU testování)**

```bash
gcloud compute instances create edex-ui-test \
    --zone=europe-west1-b \
    --machine-type=n1-standard-4 \
    --accelerator=type=nvidia-tesla-t4,count=1 \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-balanced \
    --metadata-from-file startup-script=gcloud-setup/vm-startup.sh \
    --maintenance-policy=TERMINATE \
    --scopes=https://www.googleapis.com/auth/cloud-platform
```

**VARIANTA B: Bez GPU (levnější, pro základní testování)**

```bash
gcloud compute instances create edex-ui-test \
    --zone=europe-west1-b \
    --machine-type=n1-standard-4 \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --boot-disk-type=pd-balanced \
    --metadata-from-file startup-script=gcloud-setup/vm-startup.sh \
    --scopes=https://www.googleapis.com/auth/cloud-platform
```

## Krok 5: Počkejte na dokončení setupu

Setup trvá cca 10-15 minut. Sledujte progress:

```bash
# Získejte externí IP
gcloud compute instances describe edex-ui-test \
    --zone=europe-west1-b \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)'

# SSH do VM a sledujte startup log
gcloud compute ssh edex-ui-test --zone=europe-west1-b

# Ve VM zkontrolujte:
sudo tail -f /var/log/syslog | grep startup-script
```

Když uvidíte "Setup Complete!", je VM připravena!

## Krok 6: Připojte se přes VNC

### Windows:
1. Stáhněte **TightVNC Viewer** nebo **RealVNC Viewer**
2. Připojte se na: `<EXTERNAL-IP>:5901`
3. Heslo: `edexui2025`

### macOS:
1. Použijte vestavěný **Screen Sharing**
2. Nebo stáhněte **RealVNC Viewer**
3. Připojte se na: `<EXTERNAL-IP>:5901`
4. Heslo: `edexui2025`

### Linux:
```bash
vncviewer <EXTERNAL-IP>:5901
# Heslo: edexui2025
```

## Krok 7: Buildujte eDEX-UI

V VNC session otevřete terminál a spusťte:

```bash
cd ~/edex-ui
pnpm install
pnpm tauri build
```

## Smazání VM (když skončíte)

```bash
gcloud compute instances delete edex-ui-test --zone=europe-west1-b
```

## Ceny (odhadem):

- **n1-standard-4**: ~$0.19/hodinu
- **NVIDIA Tesla T4 GPU**: ~$0.35/hodinu
- **50GB disk**: ~$0.01/hodinu
- **Celkem s GPU**: ~$0.55/hodinu (~£0.43/hodinu)
- **Celkem bez GPU**: ~$0.20/hodinu (~£0.16/hodinu)

S vašimi £910 kredity můžete provozovat:
- **VM s GPU**: ~2100 hodin (88 dní 24/7)
- **VM bez GPU**: ~5700 hodin (237 dní 24/7)

**Doporučení**: Zapněte VM jen když testujete, ušetříte kredity!
