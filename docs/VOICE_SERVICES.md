# Hlasové Služby pro Claude - Speech-to-Text a Text-to-Speech

**Datum:** 2025-11-18

---

## 🎤 SPEECH-TO-TEXT (Diktování)

### Možnost 1: Claude.ai Vestavěné Diktování (NEJJEDNODUŠŠÍ)

Claude.ai web interface má **vestavěné diktování přímo v textovém poli**:

1. Otevřete https://claude.ai
2. V textovém poli pro zprávy najděte **ikonu mikrofonu** 🎤
3. Klikněte a mluvte
4. Claude automaticky přepíše řeč na text

**Výhody:**
- ✅ Žádná instalace
- ✅ Funguje okamžitě
- ✅ Zdarma
- ✅ Kvalitní přepis

**Nevýhody:**
- ❌ Funguje jen v Claude web UI (ne v CLI)
- ❌ Vyžaduje internetové připojení

---

### Možnost 2: Google Cloud Speech-to-Text (PRO INTEGRACE)

Už máte Google Cloud kredity (£910+), můžete využít profesionální API:

**Setup:**
```bash
# Povolit Speech-to-Text API
gcloud services enable speech.googleapis.com

# Test přes gcloud
gcloud ml speech recognize 'gs://cloud-samples-tests/speech/brooklyn.flac' --language-code='en-US'
```

**Ceny:**
- První 60 minut/měsíc: ZDARMA
- Pak: ~$0.006/15 sekund (~£0.005)
- S vašimi kredity: ~182 000 minut (3000+ hodin)

**Pro integraci s Claude CLI:**
Můžete vytvořit wrapper skript, který:
1. Nahraje audio z mikrofonu
2. Pošle na Google Speech API
3. Přepis pošle do `claude` příkazu

---

### Možnost 3: OpenAI Whisper (LOKÁLNÍ, OFFLINE)

**Instalace:**
```bash
# Python + Whisper
pip install openai-whisper

# Nebo použít whisper.cpp (rychlejší, C++)
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make
```

**Použití:**
```bash
# Nahrát audio z mikrofonu
ffmpeg -f alsa -i default -t 10 input.wav

# Přepsat na text
whisper input.wav --model base --language cs

# Nebo anglicky
whisper input.wav --model base --language en
```

**Výhody:**
- ✅ Offline (žádný cloud)
- ✅ Zdarma
- ✅ Podpora češtiny!
- ✅ Vysoká kvalita

**Nevýhody:**
- ❌ Vyžaduje instalaci
- ❌ Vyžaduje slušný CPU/GPU

---

### Možnost 4: OS Vestavěné Diktování

**Linux (váš případ):**
```bash
# Nerd Dictation (offline speech recognition)
git clone https://github.com/ideasman42/nerd-dictation
cd nerd-dictation
pip install -r requirements.txt

# Spustit
./nerd-dictation begin --vosk-model-dir=./model

# Mluvit...
# Ukončit
./nerd-dictation end
```

**Výhody:**
- ✅ Offline
- ✅ Zdarma
- ✅ Integrace s libovolnou aplikací

---

## 🔊 TEXT-TO-SPEECH (Přehrávání odpovědí)

### Možnost 1: Claude.ai Vestavěný TTS (DOPORUČENO)

Claude.ai má **vestavěnou funkci čtení odpovědí**:

1. V Claude web UI najděte odpověď
2. Klikněte na **ikonu reproduktoru** 🔊 vedle odpovědi
3. Claude přečte odpověď hlasem

**Výhody:**
- ✅ Žádná instalace
- ✅ Kvalitní hlas
- ✅ Funguje okamžitě

---

### Možnost 2: Browser Extension - Read Aloud

**Instalace:**
- Firefox: https://addons.mozilla.org/firefox/addon/read-aloud/
- Chrome: https://chrome.google.com/webstore (hledejte "Read Aloud")

**Použití:**
1. Označte text v Claude odpovědi
2. Pravé tlačítko → "Read Aloud"
3. Extension přečte text

**Výhody:**
- ✅ Funguje všude (nejen Claude)
- ✅ Mnoho hlasů (včetně češtiny)
- ✅ Ovládání rychlosti

---

### Možnost 3: Google Cloud Text-to-Speech

**Setup:**
```bash
# Povolit TTS API
gcloud services enable texttospeech.googleapis.com

# Test
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "input": {"text": "Ahoj, tohle je test Google Cloud Text-to-Speech."},
    "voice": {"languageCode": "cs-CZ", "name": "cs-CZ-Wavenet-A"},
    "audioConfig": {"audioEncoding": "MP3"}
  }' \
  "https://texttospeech.googleapis.com/v1/text:synthesize" \
  | jq -r '.audioContent' | base64 -d > output.mp3

# Přehrát
mpg123 output.mp3
```

**Ceny:**
- První 1 milion znaků/měsíc: ZDARMA (Wavenet hlasy: 4 miliony znaků)
- Pak: ~$16/milion znaků (~£12)
- S vašimi kredity: ~75+ milionů znaků

**Hlasy v češtině:**
- `cs-CZ-Wavenet-A` (ženský)
- `cs-CZ-Standard-A` (ženský)

---

### Možnost 4: Lokální TTS (Offline)

**Linux - eSpeak:**
```bash
# Instalace
sudo apt install espeak

# Použití
espeak "Hello, this is a test"

# Česky (variabilní kvalita)
espeak -v cs "Ahoj, tohle je test"
```

**Lepší kvalita - Piper TTS:**
```bash
# Instalace
pip install piper-tts

# Stáhnout český model
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/cs_CZ-jirka-medium.onnx

# Použití
echo "Ahoj, tohle je test" | piper --model cs_CZ-jirka-medium.onnx --output_file output.wav
aplay output.wav
```

---

## 🎯 DOPORUČENÉ SETUP PRO VÁS

### Pro začátek (nejjednodušší):

1. **Diktování:** Používejte **Claude.ai web interface** s vestavěným mikrofonem 🎤
2. **Přehrávání:** Používejte **Claude.ai TTS** (ikona reproduktoru 🔊)

**Žádná instalace, funguje okamžitě!**

---

### Pro pokročilé (offline + integrace):

1. **Diktování:**
   - Nainstalujte **Whisper** (podporuje češtinu, offline)
   - Vytvořte wrapper skript pro Claude CLI

2. **Přehrávání:**
   - Nainstalujte **Piper TTS** (čeští hlasové modely)
   - Nebo použijte **Google Cloud TTS** (už máte kredity)

---

### Wrapper Skript Příklad (Speech → Claude → TTS):

```bash
#!/bin/bash
# voice-claude.sh - Hlasové rozhraní pro Claude

# 1. Nahrát audio (5 sekund)
echo "🎤 Mluvte..."
ffmpeg -f alsa -i default -t 5 -y /tmp/input.wav 2>/dev/null

# 2. Přepsat pomocí Whisper
echo "🔄 Přepisuji..."
PROMPT=$(whisper /tmp/input.wav --model base --language cs --output_format txt --output_dir /tmp 2>/dev/null | tail -n1)

echo "📝 Řekli jste: $PROMPT"

# 3. Poslat do Claude
echo "🤖 Claude odpovídá..."
RESPONSE=$(claude "$PROMPT")

echo "$RESPONSE"

# 4. Přečíst odpověď
echo "🔊 Přehrávám odpověď..."
echo "$RESPONSE" | piper --model ~/models/cs_CZ-jirka-medium.onnx --output_file /tmp/output.wav 2>/dev/null
aplay /tmp/output.wav 2>/dev/null

echo "✅ Hotovo!"
```

**Použití:**
```bash
chmod +x voice-claude.sh
./voice-claude.sh
```

---

## 📋 NEXT STEPS

1. **Vyzkoušejte Claude.ai web TTS** (nejrychlejší start)
2. **Pokud chcete offline:** Nainstalujte Whisper + Piper
3. **Pokud chcete nejlepší kvalitu:** Použijte Google Cloud Speech + TTS (už máte kredity)

---

Chcete, abych vám pomohl nastavit nějakou z těchto možností? 🎤🔊
