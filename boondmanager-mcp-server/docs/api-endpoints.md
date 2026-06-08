# BoondManager MCP — Référence des endpoints API

> Généré depuis le code source. Base URL : `https://ui.boondmanager.com/api`

Les colonnes **⚠️ À vérifier** signalent les endpoints PUT dont le chemin exact doit être confirmé dans la [doc BoondManager](https://doc.boondmanager.com/api-externe/).

---

## Entités principales (CRUD complet)

### Candidats (`/candidates`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_candidates_search` | GET | `/candidates` | ✅ |
| `boond_candidates_get` | GET | `/candidates/{id}` | ✅ |
| `boond_candidates_create` | POST | `/candidates` | ✅ |
| `boond_candidates_update` | PUT | `/candidates/{id}/information` | ✅ confirmé |
| `boond_candidates_delete` | DELETE | `/candidates/{id}` | ✅ |
| `boond_candidates_information` | GET | `/candidates/{id}/information` | ✅ |
| `boond_candidates_technical_data` | GET | `/candidates/{id}/technical-data` | ✅ |
| `boond_candidates_administrative` | GET | `/candidates/{id}/administrative` | ✅ |
| `boond_candidates_actions` | GET | `/candidates/{id}/actions` | ✅ |
| `boond_candidates_positionings` | GET | `/candidates/{id}/positionings` | ✅ |

---

### Ressources (`/resources`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_resources_search` | GET | `/resources` | ✅ |
| `boond_resources_get` | GET | `/resources/{id}` | ✅ |
| `boond_resources_create` | POST | `/resources` | ✅ |
| `boond_resources_update` | PUT | `/resources/{id}` | ⚠️ À vérifier — `/information` ? |
| `boond_resources_delete` | DELETE | `/resources/{id}` | ✅ |
| `boond_resources_technical_data` | GET | `/resources/{id}/technical-data` | ✅ |
| `boond_resources_update_skills` | PUT | `/resources/{id}/technical-data` | ✅ |
| `boond_resources_information` | GET | `/resources/{id}/information` | ✅ |
| `boond_resources_administrative` | GET | `/resources/{id}/administrative` | ✅ |
| `boond_resources_advantages` | GET | `/resources/{id}/advantages` | ✅ |
| `boond_resources_actions` | GET | `/resources/{id}/actions` | ✅ |
| `boond_resources_positionings` | GET | `/resources/{id}/positionings` | ✅ |
| `boond_resources_projects` | GET | `/resources/{id}/projects` | ✅ |
| `boond_resources_times_reports` | GET | `/resources/{id}/times-reports` | ✅ |
| `boond_resources_expenses_reports` | GET | `/resources/{id}/expenses-reports` | ✅ |
| `boond_resources_absences_reports` | GET | `/resources/{id}/absences-reports` | ✅ |

---

### Contacts (`/contacts`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_contacts_search` | GET | `/contacts` | ✅ |
| `boond_contacts_get` | GET | `/contacts/{id}` | ✅ |
| `boond_contacts_create` | POST | `/contacts` | ✅ |
| `boond_contacts_update` | PUT | `/contacts/{id}` | ⚠️ À vérifier — `/information` ? |
| `boond_contacts_delete` | DELETE | `/contacts/{id}` | ✅ |
| `boond_contacts_information` | GET | `/contacts/{id}/information` | ✅ |
| `boond_contacts_actions` | GET | `/contacts/{id}/actions` | ✅ |
| `boond_contacts_opportunities` | GET | `/contacts/{id}/opportunities` | ✅ |
| `boond_contacts_projects` | GET | `/contacts/{id}/projects` | ✅ |
| `boond_contacts_orders` | GET | `/contacts/{id}/orders` | ✅ |
| `boond_contacts_invoices` | GET | `/contacts/{id}/invoices` | ✅ |

---

### Sociétés (`/companies`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_companies_search` | GET | `/companies` | ✅ |
| `boond_companies_get` | GET | `/companies/{id}` | ✅ |
| `boond_companies_create` | POST | `/companies` | ✅ |
| `boond_companies_update` | PUT | `/companies/{id}` | ✅ confirmé |
| `boond_companies_delete` | DELETE | `/companies/{id}` | ✅ |
| `boond_companies_information` | GET | `/companies/{id}/information` | ✅ |
| `boond_companies_contacts` | GET | `/companies/{id}/contacts` | ✅ |
| `boond_companies_actions` | GET | `/companies/{id}/actions` | ✅ |
| `boond_companies_opportunities` | GET | `/companies/{id}/opportunities` | ✅ |
| `boond_companies_projects` | GET | `/companies/{id}/projects` | ✅ |
| `boond_companies_orders` | GET | `/companies/{id}/orders` | ✅ |
| `boond_companies_invoices` | GET | `/companies/{id}/invoices` | ✅ |
| `boond_companies_purchases` | GET | `/companies/{id}/purchases` | ✅ |
| `boond_companies_provider_invoices` | GET | `/companies/{id}/provider-invoices` | ✅ |

---

### Opportunités (`/opportunities`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_opportunities_search` | GET | `/opportunities` | ✅ |
| `boond_opportunities_get` | GET | `/opportunities/{id}` | ✅ |
| `boond_opportunities_create` | POST | `/opportunities` | ✅ |
| `boond_opportunities_update` | PUT | `/opportunities/{id}` | ⚠️ À vérifier — `/information` ? |
| `boond_opportunities_delete` | DELETE | `/opportunities/{id}` | ✅ |
| `boond_opportunities_information` | GET | `/opportunities/{id}/information` | ✅ |
| `boond_opportunities_actions` | GET | `/opportunities/{id}/actions` | ✅ |
| `boond_opportunities_positionings` | GET | `/opportunities/{id}/positionings` | ✅ |
| `boond_opportunities_projects` | GET | `/opportunities/{id}/projects` | ✅ |
| `boond_opportunities_simulation` | GET | `/opportunities/{id}/simulation` | ✅ |

---

### Projets (`/projects`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_projects_search` | GET | `/projects` | ✅ |
| `boond_projects_get` | GET | `/projects/{id}` | ✅ |
| `boond_projects_create` | POST | `/projects` | ✅ |
| `boond_projects_update` | PUT | `/projects/{id}` | ⚠️ À vérifier — `/information` ? |
| `boond_projects_delete` | DELETE | `/projects/{id}` | ✅ |
| `boond_projects_information` | GET | `/projects/{id}/information` | ✅ |
| `boond_projects_actions` | GET | `/projects/{id}/actions` | ✅ |
| `boond_projects_simulation` | GET | `/projects/{id}/simulation` | ✅ |
| `boond_projects_deliveries_groupments` | GET | `/projects/{id}/deliveries-groupments` | ✅ |
| `boond_projects_orders` | GET | `/projects/{id}/orders` | ✅ |
| `boond_projects_purchases` | GET | `/projects/{id}/purchases` | ✅ |
| `boond_projects_productivity` | GET | `/projects/{id}/productivity` | ✅ |

---

### Produits (`/products`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_products_search` | GET | `/products` | ✅ |
| `boond_products_get` | GET | `/products/{id}` | ✅ |
| `boond_products_create` | POST | `/products` | ✅ |
| `boond_products_update` | PUT | `/products/{id}` | ⚠️ À vérifier |
| `boond_products_delete` | DELETE | `/products/{id}` | ✅ |

---

## Facturation & Commercial

### Factures (`/invoices`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_invoices_search` | GET | `/invoices` | ✅ |
| `boond_invoices_get` | GET | `/invoices/{id}` | ✅ |
| `boond_invoices_create` | POST | `/invoices` | ✅ |
| `boond_invoices_update` | PUT | `/invoices/{id}` | ⚠️ À vérifier |
| `boond_invoices_delete` | DELETE | `/invoices/{id}` | ✅ |
| `boond_invoices_information` | GET | `/invoices/{id}/information` | ✅ |
| `boond_invoices_actions` | GET | `/invoices/{id}/actions` | ✅ |
| `boond_invoices_billable_items` | GET | `/invoices/{id}/billable-items` | ✅ |

---

### Commandes (`/orders`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_orders_search` | GET | `/orders` | ✅ |
| `boond_orders_get` | GET | `/orders/{id}` | ✅ |
| `boond_orders_create` | POST | `/orders` | ✅ |
| `boond_orders_update` | PUT | `/orders/{id}` | ⚠️ À vérifier |
| `boond_orders_delete` | DELETE | `/orders/{id}` | ✅ |
| `boond_orders_information` | GET | `/orders/{id}/information` | ✅ |
| `boond_orders_actions` | GET | `/orders/{id}/actions` | ✅ |
| `boond_orders_invoices` | GET | `/orders/{id}/invoices` | ✅ |

---

### Achats (`/purchases`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_purchases_search` | GET | `/purchases` | ✅ |
| `boond_purchases_get` | GET | `/purchases/{id}` | ✅ |
| `boond_purchases_create` | POST | `/purchases` | ✅ |
| `boond_purchases_delete` | DELETE | `/purchases/{id}` | ✅ |

---

### Factures fournisseurs (`/provider-invoices`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_provider_invoices_search` | GET | `/provider-invoices` | ✅ |
| `boond_provider_invoices_get` | GET | `/provider-invoices/{id}` | ✅ |

---

### Paiements (`/payments`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_payments_search` | GET | `/payments` | ✅ |
| `boond_payments_get` | GET | `/payments/{id}` | ✅ |

---

## RH & Temps

### Feuilles de temps (`/times-reports`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_timesheets_search` | GET | `/times-reports` | ✅ |
| `boond_timesheets_get` | GET | `/times-reports/{id}` | ✅ |
| `boond_timesheets_by_resource` | GET | `/resources/{resourceId}/times-reports` | ✅ |

---

### Absences (`/absences`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_absences_search` | GET | `/absences` | ✅ |
| `boond_absences_reports_get` | GET | `/absences-reports/{id}` | ✅ |
| `boond_absences_reports_create` | POST | `/absences-reports` | ✅ |
| `boond_absences_reports_update` | PUT | `/absences-reports/{id}` | ⚠️ À vérifier |
| `boond_absences_reports_delete` | DELETE | `/absences-reports/{id}` | ✅ |

---

### Notes de frais (`/expenses`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_expenses_search` | GET | `/expenses` | ✅ |
| `boond_expenses_reports_get` | GET | `/expenses-reports/{id}` | ✅ |
| `boond_expenses_reports_create` | POST | `/expenses-reports` | ✅ |
| `boond_expenses_reports_update` | PUT | `/expenses-reports/{id}` | ⚠️ À vérifier |
| `boond_expenses_reports_delete` | DELETE | `/expenses-reports/{id}` | ✅ |

---

### Contrats (`/contracts`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_contracts_get` | GET | `/contracts/{id}` | ✅ |
| `boond_contracts_create` | POST | `/contracts` | ✅ |

---

### Positionings (`/positionings`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_positionings_search` | GET | `/positionings` | ✅ |
| `boond_positionings_get` | GET | `/positionings/{id}` | ✅ |
| `boond_positionings_create` | POST | `/positionings` | ✅ |
| `boond_positionings_delete` | DELETE | `/positionings/{id}` | ✅ |

---

### Actions (`/actions`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_actions_search` | GET | `/actions` | ✅ |
| `boond_actions_get` | GET | `/actions/{id}` | ✅ |
| `boond_actions_create` | POST | `/actions` | ✅ |
| `boond_actions_delete` | DELETE | `/actions/{id}` | ✅ |

---

### Livraisons (`/deliveries`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_deliveries_search` | GET | `/deliveries-groupments` | ✅ |
| `boond_deliveries_get` | GET | `/deliveries/{id}` | ✅ |

---

### Avantages (`/advantages`)

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_advantages_search` | GET | `/advantages` | ✅ |
| `boond_advantages_get` | GET | `/advantages/{id}` | ✅ |

---

## Administration & Référentiel

### Application

| Outil MCP | Méthode | Endpoint | Statut |
|---|---|---|---|
| `boond_application_current_user` | GET | `/application/current-user` | ✅ |
| `boond_application_dictionary` | GET | `/application/dictionary/{type}` | ✅ |

---

### Référentiels (lecture seule)

| Outil MCP | Méthode | Endpoint |
|---|---|---|
| `boond_accounts_search` | GET | `/accounts` |
| `boond_accounts_get` | GET | `/accounts/{id}` |
| `boond_agencies_search` | GET | `/agencies` |
| `boond_agencies_get` | GET | `/agencies/{id}` |
| `boond_business_units_search` | GET | `/business-units` |
| `boond_business_units_get` | GET | `/business-units/{id}` |
| `boond_roles_search` | GET | `/roles` |
| `boond_roles_get` | GET | `/roles/{id}` |
| `boond_poles_search` | GET | `/poles` |
| `boond_poles_get` | GET | `/poles/{id}` |
| `boond_calendars_search` | GET | `/calendars` |
| `boond_calendars_get` | GET | `/calendars/{id}` |

---

### Divers

| Outil MCP | Méthode | Endpoint |
|---|---|---|
| `boond_logs_search` | GET | `/logs` |
| `boond_logs_get` | GET | `/logs/{id}` |
| `boond_notifications_search` | GET | `/notifications` |
| `boond_notifications_get` | GET | `/notifications/{id}` |
| `boond_threads_search` | GET | `/threads` |
| `boond_threads_get` | GET | `/threads/{id}` |
| `boond_todolists_search` | GET | `/todolists` |
| `boond_todolists_get` | GET | `/todolists/{id}` |
| `boond_flags_search` | GET | `/flags` |
| `boond_flags_get` | GET | `/flags/{id}` |
| `boond_webhooks_search` | GET | `/webhooks` |
| `boond_webhooks_get` | GET | `/webhooks/{id}` |
| `boond_validations_search` | GET | `/validations` |
| `boond_validations_get` | GET | `/validations/{id}` |
| `boond_planning_absences_search` | GET | `/planning-absences` |

---

### Reporting

| Outil MCP | Méthode | Endpoint |
|---|---|---|
| `boond_reporting_companies` | GET | `/reporting-companies` |
| `boond_reporting_projects` | GET | `/reporting-projects` |
| `boond_reporting_resources` | GET | `/reporting-resources` |
| `boond_reporting_synthesis` | GET | `/reporting-synthesis` |
| `boond_reporting_production_plans` | GET | `/reporting-production-plans` |

---

## Résumé — Endpoints PUT à confirmer

Ces 7 outils utilisent `PUT /{entity}/{id}` mais pourraient nécessiter `PUT /{entity}/{id}/information` selon la doc BoondManager :

| Outil | Endpoint actuel | À vérifier |
|---|---|---|
| `boond_resources_update` | `PUT /resources/{id}` | `/resources/{id}/information` ? |
| `boond_contacts_update` | `PUT /contacts/{id}` | `/contacts/{id}/information` ? |
| `boond_opportunities_update` | `PUT /opportunities/{id}` | `/opportunities/{id}/information` ? |
| `boond_projects_update` | `PUT /projects/{id}` | `/projects/{id}/information` ? |
| `boond_products_update` | `PUT /products/{id}` | — |
| `boond_invoices_update` | `PUT /invoices/{id}` | — |
| `boond_orders_update` | `PUT /orders/{id}` | — |
| `boond_absences_reports_update` | `PUT /absences-reports/{id}` | — |
| `boond_expenses_reports_update` | `PUT /expenses-reports/{id}` | — |
