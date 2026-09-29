"""Checks the catalog parser against saved program pages with layouts that once confused it.

Run: python -m unittest discover pipeline/tests
Each page below was checked by hand against the catalog.
"""

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "curriculum"))
import scrape_catalog  # noqa: E402


def parse(name):
    page = (HERE / "fixtures" / f"{name}.html").read_text(encoding="utf-8", errors="ignore")
    return {c["code"]: c["role"] for c in scrape_catalog.parse_requirements(page)}


class ComputerEngineering(unittest.TestCase):
    roles = parse("computer-engineering-bscompe")

    def test_core_courses_are_required(self):
        for code in ("EECE 2140", "EECE 2560", "EECE 4792", "MATH 1341"):
            self.assertEqual(self.roles[code], "required", code)

    def test_choose_one_of_the_following_is_an_option(self):
        for code in ("EECE 2412", "EECE 2520", "EECE 2530"):
            self.assertEqual(self.roles[code], "option", code)

    def test_course_ranges_are_read(self):
        self.assertIn("EECE 3324 to EECE 4698", self.roles)

    def test_codes_in_notes_are_ignored(self):
        # "EECE 2310 is not an approved course option" appears only in a note
        self.assertNotIn("EECE 2310", self.roles)


class Psychology(unittest.TestCase):
    roles = parse("psychology-bs")

    def test_only_four_courses_are_required(self):
        self.assertEqual(sorted(c for c, r in self.roles.items() if r == "required"),
                         ["EESC 2000", "INSC 1000", "PSYC 1101", "PSYC 2320"])

    def test_instruction_above_grouped_lists_covers_every_group(self):
        # "Complete three of the following courses. Choose from one group only." sits above the group headings
        for code in ("EDUC 5503", "ENVR 1101", "BIOL 1111"):
            self.assertEqual(self.roles[code], "option", code)

    def test_numbered_instruction_without_of_the_following(self):
        # "Complete two psychology lab courses OR ..."
        self.assertEqual(self.roles["PSYC 4600"], "option")


class InternationalAffairs(unittest.TestCase):
    joint = parse("international-affairs-criminal-justice-ba")
    major = parse("international-affairs-ba")

    def test_instruction_at_end_of_previous_table(self):
        # "Complete one of the following:" ends one table; the courses are in the next
        for code in ("INTL 3200", "INTL 5100"):
            self.assertEqual(self.joint[code], "option", code)

    def test_instruction_followed_by_a_note(self):
        # "Complete 8 semester hours from the global dynamics course list" then a note row, then the list
        for code in ("ENVR 1110", "ENVR 2515", "INTL 5100"):
            self.assertEqual(self.major[code], "option", code)

    def test_core_still_required(self):
        for code in ("INTL 1101", "INTL 3400", "POLS 1160"):
            self.assertEqual(self.major[code], "required", code)


if __name__ == "__main__":
    unittest.main()
