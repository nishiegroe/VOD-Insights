from app.vod.download_utils import parse_progress_template, sanitize_filename, validate_twitch_vod_url


def test_validate_twitch_vod_url() -> None:
    assert validate_twitch_vod_url("https://www.twitch.tv/videos/123456")
    assert not validate_twitch_vod_url("https://www.youtube.com/watch?v=123")


def test_parse_progress_template() -> None:
    parsed = parse_progress_template(" 84.7%| 30.37MiB/s|00:01")
    assert parsed is not None
    percentage, speed, eta = parsed
    assert percentage == 84.7
    assert speed == "30.37MiB/s"
    assert eta == "00:01"


def test_sanitize_filename() -> None:
    assert sanitize_filename("Name<With>Invalid:Chars") == "Name_With_Invalid_Chars"
