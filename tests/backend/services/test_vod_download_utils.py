from app.vod.download_utils import (
    parse_ffmpeg_progress,
    parse_progress_template,
    sanitize_filename,
    validate_twitch_vod_url,
)


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


def test_parse_progress_template_with_download_prefix() -> None:
    parsed = parse_progress_template("download:  1.5%|  1.50MiB/s|00:27:35")
    assert parsed is not None
    percentage, speed, eta = parsed
    assert percentage == 1.5
    assert speed == "1.50MiB/s"
    assert eta == "00:27:35"


def test_parse_progress_template_with_bracketed_prefix() -> None:
    parsed = parse_progress_template("[download] download:  0.4%|  3.12MiB/s|00:59:58")
    assert parsed is not None
    percentage, speed, eta = parsed
    assert percentage == 0.4
    assert speed == "3.12MiB/s"
    assert eta == "00:59:58"


def test_parse_progress_template_with_classic_output() -> None:
    parsed = parse_progress_template("[download]  12.3% of ~2.31GiB at 4.27MiB/s ETA 08:44")
    assert parsed is not None
    percentage, speed, eta = parsed
    assert percentage == 12.3
    assert speed == "4.27MiB/s"
    assert eta == "08:44"


def test_parse_progress_template_with_ansi_colored_output() -> None:
    parsed = parse_progress_template("\x1b[0;94m[download]\x1b[0m  0.7% of ~1.50GiB at 1.90MiB/s ETA 14:55")
    assert parsed is not None
    percentage, speed, eta = parsed
    assert percentage == 0.7
    assert speed == "1.90MiB/s"
    assert eta == "14:55"


def test_parse_ffmpeg_progress_line() -> None:
    parsed = parse_ffmpeg_progress(
        "frame=13800 fps= 64 q=-1.0 size=  221184KiB time=00:03:50.00 bitrate=7878.0kbits/s speed=1.07x elapsed=0:03:43.88"
    )
    assert parsed is not None
    current_seconds, speed_multiplier, bitrate_kbits = parsed
    assert round(current_seconds, 2) == 230.0
    assert speed_multiplier == 1.07
    assert bitrate_kbits == 7878.0


def test_sanitize_filename() -> None:
    assert sanitize_filename("Name<With>Invalid:Chars") == "Name_With_Invalid_Chars"
