import os
import sys
import unittest
from types import SimpleNamespace

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import main


class QueryStub:
    def __init__(self, row):
        self.row = row
        self.filters = []

    def filter(self, *conditions):
        self.filters.extend(conditions)
        return self

    def first(self):
        return self.row

    def get(self, _id):
        if _id == "user_1":
            return SimpleNamespace(id="user_1")
        return None


class SessionStub:
    def __init__(self, row):
        self.row = row

    def query(self, model):
        return QueryStub(self.row)


class CapexOwnershipTests(unittest.TestCase):
    def setUp(self):
        self.campus = SimpleNamespace(id="scope_main_campus", tenant_id="t_main", level="campus")
        self.ctx = {"tenant_id": "t_main", "scope_level": "campus", "scope_ref": "Main Campus", "office_n": 3}

    def test_user_label_resolves_to_canonical_org_scope(self):
        resolved = main._resolve_campus_scope(SessionStub(self.campus), self.ctx)
        self.assertIs(resolved, self.campus)
        self.assertEqual(resolved.id, "scope_main_campus")

    def test_wrong_campus_is_rejected(self):
        workflow = SimpleNamespace(process_key="infrastructure_capex", scope_level="campus", campus_scope_id="scope_north_campus")
        self.assertFalse(main._capex_scope_matches(SessionStub(self.campus), workflow, self.ctx))

    def test_unmapped_capex_is_rejected(self):
        workflow = SimpleNamespace(process_key="infrastructure_capex", scope_level="campus", campus_scope_id=None)
        self.assertFalse(main._capex_scope_matches(SessionStub(self.campus), workflow, self.ctx))

    def test_non_campus_user_cannot_resolve_capex_scope(self):
        ctx = {"tenant_id": "t_main", "scope_level": "university", "scope_ref": "scope_global", "office_n": 29}
        self.assertIsNone(main._resolve_campus_scope(SessionStub(self.campus), ctx))

    def test_v2_capex_requires_non_null_campus_scope(self):
        workflow = SimpleNamespace(
            process_key="infrastructure_capex_v2",
            state="submitted",
            current_stage=3,
            amount=250000,
            initiator_id="user_2",
            campus_scope_id=None,
            scope_level="campus",
            initiator_name="Requester",
            title="CAPEX Test",
        )
        actions, _ = main._campus_head_workflow_actions(
            SessionStub(self.campus),
            workflow,
            main._workflow_process("infrastructure_capex_v2"),
            {**self.ctx, "sub": "user_1"},
        )
        self.assertEqual(actions, [])

    def test_v2_capex_requires_matching_campus_scope(self):
        workflow = SimpleNamespace(
            process_key="infrastructure_capex_v2",
            state="submitted",
            current_stage=3,
            amount=250000,
            initiator_id="user_2",
            campus_scope_id="scope_north_campus",
            scope_level="campus",
            initiator_name="Requester",
            title="CAPEX Test",
        )
        actions, _ = main._campus_head_workflow_actions(
            SessionStub(self.campus),
            workflow,
            main._workflow_process("infrastructure_capex_v2"),
            {**self.ctx, "sub": "user_1"},
        )
        self.assertEqual(actions, [])


if __name__ == "__main__":
    unittest.main()
