"""One-time codes for parental consent.

The delivery channel is a stand-in until there is an email or SMS
subscription, but the rules around the code are not: an expiry that does not
expire, or an attempt counter that does not count, becomes production the day
the real sender is plugged in.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app import otp

NOW = datetime(2026, 10, 10, 12, 0, tzinfo=timezone.utc)
SALT = "consent-row-id"


class TestGeneration:
    def test_a_code_is_six_digits(self):
        for _ in range(50):
            code = otp.generate_code()
            assert len(code) == otp.CODE_LENGTH
            assert code.isdigit()

    def test_codes_are_not_predictable(self):
        # Not a randomness proof, but it catches a constant or a counter.
        assert len({otp.generate_code() for _ in range(200)}) > 150


class TestHashing:
    def test_the_hash_is_not_the_code(self):
        assert otp.hash_code("123456", SALT) != "123456"

    def test_the_same_code_hashes_differently_per_request(self):
        # Salted by the consent row id, so two learners holding the same code
        # do not share a hash.
        assert otp.hash_code("123456", "row-a") != otp.hash_code("123456", "row-b")

    def test_matching_is_exact(self):
        stored = otp.hash_code("123456", SALT)
        assert otp.codes_match("123456", stored, SALT)
        assert not otp.codes_match("123457", stored, SALT)
        assert not otp.codes_match("123456", stored, "another-row")

    def test_surrounding_space_is_tolerated(self):
        stored = otp.hash_code("123456", SALT)
        assert otp.codes_match("  123456 ", stored, SALT)


class TestChecking:
    def valid(self, **over):
        base = dict(
            supplied="123456",
            stored_hash=otp.hash_code("123456", SALT),
            salt=SALT,
            expires_at=NOW + timedelta(minutes=5),
            attempts=0,
            now=NOW,
        )
        return otp.check(**{**base, **over})

    def test_a_correct_code_passes(self):
        assert self.valid().ok

    def test_a_wrong_code_fails(self):
        assert not self.valid(supplied="999999").ok

    def test_an_expired_code_fails_even_if_correct(self):
        result = self.valid(expires_at=NOW - timedelta(seconds=1))
        assert not result.ok
        assert "expired" in result.reason.lower()

    def test_too_many_attempts_kills_the_code(self):
        result = self.valid(attempts=otp.MAX_ATTEMPTS)
        assert not result.ok
        assert "too many" in result.reason.lower()

    def test_the_attempt_cap_applies_even_to_the_right_code(self):
        # Otherwise an attacker who guesses on the last allowed try still wins.
        assert not self.valid(attempts=otp.MAX_ATTEMPTS, supplied="123456").ok

    def test_no_request_means_nothing_to_confirm(self):
        assert not self.valid(stored_hash=None).ok
        assert not self.valid(expires_at=None).ok

    def test_malformed_input_is_rejected(self):
        for bad in ["", "abc", "12345", "1234567", "12 34 56"]:
            assert not self.valid(supplied=bad).ok, bad

    def test_a_naive_timestamp_is_treated_as_utc(self):
        # SQLite returns naive datetimes; Postgres returns aware ones. The
        # code must not blow up or silently misjudge expiry on either.
        naive = (NOW + timedelta(minutes=5)).replace(tzinfo=None)
        assert self.valid(expires_at=naive).ok


class TestResendLimit:
    def test_a_first_send_is_allowed(self):
        assert otp.may_resend(None, now=NOW)

    def test_an_immediate_resend_is_refused(self):
        assert not otp.may_resend(NOW, now=NOW)

    def test_a_resend_is_allowed_after_the_interval(self):
        assert otp.may_resend(NOW - otp.RESEND_INTERVAL, now=NOW)

    def test_the_limit_exists_to_protect_the_parent(self):
        # A parent should not receive a code every few seconds because a
        # teenager is tapping the button.
        assert otp.RESEND_INTERVAL.total_seconds() >= 30


class TestExpiryWindow:
    def test_the_window_is_short_but_usable(self):
        minutes = otp.TTL.total_seconds() / 60
        assert 5 <= minutes <= 15

    def test_expiry_is_computed_from_now(self):
        assert otp.expiry_from(NOW) == NOW + otp.TTL


class TestSender:
    def test_the_demo_sender_is_clearly_a_demo(self):
        assert otp.get_sender("local").name == "console"
