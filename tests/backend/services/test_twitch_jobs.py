import json
import time

from app.twitch import jobs


def test_prune_stale_twitch_jobs_removes_old_active_jobs(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(jobs, "DOWNLOADS_DIR", tmp_path)

    old_active = tmp_path / "job_old_active.json"
    old_active.write_text(json.dumps({"status": "downloading"}), encoding="utf-8")

    old_terminal = tmp_path / "job_old_done.json"
    old_terminal.write_text(json.dumps({"status": "completed"}), encoding="utf-8")

    fresh_active = tmp_path / "job_fresh_active.json"
    fresh_active.write_text(json.dumps({"status": "queued"}), encoding="utf-8")

    now = time.time()
    old_time = now - 7200
    fresh_time = now - 5
    old_active.touch()
    old_terminal.touch()
    fresh_active.touch()
    # Set explicit mtimes for stale-vs-fresh behavior.
    old_active_stat = old_time
    old_terminal_stat = old_time
    fresh_active_stat = fresh_time
    import os

    os.utime(old_active, (old_active_stat, old_active_stat))
    os.utime(old_terminal, (old_terminal_stat, old_terminal_stat))
    os.utime(fresh_active, (fresh_active_stat, fresh_active_stat))

    removed = jobs.prune_stale_twitch_jobs(max_age_seconds=60)

    assert removed == 1
    assert not old_active.exists()
    assert old_terminal.exists()
    assert fresh_active.exists()
