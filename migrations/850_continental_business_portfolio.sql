CREATE TABLE IF NOT EXISTS continental_business_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL UNIQUE,
  name text NOT NULL,
  customer_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  value_proposition text NOT NULL,
  revenue_model text NOT NULL,
  maturity text NOT NULL DEFAULT 'planned',
  regulatory_boundary text NOT NULL,
  dependency_modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO continental_business_modules
(module_key,name,customer_segments,value_proposition,revenue_model,maturity,regulatory_boundary,dependency_modules,display_order)
SELECT 'asset-intelligence','Asset Intelligence & Evidence','["asset owners","developers","institutions","public-sector teams"]'::jsonb,
'Structured asset records, evidence, provenance, GIS context and readiness workflows for real-world African assets.',
'Enterprise licence; asset/project intelligence services; API/data access.',
'core',
'Information and workflow infrastructure. Does not certify title, provide legal advice, or guarantee project outcomes.',
'["asset registry","evidence","GIS","verification"]'::jsonb,10
WHERE NOT EXISTS (SELECT 1 FROM continental_business_modules WHERE module_key='asset-intelligence');

INSERT INTO continental_business_modules
(module_key,name,customer_segments,value_proposition,revenue_model,maturity,regulatory_boundary,dependency_modules,display_order)
SELECT 'project-bankability','Project Preparation & Bankability','["developers","governments","DFIs","infrastructure sponsors"]'::jsonb,
'Convert fragmented project information into evidence-backed readiness, diligence and institutional review packages before financing discussions.',
'Project preparation fees; enterprise programme licences; institutional retainers.',
'build',
'No securities offering, investment advice, underwriting or financing guarantee.',
'["asset-intelligence","evidence","risk","capital-readiness"]'::jsonb,20
WHERE NOT EXISTS (SELECT 1 FROM continental_business_modules WHERE module_key='project-bankability');

INSERT INTO continental_business_modules
(module_key,name,customer_segments,value_proposition,revenue_model,maturity,regulatory_boundary,dependency_modules,display_order)
SELECT 'institutional-diligence','Institutional Due Diligence Rooms','["banks","DFIs","funds","corporates","insurers","professional advisers"]'::jsonb,
'Controlled evidence rooms, review workflows, audit trails and organization-scoped diligence for transactions and strategic decisions.',
'Workspace subscription; transaction/workflow fees; enterprise support.',
'core',
'Workflow and information service only; legal, tax, valuation and investment conclusions remain with qualified professionals.',
'["evidence","verification","organizations","audit"]'::jsonb,30
WHERE NOT EXISTS (SELECT 1 FROM continental_business_modules WHERE module_key='institutional-diligence');

INSERT INTO continental_business_modules
(module_key,name,customer_segments,value_proposition,revenue_model,maturity,regulatory_boundary,dependency_modules,display_order)
SELECT 'corridor-intelligence','Trade Corridor & Infrastructure Intelligence','["governments","logistics operators","developers","infrastructure investors","corporates"]'::jsonb,
'Combine territory, infrastructure, ports, roads, rail, energy and project evidence into corridor-level intelligence for African trade and infrastructure planning.',
'Enterprise data subscription; corridor studies; API/data licensing.',
'planned',
'Decision-support intelligence; not a transport operator, broker, lender or investment adviser.',
'["GIS","asset-intelligence","country-intelligence","risk"]'::jsonb,40
WHERE NOT EXISTS (SELECT 1 FROM continental_business_modules WHERE module_key='corridor-intelligence');

INSERT INTO continental_business_modules
(module_key,name,customer_segments,value_proposition,revenue_model,maturity,regulatory_boundary,dependency_modules,display_order)
SELECT 'resources-provenance','Minerals, Commodities & Resource Provenance','["miners","traders","manufacturers","DFIs","governments","supply-chain institutions"]'::jsonb,
'Track evidence, jurisdiction, rights, permits and provenance around mineral and strategic-resource opportunities without pretending uncertain claims are verified facts.',
'Enterprise subscription; provenance programmes; data/API licensing.',
'planned',
'No commodity exchange, custody, brokerage, securities issuance or guaranteed provenance where evidence is incomplete.',
'["asset-intelligence","jurisdiction","regulatory-evidence","supply-chain"]'::jsonb,50
WHERE NOT EXISTS (SELECT 1 FROM continental_business_modules WHERE module_key='resources-provenance');

INSERT INTO continental_business_modules
(module_key,name,customer_segments,value_proposition,revenue_model,maturity,regulatory_boundary,dependency_modules,display_order)
SELECT 'climate-resilience','Climate, Carbon & Resilience Intelligence','["project developers","governments","DFIs","insurers","infrastructure owners"]'::jsonb,
'Connect asset and territory evidence with climate exposure, environmental review, resilience and project-readiness workflows.',
'Enterprise intelligence subscription; project assessments; API/data licensing.',
'planned',
'No carbon-credit issuance, environmental certification or climate-risk guarantee without appropriate external authority and methodology.',
'["GIS","asset-intelligence","environmental-review","risk"]'::jsonb,60
WHERE NOT EXISTS (SELECT 1 FROM continental_business_modules WHERE module_key='climate-resilience');

INSERT INTO continental_business_modules
(module_key,name,customer_segments,value_proposition,revenue_model,maturity,regulatory_boundary,dependency_modules,display_order)
SELECT 'public-sector-intelligence','Country & Public-Sector Intelligence','["ministries","agencies","municipalities","development programmes"]'::jsonb,
'Country/jurisdiction profiles, regulatory evidence, asset and territory intelligence, project pipelines and institutional governance workflows.',
'Government/agency licences; implementation programmes; data services.',
'planned',
'Information and workflow infrastructure; does not replace statutory authority, official registers or legal counsel.',
'["jurisdiction","regulatory-evidence","GIS","governance"]'::jsonb,70
WHERE NOT EXISTS (SELECT 1 FROM continental_business_modules WHERE module_key='public-sector-intelligence');

CREATE INDEX IF NOT EXISTS idx_continental_business_modules_active_order
ON continental_business_modules(active,display_order);