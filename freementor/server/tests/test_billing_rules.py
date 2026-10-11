"""The billing rules, with no database in the way — §10.1, §10.3.

These are the decisions a tampered client must not be able to influence, so
they are tested as rules rather than only through the endpoints.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app import billing, play

NOW = datetime(2026, 10, 11, 12, 0, tzinfo=timezone.utc)


def state(**over) -> billing.CouponState:
    base = {
        "discount_tier": 50,
        "status": "active",
        "used_count": 0,
        "max_uses": None,
        "valid_from": None,
        "valid_to": None,
    }
    base.update(over)
    return billing.CouponState(**base)


# --- codes ------------------------------------------------------------------


class TestCodeFormat:
    def test_accepts_the_documented_shape(self) -> None:
        assert billing.check_code_format("TOPPER426")

    def test_normalises_what_a_learner_actually_types(self) -> None:
        # Lower case and stray spaces are the common case on a phone keyboard.
        assert billing.normalise_code("  topper426 ") == "TOPPER426"
        assert billing.check_code_format("topper426")
        assert billing.check_code_format("TOPPER 426")

    @pytest.mark.parametrize(
        "bad",
        [
            "TOPPER42",  # two digits
            "TOPPER4267",  # four digits
            "TOPPE426",  # five letters
            "TOPPERS426",  # seven letters
            "426TOPPER",  # the wrong way round
            "TOPP3R426",  # a digit among the letters
            "",
            "TOPPER-426",
        ],
    )
    def test_rejects_everything_else(self, bad: str) -> None:
        assert not billing.check_code_format(bad)


# --- product ids ------------------------------------------------------------


class TestProductIds:
    def test_maps_a_tier_to_its_product(self) -> None:
        assert billing.product_id("premium", 50) == "premium_off50"
        assert billing.product_id("basic", 90) == "basic_off90"

    def test_full_price_has_no_suffix(self) -> None:
        assert billing.product_id("basic") == "basic"

    def test_lists_every_product_the_console_needs(self) -> None:
        ids = billing.all_product_ids()
        # 2 plans + upgrade + 2 plans x 6 tiers.
        assert len(ids) == 15
        assert len(set(ids)) == 15, "duplicate product id"
        assert "upgrade_basic_to_premium" in ids
        for tier in billing.DISCOUNT_TIERS:
            assert f"premium_off{tier}" in ids

    def test_matches_the_app_side_mapping(self) -> None:
        # app/src/billing/coupons.ts builds the same strings. If these ever
        # diverge the app would launch a product that does not exist.
        assert billing.product_id("premium", 30) == "premium_off30"


class TestPlanFromProduct:
    @pytest.mark.parametrize(
        "product,plan",
        [
            ("basic", "basic"),
            ("premium", "premium"),
            ("basic_off10", "basic"),
            ("premium_off90", "premium"),
            ("upgrade_basic_to_premium", "premium"),
        ],
    )
    def test_recognises_what_we_sell(self, product: str, plan: str) -> None:
        assert billing.plan_from_product(product) == plan

    @pytest.mark.parametrize(
        "product",
        [
            "premium_off45",  # not a tier we sell
            "premium_off",
            "gold",
            "basic_off50_extra",
            "",
            "premium ",
        ],
    )
    def test_refuses_anything_else(self, product: str) -> None:
        # An unknown product must grant nothing. Inferring from a "premium"
        # prefix would let a client invent premium_off99.
        assert billing.plan_from_product(product) is None


# --- coupon usability -------------------------------------------------------


class TestCouponChecks:
    def test_an_active_coupon_is_usable(self) -> None:
        check = billing.check_coupon(state(), now=NOW)
        assert check.ok and check.tier == 50

    def test_an_unknown_code_is_not_found(self) -> None:
        check = billing.check_coupon(None, now=NOW)
        assert not check.ok
        assert check.problem is billing.CouponProblem.NOT_FOUND

    @pytest.mark.parametrize("status", ["archived", "expired", "deleted"])
    def test_only_active_coupons_work(self, status: str) -> None:
        assert not billing.check_coupon(state(status=status), now=NOW).ok

    def test_not_yet_started(self) -> None:
        check = billing.check_coupon(state(valid_from=NOW + timedelta(days=1)), now=NOW)
        assert check.problem is billing.CouponProblem.NOT_STARTED

    def test_usable_on_its_first_valid_moment(self) -> None:
        assert billing.check_coupon(state(valid_from=NOW), now=NOW).ok

    def test_expired(self) -> None:
        check = billing.check_coupon(state(valid_to=NOW - timedelta(seconds=1)), now=NOW)
        assert check.problem is billing.CouponProblem.EXPIRED

    def test_usable_on_its_last_valid_moment(self) -> None:
        assert billing.check_coupon(state(valid_to=NOW), now=NOW).ok

    def test_used_up_at_the_cap_not_past_it(self) -> None:
        assert billing.check_coupon(state(max_uses=5, used_count=4), now=NOW).ok
        check = billing.check_coupon(state(max_uses=5, used_count=5), now=NOW)
        assert check.problem is billing.CouponProblem.USED_UP

    def test_unlimited_when_max_uses_is_null(self) -> None:
        assert billing.check_coupon(state(max_uses=None, used_count=9999), now=NOW).ok

    def test_a_tier_we_do_not_sell_is_refused(self) -> None:
        # The discounted Play product would not exist, so offering it would
        # dead-end at the payment sheet.
        check = billing.check_coupon(state(discount_tier=45), now=NOW)
        assert check.problem is billing.CouponProblem.BAD_TIER

    def test_naive_timestamps_do_not_raise(self) -> None:
        # SQLite returns naive datetimes and Postgres aware ones; comparing
        # the two raises, which would surface as a 500 on a valid coupon.
        naive = datetime(2026, 1, 1, 0, 0)
        assert billing.check_coupon(state(valid_from=naive), now=NOW).ok

    def test_every_problem_has_a_message_a_learner_can_act_on(self) -> None:
        for problem in billing.CouponProblem:
            message = billing.COUPON_MESSAGES[problem]
            assert message and message[0].isupper() and message.endswith(".")
        # And they are distinct: "expired" and "fully claimed" are different
        # situations and must not read identically.
        assert len(set(billing.COUPON_MESSAGES.values())) == len(billing.CouponProblem)


# --- what a purchase grants -------------------------------------------------


class TestEntitlementFrom:
    def test_nothing_bought_grants_nothing(self) -> None:
        assert billing.entitlement_from([]) is None

    def test_a_confirmed_basic_grants_basic(self) -> None:
        assert (
            billing.entitlement_from([billing.PurchaseState("basic", "confirmed")]) == "basic"
        )

    def test_premium_outranks_basic_whatever_the_order(self) -> None:
        both = [
            billing.PurchaseState("basic", "confirmed"),
            billing.PurchaseState("premium", "confirmed"),
        ]
        assert billing.entitlement_from(both) == "premium"
        assert billing.entitlement_from(list(reversed(both))) == "premium"

    @pytest.mark.parametrize("bad_state", ["pending", "refunded", "cancelled", ""])
    def test_an_unconfirmed_purchase_grants_nothing(self, bad_state: str) -> None:
        # The whole reason purchase_state is stored: a pending payment must
        # not unlock anything.
        assert billing.entitlement_from([billing.PurchaseState("premium", bad_state)]) is None

    def test_a_pending_premium_does_not_mask_a_confirmed_basic(self) -> None:
        assert (
            billing.entitlement_from(
                [
                    billing.PurchaseState("premium", "pending"),
                    billing.PurchaseState("basic", "confirmed"),
                ]
            )
            == "basic"
        )


# --- the stand-in verifier --------------------------------------------------


class TestLocalVerifier:
    @pytest.mark.asyncio
    async def test_accepts_a_token_that_names_itself_a_test(self) -> None:
        result = await play.LocalVerifier().verify(
            purchase_token="test:order-1", product_id="basic"
        )
        assert result.ok
        assert result.order_id == "test:order-1"
        assert result.purchase_state == "confirmed"

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "token",
        [
            "",
            "order-1",
            "GPA.1234-5678-9012-34567",  # the shape of a real Play token
            "test:",
            " test:order-1",
        ],
    )
    async def test_refuses_anything_else(self, token: str) -> None:
        # Critically, it refuses something that looks like a real Play token:
        # there is no input that is both plausible and accepted here.
        result = await play.LocalVerifier().verify(purchase_token=token, product_id="basic")
        assert not result.ok

    def test_is_chosen_only_when_there_are_no_credentials(self) -> None:
        class NoCreds:
            google_play_service_account_json = ""

        class WithCreds:
            google_play_service_account_json = '{"type":"service_account"}'
            android_package_name = "com.freementor.app"

        assert isinstance(play.get_verifier(NoCreds()), play.LocalVerifier)
        assert isinstance(play.get_verifier(WithCreds()), play.GooglePlayVerifier)

    @pytest.mark.asyncio
    async def test_the_real_verifier_refuses_to_pretend(self) -> None:
        # A stub that returned ok=True would be the worst bug in this file.
        verifier = play.GooglePlayVerifier('{"type":"service_account"}', "com.freementor.app")
        with pytest.raises(NotImplementedError):
            await verifier.verify(purchase_token="GPA.1", product_id="basic")
