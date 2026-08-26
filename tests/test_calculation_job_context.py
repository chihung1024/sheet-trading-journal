import unittest
from unittest.mock import patch

from journal_engine.clients.api_client import CloudflareAPIError, CloudflareClient


class FakeResponse:
    status_code = 200

    def __init__(self, status):
        self._status = status

    def json(self):
        return {
            "success": True,
            "job": {
                "id": "job_5gkyrzFJcBUb7sTAjPOBfA",
                "target_user_id": "user@example.com",
                "benchmark": "SPY",
                "status": self._status,
            },
        }


class CalculationJobContextTest(unittest.TestCase):
    def resolve(self, status):
        client = CloudflareClient()
        with patch(
            "journal_engine.clients.api_client.requests.get",
            return_value=FakeResponse(status),
        ):
            return client.resolve_calculation_job_context("job_5gkyrzFJcBUb7sTAjPOBfA")

    def test_queued_job_is_valid_trusted_execution_context(self):
        self.assertEqual(self.resolve("queued"), ("user@example.com", "SPY"))

    def test_running_job_remains_valid_for_backward_compatibility(self):
        self.assertEqual(self.resolve("running"), ("user@example.com", "SPY"))

    def test_terminal_job_cannot_start_a_new_calculation(self):
        for status in ("succeeded", "failed"):
            with self.subTest(status=status):
                with self.assertRaises(CloudflareAPIError):
                    self.resolve(status)


if __name__ == "__main__":
    unittest.main()
