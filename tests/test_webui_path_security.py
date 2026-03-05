import app.webui as webui_module


def test_vod_single_endpoint_blocks_traversal_outside_allowlist(monkeypatch, tmp_path):
    allowed_dir = tmp_path / "replays"
    allowed_dir.mkdir()

    outside_file = tmp_path / "outside.mp4"
    outside_file.write_text("outside", encoding="utf-8")

    def fake_load_config():
        return {"replay": {"directory": str(allowed_dir)}}

    monkeypatch.setattr(webui_module, "load_config", fake_load_config)

    traversal_input = str(allowed_dir / ".." / outside_file.name)

    with webui_module.app.test_client() as client:
        response = client.get("/api/vods/single", query_string={"path": traversal_input})

    assert response.status_code == 404
    payload = response.get_json() or {}
    assert payload.get("ok") is False