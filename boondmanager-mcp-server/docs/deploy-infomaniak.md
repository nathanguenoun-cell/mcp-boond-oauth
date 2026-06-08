# Mode opératoire — Déploiement BoondManager MCP sur Infomaniak VPS

> **Public cible** : administrateur technique du client  
> **Durée estimée** : 45–90 minutes (hors attente DNS)  
> **Prérequis niveau** : Linux basique (SSH, copier-coller), pas de développement requis

---

## Vue d'ensemble

Le serveur MCP BoondManager s'exécute comme un **conteneur Docker** sur un VPS Infomaniak. Il expose une API HTTPS que Claude Desktop ou Claude Code interroge pour interagir avec BoondManager en langage naturel.

```
Claude Desktop / Claude Code
        │
        │  HTTPS  (MCP sur SSE)
        ▼
  mcp.votre-domaine.com   ← nginx (reverse proxy TLS)
        │
        │  HTTP localhost:3000
        ▼
  Conteneur Docker MCP    ← boondmanager-mcp-server:2.1.0
        │
        │  HTTPS API
        ▼
  ui.boondmanager.com/api
```

L'authentification est **OAuth2** : le serveur MCP ne stocke aucun secret BoondManager — chaque utilisateur se connecte avec son propre compte via un flow OAuth standard dans le navigateur.

---

## Ressources fournies

Tous les fichiers ci-dessous sont dans le dossier remis avec ce document :

| Fichier | Rôle |
|---------|------|
| `docker-compose.yml` | Stack Docker complète (MCP + Redis) |
| `.env.example` | Template de configuration (à compléter) |
| `nginx/boondmanager-mcp.conf` | Configuration nginx reverse proxy |

---

## Étape 1 — VPS Infomaniak

### 1.1 Commander le VPS

1. Connectez-vous à votre espace Infomaniak : **Manager → Cloud VPS**
2. Créer un nouveau VPS avec la configuration minimale :
   - **OS** : Ubuntu 24.04 LTS (recommandé)
   - **RAM** : 2 Go minimum (4 Go recommandé)
   - **Stockage** : 20 Go
3. Notez l'**adresse IP publique** du VPS (ex: `185.x.x.x`)

### 1.2 Se connecter en SSH

```bash
ssh ubuntu@185.x.x.x
# Remplacer 185.x.x.x par l'IP de votre VPS
```

### 1.3 Installer Docker

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation Docker (méthode officielle)
curl -fsSL https://get.docker.com | sudo sh

# Ajouter votre utilisateur au groupe docker (évite sudo)
sudo usermod -aG docker $USER
newgrp docker

# Vérifier l'installation
docker --version
docker compose version
```

---

## Étape 2 — DNS et sous-domaine

### 2.1 Créer le sous-domaine

1. Dans le Manager Infomaniak : **Domaines → votre-domaine.com → Zone DNS**
2. Ajouter un enregistrement de type **A** :
   - **Nom** : `mcp` (donnera `mcp.votre-domaine.com`)
   - **Cible** : IP publique du VPS (`185.x.x.x`)
   - **TTL** : 3600 (1 heure)
3. Enregistrer — la propagation DNS prend **5 à 30 minutes**

### 2.2 Vérifier la propagation

```bash
# Depuis votre machine locale ou le VPS
nslookup mcp.votre-domaine.com
# Doit retourner votre IP de VPS
```

---

## Étape 3 — Configurer l'application OAuth dans BoondManager

> **Qui fait cette étape ?** Un administrateur BoondManager avec accès à l'Espace Développeur.

1. Dans BoondManager : **Administration → Apps → Security**
2. Activer **OAuth2**
3. Ajouter une **URL de redirection** :
   ```
   https://mcp.votre-domaine.com/callback
   ```
   > Note : cette URL sera aussi demandée par Claude Desktop — à confirmer avec l'éditeur du client MCP utilisé.
4. Dans **Authorized APIs**, cocher les accès nécessaires (lecture, écriture selon les besoins)
5. Noter les valeurs suivantes (vous en aurez besoin à l'étape 4) :
   - **Client ID**
   - **Client Secret**
   - **Authorization URL** (ex: `https://ui.boondmanager.com/oauth/authorize`)
   - **Token URL** (ex: `https://ui.boondmanager.com/oauth/token`)

---

## Étape 4 — Déployer le serveur MCP

### 4.1 Créer le répertoire de travail

```bash
sudo mkdir -p /opt/boondmanager-mcp
sudo chown $USER:$USER /opt/boondmanager-mcp
cd /opt/boondmanager-mcp
```

### 4.2 Copier les fichiers

Transférez les fichiers fournis sur le VPS. Depuis votre machine locale :

```bash
scp docker-compose.yml ubuntu@185.x.x.x:/opt/boondmanager-mcp/
scp .env.example ubuntu@185.x.x.x:/opt/boondmanager-mcp/
```

Ou créez-les directement sur le VPS via copier-coller (voir section [Contenu des fichiers](#contenu-des-fichiers-de-référence)).

### 4.3 Créer le fichier `.env`

```bash
cd /opt/boondmanager-mcp
cp .env.example .env
nano .env
```

Remplissez les valeurs :

```bash
# URL publique de votre serveur MCP (avec /mcp à la fin)
MCP_HTTP_PUBLIC_URL=https://mcp.votre-domaine.com/mcp

# Identifiants OAuth obtenus à l'étape 3
BOOND_OAUTH_CLIENT_ID=VOTRE_CLIENT_ID
BOOND_OAUTH_CLIENT_SECRET=VOTRE_CLIENT_SECRET

# URLs OAuth BoondManager (ne pas modifier sauf instance personnalisée)
BOOND_OAUTH_AUTH_URL=https://ui.boondmanager.com/oauth/authorize
BOOND_OAUTH_TOKEN_URL=https://ui.boondmanager.com/oauth/token

# Durée de session en jours (90 = reconnexion tous les 90 jours)
BOOND_SESSION_TTL_DAYS=90
```

Sauvegarder avec **Ctrl+O**, quitter avec **Ctrl+X**.

### 4.4 Démarrer les conteneurs

```bash
cd /opt/boondmanager-mcp
docker compose pull
docker compose up -d
```

### 4.5 Vérifier que tout tourne

```bash
# Statut des conteneurs
docker compose ps

# Logs du serveur MCP (Ctrl+C pour quitter)
docker compose logs -f mcp
```

Vous devriez voir des lignes comme :
```
boondmanager-mcp  | {"level":"info","msg":"MCP server started","transport":"http","port":3000}
```

---

## Étape 5 — Configurer nginx (reverse proxy HTTPS)

### 5.1 Installer nginx et certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 5.2 Copier la configuration nginx

```bash
sudo cp nginx/boondmanager-mcp.conf /etc/nginx/sites-available/boondmanager-mcp
```

Si vous n'avez pas le fichier fourni, créez-le :

```bash
sudo nano /etc/nginx/sites-available/boondmanager-mcp
```

Collez le contenu du fichier `nginx/boondmanager-mcp.conf` fourni en remplaçant `mcp.VOTRE-DOMAINE.com` par votre sous-domaine réel.

### 5.3 Activer le site

```bash
# Remplacer mcp.votre-domaine.com par votre sous-domaine réel dans la conf d'abord
sudo sed -i 's/mcp.VOTRE-DOMAINE.com/mcp.votre-domaine.com/g' \
  /etc/nginx/sites-available/boondmanager-mcp

# Activer le site
sudo ln -s /etc/nginx/sites-available/boondmanager-mcp \
           /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Recharger nginx
sudo systemctl reload nginx
```

### 5.4 Obtenir le certificat HTTPS (Let's Encrypt)

> Le DNS doit être propagé avant cette étape (vérifier avec `nslookup`).

```bash
sudo certbot --nginx \
  -d mcp.votre-domaine.com \
  --non-interactive \
  --agree-tos \
  -m admin@votre-domaine.com
```

Certbot modifie automatiquement la conf nginx pour activer TLS et met en place le renouvellement automatique.

### 5.5 Vérifier HTTPS

Depuis votre navigateur ou un terminal :

```bash
curl https://mcp.votre-domaine.com/.well-known/oauth-protected-resource
```

Vous devez recevoir un JSON semblable à :
```json
{
  "resource": "https://mcp.votre-domaine.com/mcp",
  "authorization_servers": ["https://ui.boondmanager.com"]
}
```

Si vous obtenez ce JSON → **le serveur est opérationnel**.

---

## Étape 6 — Configurer Claude Desktop ou Claude Code

### Claude Desktop

Ouvrez le fichier de configuration de Claude Desktop :
- **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** : `%APPDATA%\Claude\claude_desktop_config.json`

Ajoutez l'entrée suivante dans `mcpServers` :

```json
{
  "mcpServers": {
    "boondmanager": {
      "url": "https://mcp.votre-domaine.com/mcp",
      "transport": "http"
    }
  }
}
```

Redémarrez Claude Desktop. Au premier lancement, une fenêtre de navigateur s'ouvrira pour vous connecter à BoondManager — c'est le flow OAuth normal.

### Claude Code (CLI)

```bash
claude mcp add boondmanager \
  --transport http \
  --url https://mcp.votre-domaine.com/mcp
```

---

## Maintenance

### Mettre à jour le serveur MCP

```bash
cd /opt/boondmanager-mcp
# Modifier docker-compose.yml pour bumper le tag de version si nécessaire
docker compose pull
docker compose up -d
```

### Consulter les logs

```bash
# Logs temps réel
docker compose logs -f mcp

# Dernières 100 lignes
docker compose logs --tail=100 mcp
```

### Redémarrer le service

```bash
docker compose restart mcp
```

### Arrêter complètement

```bash
docker compose down
```

### Renouvellement SSL

Le renouvellement Let's Encrypt est automatique via un timer systemd installé par certbot. Pour vérifier :
```bash
sudo certbot renew --dry-run
```

---

## Résolution de problèmes

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| `curl` vers `/.well-known/…` retourne une erreur de connexion | nginx non démarré ou port 443 bloqué | `sudo systemctl status nginx` ; vérifier le firewall (`sudo ufw status`) |
| Conteneur MCP en état `unhealthy` | `.env` incomplet ou Redis non démarré | `docker compose logs mcp` pour les détails |
| Erreur `401` dans Claude après connexion OAuth | Token mal transmis ou URL publique incorrecte | Vérifier que `MCP_HTTP_PUBLIC_URL` dans `.env` correspond exactement à l'URL dans la conf nginx |
| Page blanche au lieu du JSON OAuth discovery | `proxy_buffering off` absent de nginx | Vérifier la conf nginx ; recharger avec `sudo nginx -t && sudo systemctl reload nginx` |
| Claude affiche "Erreur de connexion MCP" | DNS pas propagé ou certificat expiré | `nslookup mcp.votre-domaine.com` ; `sudo certbot certificates` |

---

## Contenu des fichiers de référence

### `docker-compose.yml`

```yaml
services:
  mcp:
    image: ghcr.io/fauguste/boondmanager-mcp-server:2.1.0
    container_name: boondmanager-mcp
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    environment:
      MCP_TRANSPORT: http
      MCP_HTTP_HOST: "0.0.0.0"
      MCP_HTTP_PORT: "3000"
      MCP_HTTP_PATH: /mcp
      MCP_HTTP_STATEFUL: "false"
      MCP_HTTP_ALLOWED_HOSTS: "*"
      REDIS_URL: "redis://redis:6379"
      NODE_ENV: production
      LOG_LEVEL: info
      LOG_FORMAT: json
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/.well-known/oauth-protected-resource').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  redis:
    image: redis:7-alpine
    container_name: boondmanager-redis
    restart: unless-stopped
    command: redis-server --save 900 1 --save 300 10 --appendonly yes
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  redis-data:
    driver: local
```

### `.env` (à remplir)

```bash
MCP_HTTP_PUBLIC_URL=https://mcp.votre-domaine.com/mcp
BOOND_OAUTH_CLIENT_ID=
BOOND_OAUTH_CLIENT_SECRET=
BOOND_OAUTH_AUTH_URL=https://ui.boondmanager.com/oauth/authorize
BOOND_OAUTH_TOKEN_URL=https://ui.boondmanager.com/oauth/token
BOOND_SESSION_TTL_DAYS=90
```

### `nginx/boondmanager-mcp.conf`

```nginx
limit_req_zone $binary_remote_addr zone=mcp_limit:10m rate=10r/s;

server {
    listen 80;
    server_name mcp.votre-domaine.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name mcp.votre-domaine.com;

    ssl_certificate     /etc/letsencrypt/live/mcp.votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.votre-domaine.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        add_header X-Accel-Buffering "no" always;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        "";

        proxy_read_timeout    120s;
        proxy_connect_timeout  10s;
        proxy_send_timeout     30s;
        client_max_body_size 10m;

        limit_req zone=mcp_limit burst=20 nodelay;
        limit_req_status 429;
    }

    access_log /var/log/nginx/boondmanager-mcp-access.log combined;
    error_log  /var/log/nginx/boondmanager-mcp-error.log warn;
}
```

---

## Checklist finale

- [ ] VPS Infomaniak commandé et accessible en SSH
- [ ] Docker installé (`docker --version` OK)
- [ ] Sous-domaine DNS créé et propagé (`nslookup` retourne l'IP du VPS)
- [ ] Application OAuth créée dans BoondManager (Client ID + Secret notés)
- [ ] Fichier `.env` complété dans `/opt/boondmanager-mcp/`
- [ ] `docker compose up -d` → 2 conteneurs `running`
- [ ] nginx installé et configuration en place
- [ ] Certificat Let's Encrypt obtenu
- [ ] `curl https://mcp.votre-domaine.com/.well-known/oauth-protected-resource` retourne du JSON
- [ ] Claude Desktop/Code configuré avec l'URL du serveur
- [ ] Connexion OAuth testée (navigateur s'ouvre, connexion à BoondManager réussie)
- [ ] Premier outil testé dans Claude (ex: "Liste les 5 dernières opportunités dans BoondManager")
