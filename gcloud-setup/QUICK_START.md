# ⚡ Rychlý Start - 5 Příkazů

Zkopírujte a spusťte postupně:

```bash
# 1. Nastavte projekt
gcloud config set project new-has

# 2. Povolte Compute Engine API
gcloud services enable compute.googleapis.com

# 3. Vytvořte firewall pravidlo pro VNC
gcloud compute firewall-rules create allow-vnc \
    --allow tcp:5901 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow VNC connections"

# 4. Vytvořte VM (S GPU - doporučeno)
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

# 5. Získejte IP adresu
gcloud compute instances describe edex-ui-test \
    --zone=europe-west1-b \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

## Počkejte 10-15 minut na setup

Sledujte progress:
```bash
gcloud compute ssh edex-ui-test --zone=europe-west1-b -- "sudo tail -f /var/log/syslog | grep startup-script"
```

## Připojte se přes VNC

- **Adresa**: `<IP-z-kroku-5>:5901`
- **Heslo**: `edexui2025`

## V VNC session spusťte build:

```bash
cd ~/edex-ui
pnpm install
pnpm tauri build
```

## Vypněte VM když nepoužíváte:

```bash
# Zastavit (nezabírá compute čas, jen disk)
gcloud compute instances stop edex-ui-test --zone=europe-west1-b

# Zapnout zpět
gcloud compute instances start edex-ui-test --zone=europe-west1-b

# Smazat úplně
gcloud compute instances delete edex-ui-test --zone=europe-west1-b
```

---

## Troubleshooting

**Firewall rule už existuje?**
```bash
gcloud compute firewall-rules delete allow-vnc
# Pak zkuste příkaz #3 znovu
```

**VM s GPU není dostupná v zóně?**
Zkuste jinou zónu:
- `europe-west1-b` → `europe-west1-c`
- nebo `europe-west4-a` (Holandsko)

**VNC nefunguje?**
```bash
# Zkontrolujte status VNC serveru
gcloud compute ssh edex-ui-test --zone=europe-west1-b
sudo systemctl status vncserver@1
```
