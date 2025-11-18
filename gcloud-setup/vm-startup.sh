#!/bin/bash
# eDEX-UI Testing VM Startup Script
# This script automatically sets up a complete development environment

set -e

echo "=== Starting eDEX-UI VM Setup ==="

# Update system
echo "Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y

# Install desktop environment and VNC server
echo "Installing Ubuntu Desktop and VNC..."
apt-get install -y ubuntu-desktop-minimal
apt-get install -y tightvncserver xfce4 xfce4-goodies
apt-get install -y firefox chromium-browser

# Install development tools
echo "Installing development tools..."
apt-get install -y build-essential curl wget git vim
apt-get install -y pkg-config libssl-dev

# Install Tauri dependencies
echo "Installing Tauri dependencies..."
apt-get install -y \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf \
    libx11-dev \
    libxcb-render0-dev \
    libxcb-shape0-dev \
    libxcb-xfixes0-dev \
    libxkbcommon-dev \
    libssl-dev \
    libsoup-3.0-dev \
    libjavascriptcoregtk-4.1-dev

# Install Node.js 20.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Rust
echo "Installing Rust..."
export USER=ubuntu
export HOME=/home/ubuntu
su - ubuntu -c 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y'
su - ubuntu -c 'source $HOME/.cargo/env && rustup default stable'

# Install pnpm
echo "Installing pnpm..."
su - ubuntu -c 'curl -fsSL https://get.pnpm.io/install.sh | sh -'

# Clone eDEX-UI repository
echo "Cloning eDEX-UI repository..."
su - ubuntu -c 'cd /home/ubuntu && git clone https://github.com/milhy545/edex-ui.git'
su - ubuntu -c 'cd /home/ubuntu/edex-ui && git checkout claude/analyze-codebase-principles-01XoKhTbFR4edisNA3T6py9A'

# Setup VNC for user ubuntu
echo "Setting up VNC server..."
su - ubuntu -c 'mkdir -p /home/ubuntu/.vnc'
su - ubuntu -c 'echo "edexui2025" | vncpasswd -f > /home/ubuntu/.vnc/passwd'
chmod 600 /home/ubuntu/.vnc/passwd
chown -R ubuntu:ubuntu /home/ubuntu/.vnc

# Create VNC startup script
cat > /home/ubuntu/.vnc/xstartup << 'EOF'
#!/bin/bash
xrdb $HOME/.Xresources
startxfce4 &
EOF
chmod +x /home/ubuntu/.vnc/xstartup

# Create systemd service for VNC
cat > /etc/systemd/system/vncserver@.service << 'EOF'
[Unit]
Description=Start TightVNC server at startup
After=syslog.target network.target

[Service]
Type=forking
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu

PIDFile=/home/ubuntu/.vnc/%H:%i.pid
ExecStartPre=-/usr/bin/vncserver -kill :%i > /dev/null 2>&1
ExecStart=/usr/bin/vncserver -depth 24 -geometry 1920x1080 :%i
ExecStop=/usr/bin/vncserver -kill :%i

[Install]
WantedBy=multi-user.target
EOF

# Enable and start VNC
systemctl daemon-reload
systemctl enable vncserver@1.service
systemctl start vncserver@1.service

# Install VNC viewer info
echo "=== Setup Complete! ===" > /home/ubuntu/SETUP_COMPLETE.txt
echo "VNC Password: edexui2025" >> /home/ubuntu/SETUP_COMPLETE.txt
echo "VNC Port: 5901" >> /home/ubuntu/SETUP_COMPLETE.txt
echo "Connect to: <VM-EXTERNAL-IP>:5901" >> /home/ubuntu/SETUP_COMPLETE.txt
echo "" >> /home/ubuntu/SETUP_COMPLETE.txt
echo "To build eDEX-UI:" >> /home/ubuntu/SETUP_COMPLETE.txt
echo "  cd ~/edex-ui" >> /home/ubuntu/SETUP_COMPLETE.txt
echo "  pnpm install" >> /home/ubuntu/SETUP_COMPLETE.txt
echo "  pnpm tauri build" >> /home/ubuntu/SETUP_COMPLETE.txt

chown ubuntu:ubuntu /home/ubuntu/SETUP_COMPLETE.txt

echo "=== VM Setup Complete! ==="
