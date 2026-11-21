using System.Diagnostics;
using System.IO.Pipes;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Win32;

namespace SatyaAI.Drishti.Companion;

internal sealed class CompanionForm : Form
{
    private const string RuntimeUrl = "http://127.0.0.1:7860";
    private const string UvVersion = "0.13.9";
    private const string UvArchiveSha256 = "edd61f7f5728a56cc62455386661860bdfc7bab65872f39b0c25bdcc1d8e1beb";
    private const string UvArchiveUrl = "https://github.com/astral-sh/uv/releases/download/0.13.9/uv-x86_64-pc-windows-msvc.zip";
    private const string AllowedOrigins =
        "https://satyaai-five.vercel.app," +
        "https://satyaai-teamsatyajitbeura.vercel.app," +
        "https://satyaai-git-main-teamsatyajitbeura.vercel.app";

    private readonly bool _startOnLaunch;
    private readonly bool _backgroundMode;
    private readonly string _dataRoot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "SatyaAI", "Drishti");
    private readonly string _installRoot = AppContext.BaseDirectory;
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(3) };
    private readonly HttpClient _downloadHttp = new() { Timeout = TimeSpan.FromMinutes(20) };
    private readonly SemaphoreSlim _startGate = new(1, 1);
    private readonly CancellationTokenSource _shutdown = new();
    private readonly Label _status = new();
    private readonly Label _detail = new();
    private readonly ProgressBar _progress = new();
    private readonly RichTextBox _log = new();
    private readonly Button _startButton = new();
    private readonly Button _hideButton = new();
    private readonly NotifyIcon _tray;
    private Process? _serverProcess;
    private bool _allowClose;

    public CompanionForm(string[] args)
    {
        _startOnLaunch = args.Any(IsStartArgument);
        _backgroundMode = args.Any(a => string.Equals(a, "--background", StringComparison.OrdinalIgnoreCase) || a.StartsWith("satyaai-drishti:", StringComparison.OrdinalIgnoreCase));

        Text = "SatyaAI · Drishti Companion";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(520, 360);
        Size = new Size(640, 470);
        BackColor = Color.FromArgb(15, 18, 35);
        ForeColor = Color.FromArgb(235, 239, 255);
        Font = new Font("Segoe UI", 9F);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;

        var heading = new Label
        {
            Text = "SATYAAI  /  DRISHTI",
            AutoSize = true,
            Font = new Font("Segoe UI Semibold", 15F, FontStyle.Bold),
            ForeColor = Color.FromArgb(116, 208, 255),
            Location = new Point(22, 18)
        };
        Controls.Add(heading);

        _status.Text = "Local image engine";
        _status.Font = new Font("Segoe UI Semibold", 12F, FontStyle.Bold);
        _status.AutoSize = true;
        _status.Location = new Point(24, 58);
        Controls.Add(_status);

        _detail.Text = "This companion keeps image inference on this computer.";
        _detail.AutoSize = false;
        _detail.Size = new Size(570, 36);
        _detail.Location = new Point(24, 86);
        _detail.ForeColor = Color.FromArgb(177, 187, 213);
        Controls.Add(_detail);

        _progress.Location = new Point(24, 128);
        _progress.Size = new Size(570, 14);
        _progress.Style = ProgressBarStyle.Marquee;
        _progress.MarqueeAnimationSpeed = 0;
        Controls.Add(_progress);

        _log.Location = new Point(24, 158);
        _log.Size = new Size(570, 210);
        _log.ReadOnly = true;
        _log.BorderStyle = BorderStyle.FixedSingle;
        _log.BackColor = Color.FromArgb(9, 12, 25);
        _log.ForeColor = Color.FromArgb(194, 207, 233);
        _log.Font = new Font("Consolas", 8.5F);
        _log.DetectUrls = false;
        Controls.Add(_log);

        _startButton.Text = "Start / reconnect";
        _startButton.Location = new Point(24, 388);
        _startButton.Size = new Size(150, 34);
        _startButton.FlatStyle = FlatStyle.Flat;
        _startButton.FlatAppearance.BorderColor = Color.FromArgb(80, 164, 220);
        _startButton.BackColor = Color.FromArgb(32, 48, 78);
        _startButton.ForeColor = Color.White;
        _startButton.Click += async (_, _) => await StartRuntimeAsync();
        Controls.Add(_startButton);

        _hideButton.Text = "Hide to tray";
        _hideButton.Location = new Point(184, 388);
        _hideButton.Size = new Size(110, 34);
        _hideButton.FlatStyle = FlatStyle.Flat;
        _hideButton.FlatAppearance.BorderColor = Color.FromArgb(70, 82, 118);
        _hideButton.BackColor = Color.FromArgb(27, 32, 55);
        _hideButton.ForeColor = Color.White;
        _hideButton.Click += (_, _) => HideToTray();
        Controls.Add(_hideButton);

        var openSite = new Button
        {
            Text = "Open SatyaAI",
            Location = new Point(484, 388),
            Size = new Size(110, 34),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(27, 32, 55),
            ForeColor = Color.White
        };
        openSite.FlatAppearance.BorderColor = Color.FromArgb(70, 82, 118);
        openSite.Click += (_, _) => OpenUrl("https://satyaai-five.vercel.app");
        Controls.Add(openSite);

        var menu = new ContextMenuStrip();
        menu.Items.Add("Open status", null, (_, _) => ShowFromTray());
        menu.Items.Add("Start / reconnect", null, async (_, _) => await StartRuntimeAsync());
        menu.Items.Add("Open SatyaAI", null, (_, _) => OpenUrl("https://satyaai-five.vercel.app"));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Exit companion", null, (_, _) => ExitCompanion());
        _tray = new NotifyIcon
        {
            Text = "SatyaAI Drishti Companion",
            Icon = SystemIcons.Application,
            ContextMenuStrip = menu,
            Visible = true
        };
        _tray.DoubleClick += (_, _) => ShowFromTray();

        Shown += OnFirstShown;
        Resize += (_, _) =>
        {
            if (WindowState == FormWindowState.Minimized)
                HideToTray();
        };
        FormClosing += OnFormClosing;
    }

    private static bool IsStartArgument(string value) =>
        string.Equals(value, "--install", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(value, "--background", StringComparison.OrdinalIgnoreCase) ||
        value.StartsWith("satyaai-drishti:", StringComparison.OrdinalIgnoreCase);

    private void OnFirstShown(object? sender, EventArgs e)
    {
        _ = ListenForStartRequestsAsync(_shutdown.Token);

        if (_startOnLaunch)
            _ = StartRuntimeAsync();

        if (_backgroundMode)
            BeginInvoke(new Action(HideToTray));
    }

    private async Task ListenForStartRequestsAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            try
            {
                await using var pipe = new NamedPipeServerStream(
                    "SatyaAI.Drishti.Companion.Command",
                    PipeDirection.In,
                    1,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous);

                await pipe.WaitForConnectionAsync(token);
                using var reader = new StreamReader(pipe, Encoding.UTF8, leaveOpen: true);
                var command = await reader.ReadLineAsync();
                if (string.Equals(command, "start", StringComparison.OrdinalIgnoreCase))
                {
                    BeginInvoke(new Action(() =>
                    {
                        _ = StartRuntimeAsync();
                    }));
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                AppendLog("Launcher signal: " + ex.Message);
                await Task.Delay(500, token).ContinueWith(_ => { }, TaskScheduler.Default);
            }
        }
    }

    private async Task StartRuntimeAsync()
    {
        await _startGate.WaitAsync();
        try
        {
            _startButton.Enabled = false;
            SetProgress(true);
            SetStatus("Checking local image engine", "Checking whether the local Drishti service is already running…");

            if (await IsRuntimeHealthyAsync())
            {
                SetProgress(false);
                SetStatus("Drishti is ready", "SatyaAI can now send image prompts to this computer.");
                AppendLog("Local service already running.");
                return;
            }

            Directory.CreateDirectory(_dataRoot);
            var runtimeDirectory = Path.Combine(_installRoot, "runtime");
            var serverFile = Path.Combine(runtimeDirectory, "server.py");
            var requirementsFile = Path.Combine(runtimeDirectory, "requirements.txt");
            if (!File.Exists(serverFile) || !File.Exists(requirementsFile))
                throw new FileNotFoundException("The installed companion is missing its runtime files. Reinstall the desktop companion.");

            // uv is a small, checksum-verified runtime manager. It installs Python
            // privately under LocalAppData, so users do not need system Python,
            // winget, PATH changes, or a terminal.
            SetStatus("Preparing the managed runtime", "Downloading and verifying the private runtime manager. This is a one-time setup.");
            var uv = await EnsureUvAsync();

            var venvDirectory = Path.Combine(_dataRoot, ".venv");
            var venvPython = Path.Combine(venvDirectory, "Scripts", "python.exe");
            if (!File.Exists(venvPython))
            {
                SetStatus("Preparing Python 3.12", "Drishti is downloading a private Python runtime for this app only.");
                AppendLog("Installing managed Python 3.12 with uv.");
                var pythonCode = await RunCommandAsync(
                    uv,
                    new[] { "python", "install", "3.12" },
                    "Preparing private Python 3.12",
                    useUvEnvironment: true);
                if (pythonCode != 0)
                    throw new InvalidOperationException("The private Python runtime could not be prepared. Check the internet connection and retry.");

                SetStatus("Creating the private environment", "Setting up Drishti in its own isolated folder.");
                var venvCode = await RunCommandAsync(
                    uv,
                    new[] { "venv", "--python", "3.12", "--seed", venvDirectory },
                    "Creating isolated Drishti environment",
                    useUvEnvironment: true);
                if (venvCode != 0 || !File.Exists(venvPython))
                    throw new InvalidOperationException("Could not create the private Drishti environment.");
            }

            var torchCheck = await CaptureCommandAsync(
                venvPython,
                new[] { "-c", "import torch; print('VERSION=' + torch.__version__); print('CUDA_AVAILABLE=' + str(torch.cuda.is_available()))" });
            var nvidiaSmi = FindOnPath("nvidia-smi.exe") ?? FindOnPath("nvidia-smi");
            var torchMissing = torchCheck.ExitCode != 0;
            var wrongBackend = !torchMissing && nvidiaSmi is not null &&
                !torchCheck.Output.Contains("CUDA_AVAILABLE=True", StringComparison.OrdinalIgnoreCase);

            if (torchMissing || wrongBackend)
            {
                SetStatus("Installing the image engine", "Selecting the best supported PyTorch backend for this computer.");
                AppendLog("Installing PyTorch with automatic CPU/CUDA/Intel accelerator selection.");
                var torchArguments = new List<string>
                {
                    "pip", "install", "--python", venvPython, "--torch-backend=auto"
                };
                if (wrongBackend)
                {
                    torchArguments.Add("--reinstall-package");
                    torchArguments.Add("torch");
                    torchArguments.Add("--reinstall-package");
                    torchArguments.Add("torchvision");
                }
                torchArguments.Add("torch");
                torchArguments.Add("torchvision");

                var code = await RunCommandAsync(
                    uv,
                    torchArguments,
                    "Installing hardware-aware PyTorch",
                    useUvEnvironment: true);
                if (code != 0)
                    throw new InvalidOperationException("The image engine could not install a compatible PyTorch backend. Check the companion log and retry.");
            }

            var dependenciesCheck = await CaptureCommandAsync(
                venvPython,
                new[] { "-c", "import fastapi, uvicorn, diffusers, transformers, psutil, PIL" });
            if (dependenciesCheck.ExitCode != 0)
            {
                SetStatus("Installing Drishti components", "Downloading the image pipeline libraries. They are cached for future launches.");
                AppendLog("Installing runtime/requirements.txt into the private environment.");
                var code = await RunCommandAsync(
                    uv,
                    new[] { "pip", "install", "--python", venvPython, "-r", requirementsFile },
                    "Installing Drishti dependencies",
                    useUvEnvironment: true);
                if (code != 0)
                    throw new InvalidOperationException("Drishti dependencies could not be installed. Check the companion log and retry.");
            }

            if (await IsRuntimeHealthyAsync())
            {
                SetProgress(false);
                SetStatus("Drishti is ready", "The local engine is already running.");
                return;
            }

            SetStatus("Starting local image engine", "Launching the private image service on this computer.");
            StartServerProcess(venvPython, runtimeDirectory);
            for (var attempt = 0; attempt < 45; attempt++)
            {
                if (await IsRuntimeHealthyAsync())
                {
                    SetProgress(false);
                    SetStatus("Drishti is ready", "The local engine is connected. Return to SatyaAI and submit your image prompt.");
                    AppendLog("Local Drishti service is ready at " + RuntimeUrl);
                    _tray.ShowBalloonTip(2500, "SatyaAI Drishti", "Local image engine is ready.", ToolTipIcon.Info);
                    return;
                }

                await Task.Delay(1000);
            }

            throw new TimeoutException("The local service did not become ready. Open the companion log and retry.");
        }
        catch (Exception ex)
        {
            SetProgress(false);
            SetStatus("Drishti needs attention", ex.Message);
            AppendLog("ERROR: " + ex);
            _tray.ShowBalloonTip(4000, "SatyaAI Drishti", "The local engine needs attention. Open the companion window.", ToolTipIcon.Warning);
        }
        finally
        {
            _startButton.Enabled = true;
            _startGate.Release();
        }
    }

    private async Task<string> EnsureUvAsync()
    {
        var toolsDirectory = Path.Combine(_dataRoot, "tools");
        var uvPath = Path.Combine(toolsDirectory, "uv.exe");
        if (File.Exists(uvPath))
            return uvPath;

        Directory.CreateDirectory(toolsDirectory);
        var downloadsDirectory = Path.Combine(_dataRoot, "downloads");
        Directory.CreateDirectory(downloadsDirectory);
        var archivePath = Path.Combine(downloadsDirectory, "uv-" + UvVersion + "-windows-x64.zip");

        AppendLog("Downloading the pinned uv " + UvVersion + " Windows runtime manager.");
        using (var response = await _downloadHttp.GetAsync(UvArchiveUrl, HttpCompletionOption.ResponseHeadersRead))
        {
            response.EnsureSuccessStatusCode();
            await using var archiveFile = new FileStream(archivePath, FileMode.Create, FileAccess.Write, FileShare.None);
            await response.Content.CopyToAsync(archiveFile);
        }

        await using (var archiveFile = File.OpenRead(archivePath))
        {
            var actualHash = Convert.ToHexString(await SHA256.HashDataAsync(archiveFile)).ToLowerInvariant();
            if (!string.Equals(actualHash, UvArchiveSha256, StringComparison.OrdinalIgnoreCase))
            {
                File.Delete(archivePath);
                throw new InvalidOperationException("The runtime manager download failed its SHA-256 integrity check. Nothing was installed.");
            }
        }

        using (var archive = ZipFile.OpenRead(archivePath))
        {
            var entry = archive.Entries.FirstOrDefault(item =>
                string.Equals(Path.GetFileName(item.FullName), "uv.exe", StringComparison.OrdinalIgnoreCase));
            if (entry is null)
                throw new InvalidDataException("The verified runtime archive did not contain uv.exe.");

            using var source = entry.Open();
            await using var destination = new FileStream(uvPath, FileMode.Create, FileAccess.Write, FileShare.None);
            await source.CopyToAsync(destination);
        }

        AppendLog("Verified runtime manager installed at " + uvPath);
        return uvPath;
    }

    private async Task<string?> FindPython312Async()
    {
        var launcher = FindOnPath("py.exe") ?? FindOnPath("py");
        if (launcher is null)
            return null;

        var result = await CaptureCommandAsync(
            launcher,
            new[] { "-3.12", "-c", "import sys; print(sys.executable)" });

        if (result.ExitCode != 0)
            return null;

        var candidate = result.Output.Trim().Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries).LastOrDefault();
        return !string.IsNullOrWhiteSpace(candidate) && File.Exists(candidate) ? candidate : null;
    }

    private void StartServerProcess(string pythonExe, string runtimeDirectory)
    {
        if (_serverProcess is { HasExited: false })
            return;

        var startInfo = new ProcessStartInfo
        {
            FileName = pythonExe,
            WorkingDirectory = runtimeDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        startInfo.ArgumentList.Add("-m");
        startInfo.ArgumentList.Add("uvicorn");
        startInfo.ArgumentList.Add("server:app");
        startInfo.ArgumentList.Add("--host");
        startInfo.ArgumentList.Add("127.0.0.1");
        startInfo.ArgumentList.Add("--port");
        startInfo.ArgumentList.Add("7860");
        startInfo.ArgumentList.Add("--log-level");
        startInfo.ArgumentList.Add("info");

        startInfo.Environment["HF_HOME"] = Path.Combine(_dataRoot, "model-cache");
        startInfo.Environment["SATYAAI_ALLOWED_ORIGINS"] = AllowedOrigins;
        startInfo.Environment["PYTHONUNBUFFERED"] = "1";
        Directory.CreateDirectory(startInfo.Environment["HF_HOME"]!);

        _serverProcess = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        _serverProcess.OutputDataReceived += (_, e) => { if (e.Data is not null) AppendLog(e.Data); };
        _serverProcess.ErrorDataReceived += (_, e) => { if (e.Data is not null) AppendLog(e.Data); };
        _serverProcess.Exited += (_, _) => AppendLog("The local Python service stopped.");
        if (!_serverProcess.Start())
            throw new InvalidOperationException("Windows could not start the local Python service.");

        _serverProcess.BeginOutputReadLine();
        _serverProcess.BeginErrorReadLine();
        AppendLog("Started local Python service (PID " + _serverProcess.Id + ").");
    }

    private async Task<bool> IsRuntimeHealthyAsync()
    {
        try
        {
            using var response = await _http.GetAsync(RuntimeUrl + "/health");
            if (!response.IsSuccessStatusCode)
                return false;

            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var root = document.RootElement;
            return root.TryGetProperty("ok", out var ok) &&
                   ok.ValueKind == JsonValueKind.True &&
                   root.TryGetProperty("service", out var service) &&
                   service.GetString() == "satyaai-drishti-runtime";
        }
        catch
        {
            return false;
        }
    }

    private async Task<int> RunCommandAsync(
        string executable,
        IEnumerable<string> arguments,
        string label,
        bool useUvEnvironment = false)
    {
        AppendLog("> " + label);
        var startInfo = CreateProcessInfo(executable, arguments);
        if (useUvEnvironment)
        {
            startInfo.Environment["UV_PYTHON_INSTALL_DIR"] = Path.Combine(_dataRoot, "python");
            startInfo.Environment["UV_CACHE_DIR"] = Path.Combine(_dataRoot, "uv-cache");
        }
        startInfo.RedirectStandardOutput = true;
        startInfo.RedirectStandardError = true;

        using var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        process.OutputDataReceived += (_, e) => { if (e.Data is not null) AppendLog(e.Data); };
        process.ErrorDataReceived += (_, e) => { if (e.Data is not null) AppendLog(e.Data); };

        if (!process.Start())
            throw new InvalidOperationException("Could not start " + label + ".");

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        await process.WaitForExitAsync();
        AppendLog(label + " finished with exit code " + process.ExitCode + ".");
        return process.ExitCode;
    }

    private static async Task<(int ExitCode, string Output)> CaptureCommandAsync(
        string executable,
        IEnumerable<string> arguments)
    {
        var startInfo = CreateProcessInfo(executable, arguments);
        startInfo.RedirectStandardOutput = true;
        startInfo.RedirectStandardError = true;

        using var process = new Process { StartInfo = startInfo };
        try
        {
            if (!process.Start())
                return (-1, "");

            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();
            return (process.ExitCode, (await stdout) + Environment.NewLine + (await stderr));
        }
        catch
        {
            return (-1, "");
        }
    }

    private static ProcessStartInfo CreateProcessInfo(string executable, IEnumerable<string> arguments)
    {
        var info = new ProcessStartInfo
        {
            FileName = executable,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)
        };
        foreach (var argument in arguments)
            info.ArgumentList.Add(argument);
        return info;
    }

    private static string? FindOnPath(string executable)
    {
        var path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var folder in path.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var candidate = Path.Combine(folder.Trim('"'), executable);
            if (File.Exists(candidate))
                return candidate;
        }
        return null;
    }

    private async Task<bool> IsRuntimeInstalledAsync() =>
        File.Exists(Path.Combine(_dataRoot, ".venv", "Scripts", "python.exe"));

    private void SetStatus(string title, string detail)
    {
        if (InvokeRequired)
        {
            BeginInvoke(new Action(() => SetStatus(title, detail)));
            return;
        }
        _status.Text = title;
        _detail.Text = detail;
    }

    private void SetProgress(bool active)
    {
        if (InvokeRequired)
        {
            BeginInvoke(new Action(() => SetProgress(active)));
            return;
        }
        _progress.Style = active ? ProgressBarStyle.Marquee : ProgressBarStyle.Blocks;
        _progress.MarqueeAnimationSpeed = active ? 26 : 0;
        _progress.Value = active ? 0 : 100;
    }

    private void AppendLog(string text)
    {
        if (IsDisposed)
            return;

        if (InvokeRequired)
        {
            try { BeginInvoke(new Action(() => AppendLog(text))); }
            catch (InvalidOperationException) { }
            return;
        }

        var line = DateTime.Now.ToString("HH:mm:ss") + "  " + text;
        _log.AppendText(line + Environment.NewLine);
        _log.SelectionStart = _log.TextLength;
        _log.ScrollToCaret();

        try
        {
            Directory.CreateDirectory(_dataRoot);
            File.AppendAllText(Path.Combine(_dataRoot, "companion.log"), line + Environment.NewLine);
        }
        catch { }
    }

    private void HideToTray()
    {
        Hide();
        ShowInTaskbar = false;
    }

    private void ShowFromTray()
    {
        ShowInTaskbar = true;
        Show();
        WindowState = FormWindowState.Normal;
        Activate();
    }

    private void ExitCompanion()
    {
        _allowClose = true;
        _shutdown.Cancel();
        try
        {
            if (_serverProcess is { HasExited: false })
                _serverProcess.Kill(entireProcessTree: true);
        }
        catch { }
        _tray.Visible = false;
        Close();
    }

    private void OnFormClosing(object? sender, FormClosingEventArgs e)
    {
        if (!_allowClose && e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            HideToTray();
            return;
        }

        _shutdown.Cancel();
        _tray.Visible = false;
        try
        {
            if (_serverProcess is { HasExited: false })
                _serverProcess.Kill(entireProcessTree: true);
        }
        catch { }
    }

    private static void OpenUrl(string url)
    {
        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch { }
    }
}
