from __future__ import annotations

import json
import os
from pathlib import Path

import app.clips.titles as titles_module


def test_get_clip_title_supports_legacy_resolved_key(tmp_path: Path) -> None:
    clip_path = tmp_path / "clips" / "folder" / ".." / "match.mp4"
    legacy_key = os.path.normcase(str(clip_path.resolve()))
    titles = {legacy_key: "Legacy Title"}

    assert titles_module.get_clip_title(clip_path, titles) == "Legacy Title"


def test_set_clip_title_removes_legacy_key_when_writing_current_key(
    tmp_path: Path,
    monkeypatch,
) -> None:
    titles_path = tmp_path / "clip_titles.json"
    monkeypatch.setattr(titles_module, "CLIP_TITLES_PATH", titles_path)

    clip_path = tmp_path / "clips" / "nested" / ".." / "fight.mp4"
    current_key = titles_module.normalize_clip_path(clip_path)
    legacy_key = os.path.normcase(str(clip_path.resolve()))

    titles_path.write_text(json.dumps({legacy_key: "Old Title"}), encoding="utf-8")

    titles_module.set_clip_title(clip_path, "New Title")
    updated = titles_module.load_clip_titles()

    assert updated[current_key] == "New Title"
    if legacy_key != current_key:
        assert legacy_key not in updated
