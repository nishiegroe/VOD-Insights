from pathlib import Path
from types import SimpleNamespace

from app.clips.split_export import export_clip_windows


def test_export_clip_windows_success(tmp_path: Path) -> None:
    input_file = tmp_path / "input.mp4"
    input_file.write_bytes(b"input")
    output_dir = tmp_path / "clips"
    windows = [SimpleNamespace(start=1.0, end=3.0)]
    events = [SimpleNamespace(time=1.5, event="kill")]

    calls = {"run": 0, "validate": 0}

    def run_ffmpeg_fn(in_file: Path, out_file: Path, start: float, duration: float) -> None:
        calls["run"] += 1
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_bytes(b"ok")

    def validate_clip_fn(out_file: Path) -> bool:
        calls["validate"] += 1
        return out_file.exists()

    def count_events_fn(window_events):
        return {"kills": len(window_events), "assists": 0, "deaths": 0}

    failed = export_clip_windows(
        input_file=input_file,
        windows=windows,
        events=events,
        output_dir=output_dir,
        vod_start=__import__("datetime").datetime(2026, 3, 5, 10, 0, 0),
        encode_counts=True,
        count_format="k{kills}_a{assists}_d{deaths}",
        run_ffmpeg_fn=run_ffmpeg_fn,
        validate_clip_fn=validate_clip_fn,
        count_events_fn=count_events_fn,
    )

    assert failed == []
    assert calls["run"] == 1
    assert calls["validate"] == 1
    assert any(output_dir.glob("*.mp4"))


def test_export_clip_windows_validation_failure(tmp_path: Path) -> None:
    input_file = tmp_path / "input.mp4"
    input_file.write_bytes(b"input")
    output_dir = tmp_path / "clips"
    windows = [SimpleNamespace(start=1.0, end=2.0)]

    def run_ffmpeg_fn(in_file: Path, out_file: Path, start: float, duration: float) -> None:
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_bytes(b"bad")

    def validate_clip_fn(out_file: Path) -> bool:
        return False

    failed = export_clip_windows(
        input_file=input_file,
        windows=windows,
        events=[],
        output_dir=output_dir,
        vod_start=__import__("datetime").datetime(2026, 3, 5, 10, 0, 0),
        encode_counts=False,
        count_format="k{kills}_a{assists}_d{deaths}",
        run_ffmpeg_fn=run_ffmpeg_fn,
        validate_clip_fn=validate_clip_fn,
        count_events_fn=lambda _: {"kills": 0, "assists": 0, "deaths": 0},
    )

    assert len(failed) == 1
    assert not any(output_dir.glob("*.mp4"))
