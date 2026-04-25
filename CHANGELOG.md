# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.5.1] - 2026-04-25

Critical fix to the structured search filters introduced in 1.5.0 (#29). The
new filters were silently ignored by the BoondManager API because the input
field names did not match the official RAML spec
(https://doc.boondmanager.com/api-externe/). All six search tools — resources,
candidates, contacts, companies, opportunities, projects — were verified
against a live tenant after this change and all advertised filters now apply.

### Fixed
- `boond_resources_search`, `boond_candidates_search`, `boond_contacts_search`,
  `boond_companies_search`, `boond_opportunities_search`,
  `boond_projects_search`: filter inputs now match the BoondManager API query
  parameter names exactly. Previously the schema accepted names like
  `mainManagers`, `states`, `agencies`, `poles`, `businessUnits`, `skills`,
  `typeOf`, `company`, `contact` that the API never honored — every call
  fell through to an unfiltered baseline result.

### Changed (breaking inputs for the 6 search tools above)
- Manager / agency / pole / BU filters renamed and unified across all six
  endpoints, sourced from the shared `searchable` RAML trait:
  - `mainManagers` → `perimeterManagers` (integer IDs)
  - `agencies` → `perimeterAgencies` (integer IDs)
  - `poles` → `perimeterPoles` (integer IDs)
  - `businessUnits` → `perimeterBusinessUnits` (integer IDs)
  - new `perimeterDynamic` (`["data"|"managers"|"agencies"|"poles"|"businessUnits"]`)
    is the right filter for "my data / my N-1 / my agencies" without having
    to look up your own user id first
  - new `narrowPerimeter` (boolean) switches `perimeter*` joins from OR to AND
- State / type filters renamed per endpoint to match the API (integer IDs
  from `boond_application_dictionary`):
  - resources: `states` → `resourceStates`, `typeOf` → `resourceTypes`,
    plus `excludeResourceStates` / `excludeResourceTypes`
  - candidates: `states` → `candidateStates`, `typeOf` → `candidateTypes`
  - opportunities: `states` → `opportunityStates`,
    `typeOf` → `opportunityTypes`
  - projects: `states` → `projectStates`, `typeOf` → `projectTypes`
  - contacts: `typeOf` → `typesOf` (with the trailing `s`); `states` and
    `companyStates` kept
  - companies: `states` kept; the `typeOf` filter was removed because the API
    does not support it on `/companies` search
- Relational filters: `company` / `contact` (singular) replaced by
  `companies` (plural array, projects only) or by the documented `keywords`
  prefix syntax (`CSOC<id>`, `CCON<id>`, `CAND<id>`, `COMP<id>`, `AO<id>`,
  `PROD<id>`, `CTR<id>`, `MIS<id>`, `PRJ<id>`)
- `period` vocabulary aligned with the API per endpoint (e.g. `running`,
  `created`, `started`, `closed`, `available`, `working`, `closingDate`,
  `updatedPositioning`, `withActions`, `withoutActions`, `noAction`, …) —
  the previous `creation`/`update`/`startDate`/`endDate` enum was wrong
- Pagination: `MAX_PAGE_SIZE` raised from 100 to 500 (the official API max)
  and `DEFAULT_PAGE_SIZE` from 20 to 30 (the official API default)

### Added
- `keywordsType` on resources / candidates / contacts / companies — lets the
  caller target a specific field for the text search (`lastName`, `firstName`,
  `fullName` with `"NOM#PRENOM"`, `emails`, `phones`, `title`, `titleSkills`,
  `reference`, `resume`, `td`, `socialNetworks`, …). The previous behavior
  defaulted to a CV-only full-text scan with no way to override.
- Geographic proximity search on resources and candidates: `coordinates`
  (`"lat,lon"`) or `location` (free-text address) combined with `geoDistance`
  (5–200 km)
- `tools` AND-mode: prepend `"#AND#"` to require all listed tools (default
  remains OR)
- New filters wired through to the API:
  - resources: `expertiseAreas`, `experiences`, `trainings`, `mobilityAreas`,
    `languages` (`langueId|niveauId`), `flags`, `providerCompanies`,
    `excludeManager`, `shields`
  - candidates: `expertiseAreas`, `experiences`, `trainings`, `mobilityAreas`,
    `languages`, `flags`, `evaluations`, `sources`, `availabilityTypes`,
    `contractTypes`, `providerCompanies`, `shields`,
    `perimeterManagersType` (`"main"|"hr"`)
  - contacts: `expertiseAreas`, `tools`, `influencers`, `flags`,
    `completeness` (e.g. `["email:empty","phone:empty"]`), `shields`
  - companies: `expertiseAreas`, `origins`, `influencers`, `flags`, `shields`
  - opportunities: `expertiseAreas`, `tools`, `places`, `durations`,
    `origins`, `flags`, `positioningStates`, `shields`,
    `perimeterManagersType`
  - projects: `expertiseAreas`, `flags`
- Tool descriptions for the six search tools were rewritten with concrete
  call examples (my data / my team, by state, by period, by linked entity)
  so the model picks the right filter on the first try

### Notes
- Strict-mode validation is preserved on every search schema, so any caller
  still passing the old field names (e.g. `mainManagers`, `agencies`) will
  receive a clear schema rejection rather than a silently unfiltered result.
- All 274 existing unit tests pass; live verification against a real tenant
  confirmed each filter actually narrows results.

## [1.5.0] - 2026-04-24

### Added
- Structured Zod search schemas for resources, candidates, contacts,
  companies, opportunities, projects with typed filter fields (#29)
- Array query parameters serialized as `key[]=v1&key[]=v2` bracket notation
- `registerSearchTool` now accepts schema / title / description overrides

### Note
- The structured filters introduced in 1.5.0 did not actually apply on the
  BoondManager API (wrong parameter names). Use 1.5.1 — it is the version
  that makes 1.5.0's filter design work.
