from pathlib import Path
import subprocess

import app.clips.range as clip_range


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


def test_clip_range_end_before_start(tmp_path: Path) -> None:
    replay_dir = tmp_path / "replays"
    replay_dir.mkdir(parents=True, exist_ok=True)
    vod_file = replay_dir / "match.mp4"
    vod_file.write_bytes(b"vod")
    config = _base_config(replay_dir, tmp_path / "bookmarks")

    payload, status = clip_range.create_clip_range_payload(config, str(vod_file), 5, 4)
    assert status == 400
    assert payload["ok"] is False


def test_clip_range_unsupported_extension(tmp_path: Path) -> None:
    replay_dir = tmp_path / "replays"
    replay_dir.mkdir(parents=True, exist_ok=True)
    vod_file = replay_dir / "match.mkv"
    vod_file.write_bytes(b"vod")
    config = _base_config(replay_dir, tmp_path / "bookmarks")

    payload, status = clip_range.create_clip_range_payload(config, str(vod_file), 1, 2)
    assert status == 400
    assert payload["ok"] is False


def test_clip_range_rejects_path_outside_allowed_dirs(tmp_path: Path) -> None:
    replay_dir = tmp_path / "replays"
    replay_dir.mkdir(parents=True, exist_ok=True)
    outside = tmp_path / "outside.mp4"
    outside.write_bytes(b"vod")
    config = _base_config(replay_dir, tmp_path / "bookmarks")

    payload, status = clip_range.create_clip_range_payload(config, str(outside), 1, 2)
    assert status == 403
    assert payload["ok"] is False


def test_clip_range_ffmpeg_failure_returns_500(tmp_path: Path, monkeypatch) -> None:
    replay_dir = tmp_path / "replays"
    replay_dir.mkdir(parents=True, exist_ok=True)
    vod_file = replay_dir / "match.mp4"
    vod_file.write_bytes(b"vod")
    config = _base_config(replay_dir, tmp_path / "bookmarks")

    def fake_fail(*_args, **_kwargs):
        raise subprocess.CalledProcessError(returncode=1, cmd=["ffmpeg"])

    monkeypatch.setattr(clip_range, "run_ffmpeg", fake_fail)

    payload, status = clip_range.create_clip_range_payload(config, str(vod_file), 1, 2)
    assert status == 500
    assert payload["ok"] is False


def test_clip_range_encode_counts_updates_name(tmp_path: Path, monkeypatch) -> None:
    replay_dir = tmp_path / "replays"
    bookmarks_dir = tmp_path / "bookmarks"
    replay_dir.mkdir(parents=True, exist_ok=True)
    bookmarks_dir.mkdir(parents=True, exist_ok=True)
    vod_file = replay_dir / "match.mp4"
    vod_file.write_bytes(b"vod")

    config = _base_config(replay_dir, bookmarks_dir)
    config["split"]["encode_counts"] = True
    config["split"]["count_format"] = "k{kills}_a{assists}_d{deaths}"

    monkeypatch.setattr(
        clip_range,
        "list_sessions_for_vod",
        lambda *_args, **_kwargs: [{"path": str(bookmarks_dir / "session.csv")}],
    )

    class Event:
        def __init__(self, time: float, event: str):
            self.time = time
            self.event = event

    monkeypatch.setattr(
        clip_range,
        "load_bookmarks",
        lambda _path: [Event(2.0, "Kill"), Event(2.2, "Assist")],
    )

    def fake_run_ffmpeg(_input: Path, output_file: Path, _start: float, _duration: float) -> None:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_bytes(b"clip")

    monkeypatch.setattr(clip_range, "run_ffmpeg", fake_run_ffmpeg)

    payload, status = clip_range.create_clip_range_payload(config, str(vod_file), 1.5, 2.5)
    assert status == 200
    assert payload["ok"] is True
    assert "_k1_a1_d0" in Path(payload["clip_path"]).name


def test_clip_range_does_not_duplicate_relative_output_dir_for_existing_clip(
    tmp_path: Path, monkeypatch
) -> None:
    replay_dir = tmp_path / "replays"
    clips_dir = replay_dir / "clips"
    bookmarks_dir = tmp_path / "bookmarks"
    clips_dir.mkdir(parents=True, exist_ok=True)
    bookmarks_dir.mkdir(parents=True, exist_ok=True)
    input_clip = clips_dir / "clip_source.mp4"
    input_clip.write_bytes(b"clip")

    config = _base_config(replay_dir, bookmarks_dir)

    def fake_run_ffmpeg(_input: Path, output_file: Path, _start: float, _duration: float) -> None:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_bytes(b"clip")

    monkeypatch.setattr(clip_range, "run_ffmpeg", fake_run_ffmpeg)

    payload, status = clip_range.create_clip_range_payload(config, str(input_clip), 1.0, 2.0)
    assert status == 200
    assert payload["ok"] is True
    output_path = Path(payload["clip_path"])
    assert output_path.parent == clips_dir
    assert not (clips_dir / "clips").exists()


def test_clip_range_empty_output_dir_keeps_existing_clips_parent(
    tmp_path: Path, monkeypatch
) -> None:
    replay_dir = tmp_path / "replays"
    clips_dir = replay_dir / "clips"
    bookmarks_dir = tmp_path / "bookmarks"
    clips_dir.mkdir(parents=True, exist_ok=True)
    bookmarks_dir.mkdir(parents=True, exist_ok=True)
    input_clip = clips_dir / "clip_source.mp4"
    input_clip.write_bytes(b"clip")

    config = _base_config(replay_dir, bookmarks_dir)
    config["split"]["output_dir"] = ""

    def fake_run_ffmpeg(_input: Path, output_file: Path, _start: float, _duration: float) -> None:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_bytes(b"clip")

    monkeypatch.setattr(clip_range, "run_ffmpeg", fake_run_ffmpeg)

    payload, status = clip_range.create_clip_range_payload(config, str(input_clip), 1.0, 2.0)
    assert status == 200
    assert payload["ok"] is True
    output_path = Path(payload["clip_path"])
    assert output_path.parent == clips_dir
    assert not (clips_dir / "clips").exists()
