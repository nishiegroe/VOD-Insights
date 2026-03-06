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


def test_session_data_file_not_found(tmp_path: Path) -> None:
    bookmarks_dir = tmp_path / "bookmarks"
    bookmarks_dir.mkdir(parents=True, exist_ok=True)
    missing = bookmarks_dir / "missing.csv"

    payload, status = session_data_payload(
        str(missing),
        {"bookmarks": {"directory": str(bookmarks_dir)}},
    )

    assert status == 404
    assert payload["ok"] is False


def test_session_data_jsonl_skips_malformed_rows(tmp_path: Path) -> None:
    bookmarks_dir = tmp_path / "bookmarks"
    bookmarks_dir.mkdir(parents=True, exist_ok=True)
    session_file = bookmarks_dir / "session_test.jsonl"
    session_file.write_text(
        '{"timestamp":"ok","seconds_since_start":1.5,"event":"Kill","ocr":"foo"}\n'
        'not-json\n'
        '{"timestamp":"bad","seconds_since_start":"nanx","event":"Assist"}\n',
        encoding="utf-8",
    )

    payload, status = session_data_payload(
        str(session_file),
        {"bookmarks": {"directory": str(bookmarks_dir)}},
    )

    assert status == 200
    assert payload["ok"] is True
    assert len(payload["bookmarks"]) == 1
    assert payload["bookmarks"][0]["event"] == "Kill"


def test_session_data_read_failure_returns_500(tmp_path: Path, monkeypatch) -> None:
    bookmarks_dir = tmp_path / "bookmarks"
    bookmarks_dir.mkdir(parents=True, exist_ok=True)
    session_file = bookmarks_dir / "session_test.csv"
    session_file.write_text("timestamp,seconds_since_start,event,ocr\n", encoding="utf-8")

    original_open = Path.open

    def fake_open(path_obj, *args, **kwargs):
        if str(path_obj) == str(session_file):
            raise OSError("denied")
        return original_open(path_obj, *args, **kwargs)

    monkeypatch.setattr(Path, "open", fake_open)

    payload, status = session_data_payload(
        str(session_file),
        {"bookmarks": {"directory": str(bookmarks_dir)}},
    )

    assert status == 500
    assert payload["ok"] is False
