#define AppName "SatyaAI Drishti Companion"
#define AppVersion "0.1.0"
#define AppExe "SatyaAI.Drishti.Companion.exe"

[Setup]
AppId={{7DDF8C0A-3F7A-4EA5-9EC1-3BB8D75B2C14}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=SatyaAI
DefaultDirName={localappdata}\Programs\SatyaAI\Drishti
DefaultGroupName=SatyaAI
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=SatyaAI-Drishti-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
MinVersion=10.0.17763
UninstallDisplayIcon={app}\{#AppExe}
CloseApplications=no

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "autostart"; Description: "Start the Drishti companion automatically when I sign in to Windows"; GroupDescription: "Convenience:"; Flags: checkedonce

[Files]
Source: "..\companion\publish\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\runtime\server.py"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "..\runtime\requirements.txt"; DestDir: "{app}\runtime"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\SatyaAI\Drishti Companion"; Filename: "{app}\{#AppExe}"

[Registry]
Root: HKCU; Subkey: "Software\Classes\satyaai-drishiti"; ValueType: string; ValueName: ""; ValueData: "URL:SatyaAI Drishti Companion"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\satyaai-drishiti"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\satyaai-drishiti\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExe}"" ""%1"""
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "SatyaAI Drishti Companion"; ValueData: """{app}\{#AppExe}"" --background"; Tasks: autostart; Flags: uninsdeletevalue

[Run]
Filename: "{app}\{#AppExe}"; Parameters: "--install"; Description: "Start SatyaAI Drishti Companion and prepare the local engine"; Flags: postinstall nowait skipifsilent
