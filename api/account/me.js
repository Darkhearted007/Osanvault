import { db } from 'hatchable';
import { readState, writeState, id, audit } from '../../lib/phase388-control-plane.js';
export const access = 'user';
export const methods = ['GET'];

export default async function (req, res) {
  const role = await db.query('SELECT role FROM app_user_roles WHERE user_id = $1', [req.user.id]);
  const appRole = role.rows[0]?.role || 'viewer';

  // Reconcile only a real, authenticated founder identity. Never trust a
  // client-supplied identity and never create an account or organization here.
  const email = String(req.user?.email || '').trim().toLowerCase();
  let founderReconciliation = { status: 'NOT_APPLICABLE' };
  if (email === 'olugbenga1000@gmail.com') {
    const state = await readState();
    const organization = (state.organizations || []).find(
      o => o.status === 'ACTIVE' && (o.environment === 'production' || /osanvault/i.test(o.name || ''))
    );

    if (organization) {
      const memberId = String(req.user.id);
      let member = (state.members || []).find(
        m => m.organization_id === organization.id && String(m.member_id) === memberId
      );
      let changed = false;

      if (!member) {
        member = {
          id: id(),
          organization_id: organization.id,
          member_id: req.user.id,
          role: 'ADMIN',
          status: 'ACTIVE',
          position_code: 'EXECUTIVE',
          position_title: 'Founder / Executive Director',
          dashboard_key: 'executive',
          created_at: new Date().toISOString()
        };
        state.members.push(member);
        changed = true;
      } else {
        const updates = {
          role: 'ADMIN',
          status: 'ACTIVE',
          position_code: 'EXECUTIVE',
          position_title: 'Founder / Executive Director',
          dashboard_key: 'executive'
        };
        for (const [key, value] of Object.entries(updates)) {
          if (member[key] !== value) { member[key] = value; changed = true; }
        }
      }

      if (changed) {
        audit(state, organization.id, req.user.id, req.user.id, 'FOUNDER_IDENTITY_RECONCILED', {
          email,
          position_code: 'EXECUTIVE',
          dashboard_key: 'executive'
        });
        await writeState(state);
      }

      founderReconciliation = {
        status: 'VERIFIED',
        organization_id: organization.id,
        organization_name: organization.name,
        member_id: req.user.id,
        role: member.role,
        position_code: member.position_code,
        position_title: member.position_title,
        dashboard_key: member.dashboard_key,
        changed
      };
    } else {
      founderReconciliation = { status: 'BLOCKED', reason: 'NO_EXISTING_PRODUCTION_ORGANIZATION' };
    }
  }

  res.json({ user: req.user, role: appRole, founderReconciliation });
}