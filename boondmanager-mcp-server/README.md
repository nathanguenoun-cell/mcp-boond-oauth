# BoondManager MCP Server

[![CI](https://github.com/fauguste/boondmanager-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/fauguste/boondmanager-mcp-server/actions/workflows/ci.yml)
[![CodeQL](https://github.com/fauguste/boondmanager-mcp-server/actions/workflows/codeql.yml/badge.svg)](https://github.com/fauguste/boondmanager-mcp-server/actions/workflows/codeql.yml)
[![npm version](https://img.shields.io/npm/v/boondmanager-mcp-server.svg)](https://www.npmjs.com/package/boondmanager-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/boondmanager-mcp-server.svg)](https://www.npmjs.com/package/boondmanager-mcp-server)
[![Node.js](https://img.shields.io/node/v/boondmanager-mcp-server.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io/)
[![Docker Hub](https://img.shields.io/docker/v/fauguste/boondmanager-mcp-server?label=Docker%20Hub&logo=docker&color=2496ED)](https://hub.docker.com/r/fauguste/boondmanager-mcp-server)
[![GHCR](https://img.shields.io/badge/GHCR-fauguste%2Fboondmanager--mcp--server-181717?logo=github)](https://github.com/fauguste/boondmanager-mcp-server/pkgs/container/boondmanager-mcp-server)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Serveur MCP (Model Context Protocol) pour l'API BoondManager, permettant a Claude (Desktop, Cowork, Code) de rechercher, consulter, creer et modifier des enregistrements dans votre instance BoondManager.

**158 outils** couvrant **36 domaines** de l'API BoondManager. Voir [TOOLS.md](./TOOLS.md) pour le catalogue auto-généré (outils + prompts + ressources).

## Domaines couverts

### CRM & Commercial

| Domaine | Outils | Operations |
|---------|--------|------------|
| **Candidats** | 10 | CRUD + information, technical-data, administrative, actions, positionings |
| **Ressources** | 15 | CRUD + information, technical-data, administrative, advantages, actions, positionings, projects, times-reports, expenses-reports, absences-reports |
| **Contacts** | 11 | CRUD + information, actions, opportunities, projects, orders, invoices |
| **Societes** | 14 | CRUD + information, contacts, actions, opportunities, projects, orders, invoices, purchases, provider-invoices |
| **Opportunites** | 10 | CRUD + information, actions, positionings, projects, simulation |

### Gestion de projets

| Domaine | Outils | Operations |
|---------|--------|------------|
| **Projets** | 12 | CRUD + information, actions, simulation, deliveries-groupments, orders, purchases, productivity |
| **Positionnements** | 4 | search, get, create, delete |
| **Livraisons / CRA** | 2 | search, get |
| **Achats / Sous-traitance** | 4 | search, get, create, delete |

### Facturation & Finance

| Domaine | Outils | Operations |
|---------|--------|------------|
| **Factures client** | 5 | CRUD complet |
| **Factures fournisseur** | 2 | search, get |
| **Bons de commande** | 5 | CRUD complet |
| **Paiements** | 2 | search, get |
| **Notes de frais** | 5 | CRUD complet |
| **Produits** | 5 | CRUD complet |

### RH & Temps

| Domaine | Outils | Operations |
|---------|--------|------------|
| **Absences** | 5 | CRUD complet |
| **Planning absences** | 1 | search (vue globale) |
| **Feuilles de temps** | 3 | search, get, resource timesheets |
| **Contrats** | 2 | get, create |
| **Avantages** | 2 | search, get |

### Suivi d'activite

| Domaine | Outils | Operations |
|---------|--------|------------|
| **Actions** | 4 | search, get, create, delete |
| **Validations** | 2 | search, get |
| **Todolists** | 2 | search, get |

### Reporting

| Domaine | Outils | Operations |
|---------|--------|------------|
| **Reporting societes** | 1 | search |
| **Reporting projets** | 1 | search |
| **Reporting ressources** | 1 | search |
| **Reporting synthese** | 1 | search |
| **Reporting plans de production** | 1 | search |

### Administration & Configuration

| Domaine | Outils | Operations |
|---------|--------|------------|
| **Comptes utilisateurs** | 2 | search, get |
| **Agences** | 2 | search, get |
| **Business Units** | 2 | search, get |
| **Poles** | 2 | search, get |
| **Roles** | 2 | search, get |
| **Calendriers** | 2 | search, get |
| **Drapeaux / Etiquettes** | 2 | search, get |
| **Webhooks** | 2 | search, get |
| **Logs d'audit** | 2 | search, get |
| **Notifications** | 2 | search, get |
| **Fils de discussion** | 2 | search, get |
| **Application** | 2 | dictionnaire, utilisateur courant |

### Detail des onglets par entite

Les entites principales disposent d'outils dedies par onglet pour un acces cible :

| Entite | Onglets disponibles |
|--------|-------------------|
| Candidats | information, technical-data, administrative, actions, positionings |
| Ressources | information, technical-data, administrative, advantages, actions, positionings, projects, times-reports, expenses-reports, absences-reports |
| Contacts | information, actions, opportunities, projects, orders, invoices |
| Societes | information, contacts, actions, opportunities, projects, orders, invoices, purchases, provider-invoices |
| Opportunites | information, actions, positionings, projects, simulation |
| Projets | information, actions, simulation, deliveries-groupments, orders, purchases, productivity |

## Ressources MCP (dictionnaires)

Le serveur expose les dictionnaires de reference Boond comme **ressources MCP** (clients qui en supportent l'affichage : Claude Desktop, MCP Inspector, etc.). Permet au modele de traduire un `state` ou `typeOf` entier en libelle sans appel d'outil supplementaire.

| URI | Contenu |
|-----|---------|
| `boond://application/current-user` | Profil de l'utilisateur courant (id, agence, permissions) |
| `boond://dictionary/states/{entity}` | Etats par entite : `resources`, `candidates`, `contacts`, `companies`, `opportunities`, `projects`, `invoices`, `orders`, `positionings`, `absences` |
| `boond://dictionary/typeOf/{entity}` | Types par entite : `resources`, `candidates`, `contacts`, `projects`, `actions`, `absences` |
| `boond://dictionary/countries` | Liste des pays |
| `boond://dictionary/currencies` | Liste des devises |
| `boond://dictionary/languages` | Liste des langues |

Pour les dictionnaires hors de cette liste curee, l'outil `boond_application_dictionary` reste disponible.

## Prompts pre-orchestres

En plus des outils, le serveur expose des **prompts MCP** (templates pre-cables) qui orchestrent les bons appels d'outils dans le bon ordre pour les workflows recurrents. Visibles dans les clients qui supportent les prompts (Claude Desktop, **Cowork**, Claude Code, MCP Inspector...) sous forme de slash-commands ou de menu.

### Workflows transverses

| Prompt | Usage |
|--------|-------|
| `synthese_equipe` | Etat d'une equipe : qui fait quoi, qui est absent, qui est dispo (par defaut : mon equipe). |
| `pipeline_commercial` | Opportunites avec closing dans une periode : repartition par etat, CA pondere, top 10. |
| `factures_a_relancer` | Factures impayees dont l'echeance est depassee, regroupees par societe. |
| `candidats_pour_opportunite` | A partir d'une opportunite, propose les candidats actifs qui matchent (outils, expertise, mobilite, dispo). |
| `fiche_consultant` | Vue 360 d'une ressource : info + technique + positionnements + absences + CRA recents. |
| `recap_hebdo` | Recap hebdomadaire : pipeline qui a bouge, equipe absente, projets actifs, actions a mener. |

### Ressources, competences & CV

| Prompt | Usage |
|--------|-------|
| `staffing_disponible` | Consultants internes disponibles sur une fenetre donnee (filtre optionnel par competences libres et perimetre), tries par dispo croissante avec top 3 prioritaires. |
| `fin_de_mission` | Anticipation des fins de mission sous N jours (defaut 60). Marque en **urgent** les fins <= 15j sans relais identifie. |
| `cartographie_competences` | Cartographie des competences d'un perimetre (equipe / agence) : top N, competences rares (bus-factor), saturees, manquantes vs opportunites ouvertes. |
| `cvs_a_mettre_a_jour` | Audit fraicheur des CV / dossiers techniques (seuil d'obsolescence configurable). Priorise les ressources bientot sur le marche. |
| `recherche_profil_competences` | Recherche multi-source (ressources internes + candidats) par mix de competences libres, sans opportunite requise. Classe par adequation /10. |

