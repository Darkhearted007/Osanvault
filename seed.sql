INSERT INTO governance_documents(document_type,title,version,status,effective_date,approved_by,content) SELECT 'company_constitution','ÒsánVault Africa Ltd — Internal Corporate Governance Constitution','1.0','draft',NULL,NULL,$$PREAMBLE
This internal governance constitution establishes the operating principles, decision rights and accountability framework of ÒsánVault Africa Ltd. It is an internal governance document and does not replace the company's Memorandum and Articles of Association, statutory filings, shareholder agreements or applicable Nigerian law.

ARTICLE 1 — PURPOSE
The company exists to build sustainable businesses and technology-enabled products in accordance with its lawful corporate objects, mission and fiduciary responsibilities.

ARTICLE 2 — GOVERNANCE HIERARCHY
Applicable Nigerian law and valid corporate filings prevail. The Memorandum and Articles of Association and properly adopted shareholder/board resolutions prevail over this internal constitution where there is a conflict. This constitution governs internal operating practice to the extent permitted by law.

ARTICLE 3 — OWNERSHIP
Ownership and shareholder rights are determined by the company's official register of members and applicable corporate records. No internal policy may create, transfer or extinguish shares without the legally required corporate process.

ARTICLE 4 — BOARD AND DIRECTORS
Directors are responsible for lawful stewardship, strategy, oversight, risk management and protection of company assets. Directors must act in the company's interests and comply with applicable duties. Appointment, resignation and removal follow the applicable corporate process.

ARTICLE 5 — FOUNDER AND MANAGEMENT
The founder may exercise authority attached to their lawful office, shareholding or board position. Day-to-day management may be delegated in writing. Delegation does not remove accountability or override reserved matters.

ARTICLE 6 — RESERVED MATTERS
The following require the level of approval specified in the Delegation of Authority register and, where required, formal shareholder or board action: share issuance or transfer; material borrowing; guarantees; acquisition or disposal of material assets; related-party transactions; appointment/removal of directors or key executives; major investments; material litigation settlements; changes to core business; and dissolution or winding-up.

ARTICLE 7 — FINANCIAL CONTROLS
Company funds must be used only for legitimate business purposes. Bank mandates, payment approvals, procurement and expense authority must follow documented controls. No employee or officer may approve a payment to themselves without independent authorization.

ARTICLE 8 — CONFLICTS OF INTEREST
Directors, officers and employees must disclose actual or potential conflicts. Related-party transactions must be documented and approved independently in accordance with law and company policy.

ARTICLE 9 — PEOPLE AND EMPLOYMENT
Hiring, compensation, promotion, disciplinary action and termination must follow approved company policies, employment contracts and applicable law. No role grants authority beyond the person's documented delegation.

ARTICLE 10 — INTELLECTUAL PROPERTY AND CONFIDENTIALITY
Company-created intellectual property, confidential information, customer information and strategic materials must be protected and handled according to applicable contracts and policies.

ARTICLE 11 — RECORDS AND AUDIT
The company will maintain accurate corporate, financial, HR, contractual and governance records. Material decisions should be documented with date, decision-maker, authority and supporting rationale.

ARTICLE 12 — ETHICS AND COMPLIANCE
The company will not knowingly engage in unlawful, fraudulent or corrupt conduct. Employees and officers should report material compliance concerns through designated channels without retaliation, subject to applicable law.

ARTICLE 13 — SUCCESSION AND CONTINUITY
Management should maintain continuity plans for critical roles, systems, credentials, assets and operational responsibilities. Succession arrangements must respect shareholder, board and legal rights.

ARTICLE 14 — DISPUTES AND DEADLOCK
Operational disputes should first be escalated to the appropriate management level, then to the board or shareholders where applicable. Formal dispute-resolution mechanisms should be used where required by contract or law.

ARTICLE 15 — AMENDMENT
This internal constitution may be amended only through the governance approval process recorded in the company's governance register. Any amendment affecting statutory rights or corporate constitution must also undergo the legally required corporate process.

ARTICLE 16 — ADOPTION
This document is a DRAFT until formally reviewed and adopted by the appropriate company authority. Adoption should be recorded with date, resolution/reference and approving persons.

END OF INTERNAL CONSTITUTION DRAFT
$$ WHERE NOT EXISTS (SELECT 1 FROM governance_documents WHERE document_type='company_constitution');
INSERT INTO authority_rules(category,action,approval_level,threshold_amount,currency,notes) SELECT 'Finance','Routine operating expense','Budget owner + finance review',100000,'NGN','Subject to approved budget and supporting documentation.' WHERE NOT EXISTS (SELECT 1 FROM authority_rules WHERE category='Finance' AND action='Routine operating expense');
INSERT INTO authority_rules(category,action,approval_level,threshold_amount,currency,notes) SELECT 'Finance','Material unbudgeted expense','Founder/Managing Director + finance review',500000,'NGN','Escalate if outside approved budget.' WHERE NOT EXISTS (SELECT 1 FROM authority_rules WHERE category='Finance' AND action='Material unbudgeted expense');
INSERT INTO authority_rules(category,action,approval_level,threshold_amount,currency,notes) SELECT 'Procurement','Major vendor contract','Founder/Managing Director + legal review where appropriate',1000000,'NGN','Threshold is an internal control, not a statutory rule.' WHERE NOT EXISTS (SELECT 1 FROM authority_rules WHERE category='Procurement' AND action='Major vendor contract');
INSERT INTO authority_rules(category,action,approval_level,threshold_amount,currency,notes) SELECT 'People','Hire employee','Hiring manager + authorized executive',NULL,'NGN','Must have approved position and compensation budget.' WHERE NOT EXISTS (SELECT 1 FROM authority_rules WHERE category='People' AND action='Hire employee');
INSERT INTO authority_rules(category,action,approval_level,threshold_amount,currency,notes) SELECT 'Corporate','Issue/transfer shares','Shareholder/board process as required by law and corporate documents',NULL,'NGN','Never delegated as an ordinary operating expense.' WHERE NOT EXISTS (SELECT 1 FROM authority_rules WHERE category='Corporate' AND action='Issue/transfer shares');