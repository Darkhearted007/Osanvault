CREATE TABLE IF NOT EXISTS osv_ip_registry (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL,
 type text NOT NULL,
 status text NOT NULL,
 owner text NOT NULL,
 scope text NOT NULL,
 year int,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(title,type)
);
INSERT INTO osv_ip_registry(title,type,status,owner,scope,year) VALUES
('ÒsánVault Africa — Intellectual Property Notice','Copyright','Protected','OSANVAULT AFRICA LTD','Software, source code, UI/UX, documentation, databases, schemas, workflows, architecture, branding and original content created for ÒsánVault Africa.',2026),
('ÒsánVault / OsanVault Africa','Trademark','Claimed / registration subject to formal filing','OSANVAULT AFRICA LTD','Name, word marks, logos, distinctive brand identifiers and associated goodwill.',2026),
('Industrial / Real-World Asset Intelligence Architecture','Proprietary Know-How','Confidential','OSANVAULT AFRICA LTD','Original intelligence workflows, control-plane architecture, evidence/provenance workflows, governance logic and implementation methods, excluding third-party materials.',2026)
ON CONFLICT(title,type) DO NOTHING;