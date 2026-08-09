CREATE OR REPLACE FUNCTION check_owner_step_type_restriction()
RETURNS TRIGGER AS $$
DECLARE
    v_hasura_user text;
    v_user_id uuid;
    v_org_id uuid;
    v_role text;
BEGIN
    -- Get current user ID from Hasura session if present
    v_hasura_user := current_setting('hasura.user', true);
    
    IF v_hasura_user IS NOT NULL AND v_hasura_user <> '' THEN
        v_user_id := (v_hasura_user::json->>'x-hasura-user-id')::uuid;
        
        -- Get the org_id of the workflow
        SELECT org_id INTO v_org_id FROM workflows WHERE id = NEW.workflow_id;
        
        -- Find the user's role in the organization
        SELECT role INTO v_role FROM org_members 
        WHERE org_id = v_org_id AND user_id = v_user_id;
        
        -- Enforce that editor/viewer cannot create db_write or notify steps
        IF NEW.type IN ('db_write', 'notify') AND (v_role IS NULL OR v_role <> 'owner') THEN
            RAISE EXCEPTION 'Only owners can manage db_write or notify step types';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_owner_step_type_restriction ON workflow_steps;
CREATE TRIGGER trg_check_owner_step_type_restriction
BEFORE INSERT OR UPDATE ON workflow_steps
FOR EACH ROW
EXECUTE FUNCTION check_owner_step_type_restriction();

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS chk_quota;
ALTER TABLE organizations ADD CONSTRAINT chk_quota CHECK (quota_used <= quota_allowed);
