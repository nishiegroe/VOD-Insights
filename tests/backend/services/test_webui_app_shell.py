from pathlib import Path
from threading import Lock

import app.webui_app_shell as shell


def test_cleanup_vod_scans_on_exit_creates_pause_marker(tmp_path: Path) -> None:
    bookmarks_dir = tmp_path / "bookmarks"
    bookmarks_dir.mkdir(parents=True, exist_ok=True)

    config = {
        "bookmarks": {
            "directory": str(bookmarks_dir),
            "session_prefix": "session",
        }
    }

    processes = {"my_vod": object()}
    shell.cleanup_vod_scans_on_exit(lambda: config, Lock(), processes)

    marker = bookmarks_dir / "session_my_vod.paused"
    assert marker.exists()


def test_register_signal_handlers(monkeypatch) -> None:
    calls = []

    def fake_signal(sig, handler):
        calls.append(sig)

    monkeypatch.setattr(shell.signal, "signal", fake_signal)
    shell.register_signal_handlers(lambda: None)
    assert shell.signal.SIGINT in calls
    assert shell.signal.SIGTERM in calls


def test_watch_for_changes_triggers_exit(tmp_path: Path, monkeypatch) -> None:
    target_file = tmp_path / "watch.py"
    target_file.write_text("a=1", encoding="utf-8")
    changed_file = tmp_path / "watch_changed.py"

    state = {"slept": 0}

    def fake_sleep(seconds: float) -> None:
        if state["slept"] == 0:
            changed_file.write_text("a=2", encoding="utf-8")
        state["slept"] += 1

    class RestartTriggered(Exception):
        pass

    def fake_exit(code: int) -> None:
        raise RestartTriggered(str(code))

    monkeypatch.setattr(shell.time, "sleep", fake_sleep)
    monkeypatch.setattr(shell.os, "_exit", fake_exit)

    try:
        shell.watch_for_changes([tmp_path], exit_restart_code=3, interval=0.01)
    except RestartTriggered as exc:
        assert str(exc) == "3"
    else:
        raise AssertionError("watch_for_changes should trigger restart")


def test_choose_directory_non_windows(monkeypatch) -> None:
    monkeypatch.setattr(shell.sys, "platform", "linux")
    assert shell.choose_directory() == ""
