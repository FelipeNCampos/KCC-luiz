# Deploy em VPS Ubuntu

## Instalar Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Faça logout/login após adicionar o usuário ao grupo `docker`.

## Subir Produção

```bash
cp .env.example .env
nano .env
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

O Compose de produção publica apenas `127.0.0.1:18080` por padrão. As portas 80 e 443 continuam sob controle do Nginx principal da VPS.

## Atualização com Mínimo Downtime

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker compose -f docker-compose.prod.yml ps
```

Para stacks pequenos, esse fluxo recria os containers rapidamente e mantém o banco persistente em volume Docker. Para zero downtime real, evolua para duas réplicas de backend ou um orquestrador.

## Certificados

Se o Nginx principal já usa Certbot:

```bash
sudo certbot --nginx -d novoapp.seudominio.com
sudo systemctl reload nginx
```

A renovação fica no Nginx principal. Este stack não precisa conhecer os certificados.
