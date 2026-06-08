# Déploiement BoondManager MCP — Guide complet Infomaniak

> **Version du serveur MCP** : `2.1.0`  
> **Image Docker** : `ghcr.io/nathanguenoun-cell/mcp-boond-oauth:2.1.0`  
> **Durée estimée** : 60–90 minutes  
> **Prérequis niveau** : accès SSH basique, pas de développement requis

---

## Ce que vous allez obtenir

Un serveur MCP BoondManager accessible en HTTPS depuis **Dust**, permettant d'interroger et modifier vos données BoondManager en langage naturel.

**167 outils disponibles** : candidats, ressources, contacts, sociétés, opportunités, projets, factures, commandes, feuilles de temps, absences, notes de frais, et plus.

**Corrections incluses dans cette version** :
- Toutes les mises à jour (PUT) ciblent le bon endpoint `/{entité}/{id}/information`
- Refresh automatique des tokens OAuth (reconnexion transparente)
- Sessions persistantes 90 jours

---

## Informations à collecter avant de commencer

Avant de démarrer, réunissez ces éléments. Vous en aurez besoin à différentes étapes.

### Côté BoondManager (étape 2)

| Information | Où la trouver | Exemple |
|-------------|---------------|---------|
| Client ID OAuth | BoondManager → Administration → Apps → Security | `abc123` |
| Client Secret OAuth | Même page | `xyz789...` |
| URL d'autorisation | Même page | `https://ui.boondmanager.com/api/oauth2/authorize` |
| URL de token | Même page | `https://ui.boondmanager.com/api/oauth2/token` |

### Côté Infomaniak (étapes 1 et 3)

| Information | Où la trouver | Exemple |
|-------------|---------------|---------|
| IP du VPS | Manager Infomaniak → Cloud VPS | `185.x.x.x` |
| Nom de domaine | Votre domaine existant | `votre-domaine.com` |
| Sous-domaine souhaité | À choisir | `mcp.votre-domaine.com` |
| Email admin | Le vôtre | `admin@votre-domaine.com` |

---

## Étape 1 — Commande et configuration du VPS Infomaniak

### 1.1 Commander le VPS

1. Connectez-vous à **manager.infomaniak.com**
2. Menu **Cloud VPS → Commander**
3. Configuration minimale recommandée :
   - OS : **Ubuntu 24.04 LTS**
   - RAM : **2 Go** (4 Go conseillé)
   - Stockage : **20 Go**
4. Notez l'**adresse IP publique** du VPS (visible dans le dashboard après livraison)

### 1.2 Première connexion SSH

```bash
ssh ubuntu@185.x.x.x
# Remplacez 185.x.x.x par l'IP réelle de votre VPS
```

Si vous avez une clé SSH différente :
```bash
ssh -i ~/.ssh/votre_cle ubuntu@185.x.x.x
```

### 1.3 Installer Docker

Copiez-collez ce bloc en une seule fois :

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

Vérifiez :
```bash
docker --version
docker compose version
```

Les deux commandes doivent retourner un numéro de version sans erreur.

---

## Étape 2 — Créer l'application OAuth dans BoondManager

> Cette étape nécessite un accès **Administrateur** à BoondManager.

1. Dans BoondManager : **Administration → Apps → onglet Security**
2. Activez **OAuth2** (toggle en haut de page)
3. Dans **Redirect URIs**, ajoutez :
   ```
   https://mcp.votre-domaine.com/auth/callback
   ```
   > Remplacez `mcp.votre-domaine.com` par votre sous-domaine réel. Le serveur MCP gère lui-même le callback OAuth à ce chemin.
4. Dans **Authorized APIs**, activez les accès nécessaires (au minimum : Lecture de toutes les ressources)
5. **Sauvegardez** et relevez les valeurs affichées :

```
Client ID     : ___________________________
Client Secret : ___________________________
Auth URL      : ___________________________
Token URL     : ___________________________
```

> **Important** : le Client Secret n'est affiché qu'une seule fois. Copiez-le immédiatement.

---

## Étape 3 — Configurer le DNS

### 3.1 Créer l'enregistrement DNS

Dans **manager.infomaniak.com → Domaines → votre-domaine.com → Zone DNS** :

| Champ | Valeur |
|-------|--------|
| Type | `A` |
| Nom/Hôte | `mcp` |
| Cible/Valeur | IP du VPS (`185.x.x.x`) |
| TTL | `3600` |

### 3.2 Attendre la propagation

La propagation DNS prend **5 à 30 minutes**. Vérifiez depuis n'importe quel terminal :

```bash
nslookup mcp.votre-domaine.com
# Doit retourner l'IP de votre VPS
```

Ne passez pas à l'étape suivante tant que le DNS ne répond pas.

---

## Étape 4 — Déployer le serveur MCP

### 4.1 Créer le répertoire de travail (sur le VPS)

```bash
sudo mkdir -p /opt/boondmanager-mcp
sudo chown $USER:$USER /opt/boondmanager-mcp
cd /opt/boondmanager-mcp
```

### 4.2 Créer le fichier `docker-compose.yml`

```bash
nano docker-compose.yml
```

Collez exactement ce contenu :

```yaml
services:
  mcp:
    image: ghcr.io/nathanguenoun-cell/mcp-boond-oauth:2.1.0
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
      NODE_ENV: production
      LOG_LEVEL: info
      LOG_FORMAT: json
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/.well-known/oauth-protected-resource').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"
```

Sauvegardez : **Ctrl+O** puis **Ctrl+X**.

### 4.3 Créer le fichier `.env`

```bash
nano .env
```

Remplissez avec vos valeurs collectées à l'étape 2 et 3 :

```bash
# URL publique du serveur MCP (HTTPS, avec /mcp à la fin)
MCP_HTTP_PUBLIC_URL=https://mcp.votre-domaine.com/mcp

# Identifiants OAuth BoondManager (étape 2)
BOOND_OAUTH_CLIENT_ID=VOTRE_CLIENT_ID
BOOND_OAUTH_CLIENT_SECRET=VOTRE_CLIENT_SECRET

# URLs OAuth BoondManager
BOOND_OAUTH_AUTH_URL=https://ui.boondmanager.com/api/oauth2/authorize
BOOND_OAUTH_TOKEN_URL=https://ui.boondmanager.com/api/oauth2/token

# Durée des sessions (jours)
BOOND_SESSION_TTL_DAYS=90
```

Sauvegardez : **Ctrl+O** puis **Ctrl+X**.

> **Sécurité** : le fichier `.env` contient des secrets. Ne le partagez jamais et ne le commitez pas dans git.

### 4.4 Démarrer le conteneur

```bash
docker compose pull
docker compose up -d
```

### 4.5 Vérifier le démarrage

```bash
docker compose ps
```

Le statut doit afficher `running (healthy)` après 30 secondes. Si ce n'est pas le cas :

```bash
docker compose logs mcp
```

---

## Étape 5 — Configurer nginx (reverse proxy HTTPS)

### 5.1 Installer nginx et certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 5.2 Créer la configuration nginx

```bash
sudo nano /etc/nginx/sites-available/boondmanager-mcp
```

Collez ce contenu en remplaçant `mcp.votre-domaine.com` par votre sous-domaine :

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

        # Critique pour le streaming SSE (MCP utilise Server-Sent Events)
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

Sauvegardez : **Ctrl+O** puis **Ctrl+X**.

### 5.3 Activer le site

```bash
sudo ln -s /etc/nginx/sites-available/boondmanager-mcp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

La commande `nginx -t` doit afficher `syntax is ok` et `test is successful`.

### 5.4 Obtenir le certificat HTTPS

> Le DNS doit être propagé (étape 3.2) avant cette commande.

```bash
sudo certbot --nginx \
  -d mcp.votre-domaine.com \
  --non-interactive \
  --agree-tos \
  -m admin@votre-domaine.com
```

Certbot configure automatiquement TLS et programme le renouvellement automatique.

---

## Étape 6 — Vérification du déploiement

### Test 1 — Endpoint de découverte OAuth

```bash
curl https://mcp.votre-domaine.com/.well-known/oauth-protected-resource
```

Réponse attendue :
```json
{
  "resource": "https://mcp.votre-domaine.com/mcp",
  "authorization_servers": ["https://ui.boondmanager.com"]
}
```

### Test 2 — Endpoint MCP

```bash
curl -X POST https://mcp.votre-domaine.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

Réponse attendue : un JSON avec `"result"` contenant les capabilities du serveur.

Si les deux tests passent, le serveur est opérationnel.

---

## Étape 7 — Configurer Dust

### Ajouter le serveur MCP dans Dust

1. Connectez-vous à votre espace Dust : **app.dust.tt**
2. Allez dans **Settings → MCP Servers** (ou **Connexions → Serveurs MCP** selon la langue)
3. Cliquez sur **Add MCP Server**
4. Renseignez les champs :
   - **Name** : `BoondManager`
   - **URL** : `https://mcp.votre-domaine.com/mcp`
   - **Transport** : `HTTP` (Streamable HTTP)
5. Sauvegardez

### Connexion OAuth

Au premier usage dans un assistant Dust, une fenêtre de navigateur s'ouvre automatiquement pour vous connecter à BoondManager — c'est le flow OAuth normal. Connectez-vous avec votre compte BoondManager habituel et autorisez l'application.

La connexion est ensuite mémorisée pour 90 jours (configurable via `BOOND_SESSION_TTL_DAYS` dans le `.env`).

---

## Maintenance

### Consulter les logs

```bash
cd /opt/boondmanager-mcp
docker compose logs -f mcp          # Temps réel
docker compose logs --tail=100 mcp  # 100 dernières lignes
```

### Redémarrer le service

```bash
cd /opt/boondmanager-mcp
docker compose restart mcp
```

### Mettre à jour vers une nouvelle version

```bash
cd /opt/boondmanager-mcp
# Modifier l'image dans docker-compose.yml pour bumper le tag
nano docker-compose.yml
# Remplacer :2.1.0 par le nouveau tag

docker compose pull
docker compose up -d
```

### Vérifier le renouvellement SSL

```bash
sudo certbot renew --dry-run
```

---

