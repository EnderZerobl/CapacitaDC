"""Check deployment dependencies without connecting to a PostgreSQL server."""

import unittest

from sqlalchemy import create_engine


class PostgreSQLDriverTests(unittest.TestCase):
    def test_supported_urls_load_their_real_drivers(self):
        for scheme, expected_driver in [
            ("postgresql", None),
            ("postgresql+psycopg", "psycopg"),
            ("postgresql+psycopg2", "psycopg2"),
        ]:
            with self.subTest(scheme=scheme):
                # Engine construction imports the driver, which is where the
                # deployed function failed. It does not open a DB connection.
                engine = create_engine(f"{scheme}://test:test@localhost/test")
                try:
                    if expected_driver is not None:
                        self.assertEqual(engine.dialect.driver, expected_driver)
                    self.assertTrue(callable(engine.dialect.dbapi.connect))
                finally:
                    engine.dispose()
