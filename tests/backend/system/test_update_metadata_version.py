from __future__ import annotations

import json
from pathlib import Path

from app.system import update_metadata


def test_get_current_app_version_prefers_generated_version(tmp_path: Path, monkeypatch) -> None:
    fallback_meta = tmp_path / "app_meta.json"
    fallback_meta.write_text(json.dumps({"version": "9.9.9"}), encoding="utf-8")

    monkeypatch.setattr(update_metadata, "_get_generated_app_version", lambda: "1.2.3")
    monkeypatch.setattr(update_metadata, "_candidate_app_meta_paths", lambda: [fallback_meta])

    assert update_metadata.get_current_app_version() == "1.2.3"


def test_get_current_app_version_uses_first_valid_meta_candidate(tmp_path: Path, monkeypatch) -> None:
    invalid_json_meta = tmp_path / "invalid.json"
    invalid_json_meta.write_text("{not-valid-json", encoding="utf-8")
    non_string_meta = tmp_path / "non_string.json"
    non_string_meta.write_text(json.dumps({"version": 123}), encoding="utf-8")
    valid_meta = tmp_path / "valid.json"
    valid_meta.write_text(json.dumps({"version": " 2.4.6 "}), encoding="utf-8")

    monkeypatch.setattr(update_metadata, "_get_generated_app_version", lambda: "")
    monkeypatch.setattr(
        update_metadata,
        "_candidate_app_meta_paths",
        lambda: [tmp_path / "missing.json", invalid_json_meta, non_string_meta, valid_meta],
    )

    assert update_metadata.get_current_app_version() == "2.4.6"


def test_get_current_app_version_returns_empty_when_no_valid_source(tmp_path: Path, monkeypatch) -> None:
    empty_meta = tmp_path / "empty.json"
    empty_meta.write_text(json.dumps({"version": "   "}), encoding="utf-8")

    monkeypatch.setattr(update_metadata, "_get_generated_app_version", lambda: "")
    monkeypatch.setattr(update_metadata, "_candidate_app_meta_paths", lambda: [empty_meta])

    assert update_metadata.get_current_app_version() == ""


def test_get_current_app_version_install_meta_first_prefers_install_meta(tmp_path: Path, monkeypatch) -> None:
    install_dir = tmp_path / "install"
    install_dir.mkdir(parents=True, exist_ok=True)
    (install_dir / "app_meta.json").write_text(json.dumps({"version": "7.8.9"}), encoding="utf-8")

    monkeypatch.setenv("AET_VERSION_SOURCE_MODE", "install-meta-first")
    monkeypatch.setattr(update_metadata, "get_install_dir", lambda: install_dir)
    monkeypatch.setattr(update_metadata, "_get_generated_app_version", lambda: "1.2.3")

    assert update_metadata.get_current_app_version() == "7.8.9"


def test_get_current_app_version_install_meta_only_ignores_generated(tmp_path: Path, monkeypatch) -> None:
    install_dir = tmp_path / "install"
    install_dir.mkdir(parents=True, exist_ok=True)
    (install_dir / "app_meta.json").write_text(json.dumps({"version": "4.5.6"}), encoding="utf-8")

    monkeypatch.setenv("AET_VERSION_SOURCE_MODE", "install-meta-only")
    monkeypatch.setattr(update_metadata, "get_install_dir", lambda: install_dir)
    monkeypatch.setattr(update_metadata, "_get_generated_app_version", lambda: "1.2.3")
    monkeypatch.setattr(update_metadata, "_candidate_app_meta_paths", lambda: [])

    assert update_metadata.get_current_app_version() == "4.5.6"
