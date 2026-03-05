from app.ocr_pipeline.detector import DetectionResult, EventDetector, cooldown_elapsed, detect_event_line, normalize_for_detection


def test_normalize_for_detection_keeps_alnum_and_spaces():
    assert normalize_for_detection("KNOCKED! Enemy-01") == "knocked enemy01"


def test_detect_event_line_matches_case_insensitive_and_normalized_text():
    lines = ["No event", "You KNOCKED: Player-123"]

    result = detect_event_line(lines, ["knocked player123"])

    assert result == DetectionResult(matched=True, matched_line="You KNOCKED: Player-123")


def test_detect_event_line_returns_no_match_when_keywords_absent():
    result = detect_event_line(["assist incoming"], ["eliminated"])

    assert result == DetectionResult(matched=False, matched_line="")


def test_cooldown_elapsed_boundary_behavior():
    assert cooldown_elapsed(now=10.0, last_trigger=9.0, cooldown_seconds=1.0)
    assert not cooldown_elapsed(now=9.99, last_trigger=9.0, cooldown_seconds=1.0)


def test_event_detector_detect_remains_backward_compatible_signature_and_behavior(monkeypatch):
    detector = EventDetector(keywords=["knocked"], cooldown_seconds=2.0)

    timeline = iter([100.0, 100.5, 102.1])
    monkeypatch.setattr("app.ocr_pipeline.detector.time.time", lambda: next(timeline))

    first = detector.detect(["You knocked one"])
    second = detector.detect(["You knocked one"])
    third = detector.detect(["You knocked one"])

    assert first.matched is True
    assert first.matched_line == "You knocked one"
    assert second == DetectionResult(matched=False, matched_line="")
    assert third == DetectionResult(matched=True, matched_line="You knocked one")


def test_event_detector_detect_at_is_deterministic_and_updates_internal_state():
    detector = EventDetector(keywords=["assist"], cooldown_seconds=1.0)

    first = detector.detect_at(["big ASSIST play"], now=5.0)
    second = detector.detect_at(["big ASSIST play"], now=5.5)
    third = detector.detect_at(["big ASSIST play"], now=6.1)

    assert first == DetectionResult(matched=True, matched_line="big ASSIST play")
    assert second == DetectionResult(matched=False, matched_line="")
    assert third == DetectionResult(matched=True, matched_line="big ASSIST play")
