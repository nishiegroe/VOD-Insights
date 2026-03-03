{
  "targets": [
    {
      "target_name": "video_player",
      "sources": [
        "src/VideoPlayer.cc",
        "src/SyncMaster.cc",
        "src/VideoPlayerAddon.cc"
      ],
      "include_dirs": [
        "include",
        "<!(node -e \"require('nan')\")",
        "<!(vcpkg list 2>/dev/null | grep vlc | head -1 || echo /usr/include)"
      ],
      "conditions": [
        [
          "OS=='win32'",
          {
            "variables": {
              "vlc_root": "<!(where vlc.exe 2>nul | cmd /c \"for /f %A in ('findstr /r .') do @echo %~dpA..\")"
            },
            "include_dirs": [
              "$(vlc_root)/include"
            ],
            "library_dirs": [
              "$(vlc_root)/lib"
            ],
            "libraries": [
              "libvlc.lib",
              "libvlccore.lib"
            ],
            "defines": [
              "WIN32",
              "_WINDOWS"
            ]
          }
        ],
        [
          "OS=='mac'",
          {
            "include_dirs": [
              "/usr/local/include",
              "/opt/homebrew/include"
            ],
            "library_dirs": [
              "/usr/local/lib",
              "/opt/homebrew/lib"
            ],
            "libraries": [
              "-lvlc"
            ],
            "xcode_settings": {
              "CLANG_CXX_LANGUAGE_DIALECT": "c++20",
              "CLANG_CXX_LIBRARY": "libc++",
              "OTHER_CFLAGS": [
                "-fPIC"
              ],
              "OTHER_LDFLAGS": [
                "-lvlc"
              ]
            }
          }
        ],
        [
          "OS=='linux'",
          {
            "include_dirs": [
              "/usr/include",
              "/usr/include/vlc"
            ],
            "library_dirs": [
              "/usr/lib",
              "/usr/lib/x86_64-linux-gnu"
            ],
            "libraries": [
              "-lvlc",
              "-lvlccore"
            ],
            "cflags_cc": [
              "-fPIC",
              "-std=c++20"
            ]
          }
        ]
      ],
      "cflags_cc": [
        "-std=c++20",
        "-Wall",
        "-Wextra"
      ],
      "cflags_cc!": [
        "-fno-exceptions"
      ],
      "cflags!": [
        "-fno-exceptions"
      ]
    }
  ]
}
