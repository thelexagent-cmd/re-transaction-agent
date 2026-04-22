"""Unit tests for property_scorer.py"""

import pytest
from app.services.property_scorer import (
    haversine_miles,
    score_property,
    ScoringInput,
)


def test_haversine_same_point():
    assert haversine_miles(25.8576, -80.2781, 25.8576, -80.2781) == pytest.approx(0.0, abs=0.001)


def test_haversine_known_distance():
    dist = haversine_miles(25.7959, -80.2870, 25.8576, -80.2781)
    assert 4.0 < dist < 5.0


def test_score_all_signals_max():
    inp = ScoringInput(
        price=200_000, zestimate=240_000, zip_median_value=280_000,
        year_built=1965, zip_median_year_built=1972,
        days_on_market=60, price_reduction_30d=15_000,
        nearest_permit_distance_mi=0.3,
    )
    assert score_property(inp).score == 100


def test_score_no_signals():
    inp = ScoringInput(
        price=400_000, zestimate=390_000, zip_median_value=350_000,
        year_built=2015, zip_median_year_built=1972,
        days_on_market=10, price_reduction_30d=None,
        nearest_permit_distance_mi=None,
    )
    assert score_property(inp).score == 0


def test_score_partial_signals():
    inp = ScoringInput(
        price=280_000, zestimate=320_000, zip_median_value=350_000,
        year_built=1975, zip_median_year_built=1972,
        days_on_market=30, price_reduction_30d=None,
        nearest_permit_distance_mi=1.5,
    )
    result = score_property(inp)
    assert result.score == 62
    assert result.signal_near_permit is True
    assert result.signal_old_house is True


def test_score_permit_distance_tiers():
    base = dict(
        price=200_000, zestimate=200_000, zip_median_value=200_000,
        year_built=2010, zip_median_year_built=1972,
        days_on_market=10, price_reduction_30d=None,
    )
    assert score_property(ScoringInput(**base, nearest_permit_distance_mi=0.3)).score == 35
    assert score_property(ScoringInput(**base, nearest_permit_distance_mi=0.8)).score == 25
    assert score_property(ScoringInput(**base, nearest_permit_distance_mi=1.5)).score == 17
    assert score_property(ScoringInput(**base, nearest_permit_distance_mi=2.5)).score == 0
