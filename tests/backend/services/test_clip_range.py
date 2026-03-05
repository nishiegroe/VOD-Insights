from pathlib import Path

import app.clip_range as clip_range


def _base_config(replay_dir: Path, bookmarks_dir: Path) -> dict:
    return {
        "replay": {"directory": str(replay_dir)},
        "split": {
            "extensions": [".mp4"],
            "output_dir": "clips",
            "encode_counts": False,
            "count_format": "k{kills}_a{assists}_d{deaths}",
        },
        "bookmarks": {
            "directory": str(bookmarks_dir),
            "session_prefix": "session",
        },
    }


def test_clip_range_missing_path(tmp_path: Path) -> None:
    config = _base_config(tmp_path, tmp_path / "bookmarks")
    payload, status = clip_range.create_clip_range_payload(config, "", 1, 2)
    assert status == 400
    assert payload["ok"] is False


def test_clip_range_invalid_time(tmp_path: Path) -> None:
    replay_dir = tmp_path / "replays"
    replay_dir.mkdir(parents=True, exist_ok=True)
    vod_file = replay_dir / "match.mp4"
    vod_file.write_bytes(b"vod")
    config = _base_config(replay_dir, tmp_path / "bookmarks")

    payload, status = clip_range.create_clip_range_payload(config, str(vod_file), "bad", 2)
    assert status == 400
    assert payload["ok"] is False


def test_clip_range_success(tmp_path: Path, monkeypatch) -> None:
    replay_dir = tmp_path / "replays"
    bookmarks_dir = tmp_path / "bookmarks"
    replay_dir.mkdir(parents=True, exist_ok=True)
    bookmarks_dir.mkdir(parents=True, exist_ok=True)
    vod_file = replay_dir / "match.mp4"
    vod_file.write_bytes(b"vod")

    config = _base_config(replay_dir, bookmarks_dir)

    def fake_run_ffmpeg(input_file: Path, output_file: Path, start: float, duration: float) -> None:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_bytes(b"clip")

    monkeypatch.setattr(clip_range, "run_ffmpeg", fake_run_ffmpeg)

    payload, status = clip_range.create_clip_range_payload(config, str(vod_file), 1.0, 3.5)
    assert status == 200
    assert payload["ok"] is True
    assert Path(payload["clip_path"]).exists()
