#define MyAppName "VOD Insights"
#define MyAppVersion "1.0.4"
#define MyAppPublisher "VODInsights"
#define MyAppExeName "VOD Insights.exe"

[Setup]
AppId={{A9BFF5A9-2D63-4B7B-9E38-73B2F8F0D27F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={pf}\{#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist-desktop\inno
OutputBaseFilename=VODInsights-Setup-{#MyAppVersion}
SetupIconFile=..\assets\branding\logo.ico
#ifdef AET_FAST_BUILD
Compression=none
SolidCompression=no
#else
Compression=lzma
SolidCompression=yes
#endif

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop icon"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "..\dist-desktop\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
