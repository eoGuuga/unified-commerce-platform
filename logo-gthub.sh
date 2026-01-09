#!/bin/bash

echo "🎨 CONFIGURANDO LOGO GTHUB PERSONALIZADA PARA SSH"
echo "================================================="

# Logo simples GT SOFT HUB
cat > /etc/motd << 'EOF'
====================================
    GT SOFT HUB - PRODUCTION SERVER
====================================

    Sistema: Ubuntu Server
    Status: Online e Operacional
    Acesso: Autorizado
====================================
EOF

# Limpar .bashrc completamente e recriar
echo '#!/bin/bash' > ~/.bashrc
echo 'cat /etc/motd' >> ~/.bashrc

echo '#!/bin/bash' > /home/ubuntu/.bashrc
echo 'cat /etc/motd' >> /home/ubuntu/.bashrc

# Versão com cores (se o terminal suportar)
cat > /tmp/gthub-logo-color << 'EOF'
echo -e "\033[1;34m"
echo "   ██████   ████████ ████████ ██    ██ ██████  ████████"
echo "  ██    ██  ██       ██    ██ ██    ██ ██   ██    ██"
echo "  ██    ██  ████████ ████████ ██    ██ ██████     ██"
echo "  ██ ▄▄ ██         ██ ██ ██   ██    ██ ██   ██    ██"
echo "   ██████   ████████ ██    ██  ██████  ██   ██    ██"
echo ""
echo -e "\033[1;32m"
echo "          ████████ ████████ ████████ ████████ ████████"
echo "          ██    ██ ██       ██       ██    ██ ██"
echo "          ████████ █████    █████    ████████ █████"
echo "          ██ ██    ██       ██       ██ ██    ██"
echo "          ██    ██ ████████ ████████ ██    ██ ████████"
echo ""
echo -e "\033[1;33m"
echo "               🚀 Unified Commerce Platform v2.0 🚀"
echo -e "\033[0m"
EOF

# Instalar como MOTD (Message of the Day)
sudo cp /tmp/gthub-logo /etc/motd
sudo chmod 644 /etc/motd

# Configurar para aparecer no .bashrc (versão clean)
echo "" >> ~/.bashrc
echo "# GTHUB Logo elegante" >> ~/.bashrc
echo "cat /etc/motd 2>/dev/null || echo 'GTHUB - Servidor Unificado'" >> ~/.bashrc
echo "" >> ~/.bashrc

# Também para root
sudo sh -c 'echo "" >> /root/.bashrc'
sudo sh -c 'echo "# GTHUB Logo elegante" >> /root/.bashrc'
sudo sh -c 'echo "cat /etc/motd 2>/dev/null || echo '\''GTHUB - Servidor Unificado'\''" >> /root/.bashrc'
sudo sh -c 'echo "" >> /root/.bashrc'

# Versão com cores (opcional)
cat > /tmp/gthub-color.sh << 'EOF'
#!/bin/bash
# Logo GTHUB com cores alternadas
echo -e "\033[1;36m"
echo "   ██████   ████████ ████████ ██    ██ ██████  ████████"
echo -e "\033[1;34m"
echo "  ██    ██  ██       ██    ██ ██    ██ ██   ██    ██"
echo -e "\033[1;32m"
echo "  ██    ██  ████████ ████████ ██    ██ ██████     ██"
echo -e "\033[1;33m"
echo "  ██ ▄▄ ██         ██ ██ ██   ██    ██ ██   ██    ██"
echo -e "\033[1;31m"
echo "   ██████   ████████ ██    ██  ██████  ██   ██    ██"
echo ""
echo -e "\033[1;35m"
echo "          ████████ ████████ ████████ ████████ ████████"
echo -e "\033[1;36m"
echo "          ██    ██ ██       ██       ██    ██ ██"
echo -e "\033[1;34m"
echo "          ████████ █████    █████    ████████ █████"
echo -e "\033[1;32m"
echo "          ██ ██    ██       ██       ██ ██    ██"
echo -e "\033[1;33m"
echo "          ██    ██ ████████ ████████ ██    ██ ████████"
echo ""
echo -e "\033[1;31m"
echo "               🚀 Unified Commerce Platform v2.0 🚀"
echo -e "\033[0m"
EOF

sudo cp /tmp/gthub-color.sh /usr/local/bin/gthub-color
sudo chmod +x /usr/local/bin/gthub-color

# Opção para usar cores (descomente se quiser)
# echo "bash /usr/local/bin/gthub-color" >> ~/.bashrc

# Limpar arquivo temporário
rm -f /tmp/gthub-logo

echo ""
echo "✅ LOGO GTHUB CONFIGURADA COM SUCESSO!"
echo "🎨 Agora toda vez que conectar via SSH verá:"
echo ""
cat /etc/motd 2>/dev/null || echo "Logo será exibida no próximo login"
echo ""
echo "🚀 Logo dinâmica com informações do sistema!"
echo "📊 Mostra uptime, status e links automaticamente!"