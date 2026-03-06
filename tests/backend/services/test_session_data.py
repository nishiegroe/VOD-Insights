from pathlib import Path

from app.session_data import session_data_payload


def test_session_data_missing_path() -> None:
    payload, status = session_data_payload("", {"bookmarks": {"directory": "bookmarks"}})
    assert status == 400
    assert payload["ok"] is False


def test_session_data_invalid_path(tmp_path: Path) -> None:
    bookmarks_dir = tmp_path / "bookmarks"
    bookmarks_dir.mkdir(parents=True, exist_ok=True)
    outside_file = tmp_path / "outside.csv"
    outside_file.write_text("timestamp,seconds_since_start,event,ocr\n", encoding="utf-8")

    payload, status = session_data_payload(
        str(outside_file),
        {"bookmarks": {"directory": str(bookmarks_dir)}},
    )
    assert status == 403
    assert payload["ok"] is False


def test_session_data_csv_success(tmp_path: Path) -> None:
    bookmarks_dir = tmp_path / "bookmarks"
    bookmarks_dir.mkdir(parents=True, exist_ok=True)
    session_file = bookmarks_dir / "session_test.csv"
    session_file.write_text(
        "timestamp,seconds_since_start,event,ocr\n"
        "2026-03-05 10:00:00,12.5,Kill,foo\n",
        encoding="utf-8",
    )

    payload, status = session_data_payload(
        str(session_file),
        {"bookmarks": {"directory": str(bookmarks_dir)}},
    )
    assert status == 200
    assert payload["ok"] is True
    assert payload["session_name"] == session_file.name
    assert len(payload["bookmarks"]) == 1
    assert payload["bookmarks"][0]["event"] == "Kill"
