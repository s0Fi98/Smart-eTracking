-- MEMBER is a basic membership; access comes only from explicit site assignments.
ALTER TABLE `organization_members`
  MODIFY `role` ENUM('MEMBER', 'OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER') NOT NULL DEFAULT 'MEMBER';

-- The previous admin UI used VIEWER as the default for operational staff.
-- Narrow those existing memberships to their explicit sites rather than granting
-- organization-wide visibility. Deliberate organization-wide viewers can be
-- promoted back to VIEWER by their organization owner or a super administrator.
UPDATE `organization_members` AS m
SET m.`role` = 'MEMBER'
WHERE m.`role` = 'VIEWER'
  AND EXISTS (SELECT 1 FROM `site_assignments` AS a WHERE a.`member_id` = m.`id`);
