from pathlib import Path

from app.system.path_policy import resolve_allowed_path, resolve_existing_allowed_path


def test_resolve_allowed_path_allows_file_within_allowlisted_directory(tmp_path):
    allowed_dir = tmp_path / "allowed"
    allowed_dir.mkdir()
    file_path = allowed_dir / "clip.mp4"

    resolved = resolve_allowed_path(str(file_path), [allowed_dir])

    assert resolved == file_path.resolve()


def test_resolve_allowed_path_blocks_traversal_outside_allowlisted_directory(tmp_path):
    allowed_dir = tmp_path / "allowed"
    allowed_dir.mkdir()
    outside_file = tmp_path / "outside.mp4"
    outside_file.write_text("x", encoding="utf-8")

    traversal_path = allowed_dir / ".." / outside_file.name
    resolved = resolve_allowed_path(str(traversal_path), [allowed_dir])

    assert resolved is None


def test_resolve_allowed_path_returns_none_for_empty_path(tmp_path):
    allowed_dir = tmp_path / "allowed"
    allowed_dir.mkdir()

    resolved = resolve_allowed_path("", [allowed_dir])

    assert resolved is None


def test_resolve_existing_allowed_path_requires_existing_file(tmp_path):
    allowed_dir = tmp_path / "allowed"
    allowed_dir.mkdir()
    missing_file = allowed_dir / "missing.mp4"

    resolved = resolve_existing_allowed_path(str(missing_file), [allowed_dir])

    assert resolved is None


def test_resolve_existing_allowed_path_returns_file_when_allowed_and_present(tmp_path):
    allowed_dir = tmp_path / "allowed"
    allowed_dir.mkdir()
    file_path = allowed_dir / "present.mp4"
    file_path.write_text("ok", encoding="utf-8")

    resolved = resolve_existing_allowed_path(str(file_path), [allowed_dir])

    assert resolved == file_path.resolve()