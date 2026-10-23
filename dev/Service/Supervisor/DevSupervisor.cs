#nullable disable

using System.Diagnostics;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Dev.Service.Supervisor;

public sealed class Problem
{
    public string File;
    public int? Line;
    public int? Column;
    public string Message;
    public string Code;
    public string Bundle;
}

public sealed class SupervisorTask
{
    public string Key;
    public string Label;
    public string Group;
    public string[] After = Array.Empty<string>();
    public string Status = "waiting";
    public string Detail = "";
    public string Updated;
    public long? Took;
    public bool Ready;
    public string Url;
    public List<Problem> Problems = new();

    public string FileName;
    public string[] Arguments;
    public string Cwd = "";
    public Action<SupervisorTask, string> Parse;
    public long? Since;
    public List<Problem> PendingErrors;
    public string PendingMessage;
    public Process Process;
    public bool Once;
    public string Bundle;
    public bool Collecting;
    public Timer Recovery;
}

public sealed class LogEntry
{
    public long Id;
    public string Time;
    public string Task;
    public string Text;
    public string Level;
}

public sealed class DevSupervisor
{
    public const string ServerUrl = "http://localhost:5000";
    const int RecoverySeconds = 10;
    const string Tsc = "node_modules/typescript/bin/tsc";
    const string Rollup = "node_modules/rollup/dist/bin/rollup";
    const string Sass = "node_modules/sass/sass.js";
    const string VidyanoSources = "packages/vidyano/src";
    // The SHA-256 of the package-lock.json of a worktree's last successful npm ci
    const string InstallStamp = "node_modules/.cache/vidyano-dev/lock.sha";

    static readonly Regex Ansi = new(@"\x1b\[[0-9;?]*[A-Za-z]");
    static readonly Regex Timestamp = new(@"^(\d{1,2}:\d{2}:\d{2}( [AP]M)? - |\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?\] |\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z )");
    static readonly Regex CompilerErrorLine = new(@"^(.+?)\((\d+),(\d+)\): error (\w+): (.*?)(?: \[[^\]]+\])?$");

    public static DevSupervisor Instance { get; private set; }

    public readonly object Gate;
    public readonly string Root;
    public readonly string Workspace;
    public readonly DevSupervisor Host;
    public readonly string InstanceId = Guid.NewGuid().ToString("N");
    public readonly string Node = Environment.GetEnvironmentVariable("VIDYANO_NODE") ?? "node";
    public readonly List<SupervisorTask> Tasks;
    public readonly TestRunner Tests;
    public bool ShuttingDown { get; private set; }

    readonly List<LogEntry> log = new();
    readonly string installHash;
    long version;
    long nextLogId = 1;
    TaskCompletionSource changed = new(TaskCreationOptions.RunContinuationsAsynchronously);

    DevSupervisor(string root, DevSupervisor host = null, string workspace = null)
    {
        Root = root;
        Host = host ?? this;
        Workspace = workspace;
        Gate = host?.Gate ?? new object();

        var install = host != null && NeedsInstall(root);
        installHash = install ? LockHash(root) : null;
        var watchAfter = install ? new[] { "install" } : Array.Empty<string>();
        Tasks = new List<SupervisorTask>
        {
            NodeTask("ts-core", "TypeScript · core", "frontend", "", new[] { Tsc, "-w", "--preserveWatchOutput", "--pretty", "false", "-p", "packages/core/tsconfig.json" }, ParseTsc, watchAfter),
            // rollup-core is ready once it has bundled dist/index.d.ts, which the vidyano and virtual-service compiles need.
            NodeTask("rollup-core", "Rollup · core", "frontend", "packages/core", new[] { Rollup, "-c", "-w", "--bundleConfigAsCjs" }, ParseRollup, "ts-core"),
            NodeTask("sass", "Sass", "frontend", "", new[] { Sass, "--watch", "--poll", "--no-source-map", $"{VidyanoSources}:{VidyanoSources}" }, ParseSass, watchAfter),
            NodeTask("ts-vidyano", "TypeScript · vidyano", "frontend", "", new[] { Tsc, "-w", "--preserveWatchOutput", "--pretty", "false", "-p", "packages/vidyano/tsconfig.json" }, ParseTsc, "rollup-core", "sass"),
            NodeTask("rollup-vidyano", "Rollup · vidyano", "frontend", "packages/vidyano", new[] { Rollup, "-c", "-w", "--bundleConfigAsCjs" }, ParseRollup, "ts-vidyano", "sass"),
            NodeTask("ts-virtual-service", "TypeScript · virtual-service", "frontend", "", new[] { Tsc, "-w", "--preserveWatchOutput", "--pretty", "false", "-p", "packages/labs/virtual-service/tsconfig.json" }, ParseTsc, "rollup-core"),
            NodeTask("rollup-virtual-service", "Rollup · virtual-service", "frontend", "packages/labs/virtual-service", new[] { Rollup, "-c", "rollup.config.mjs", "-w", "--bundleConfigAsCjs" }, ParseRollup, "ts-virtual-service")
        };

        if (install)
            Tasks.Insert(0, InstallTask());

        if (host == null)
            Tasks.Add(new SupervisorTask { Key = "server", Label = "Server", Group = "backend", Status = "ok", Detail = ServerUrl, Updated = Now(), Ready = true });

        Tests = new TestRunner(this);
    }

    public bool IsMain => Host == this;

    public IEnumerable<SupervisorTask> ViewTasks => IsMain ? Tasks : Tasks.Concat(Host.Tasks.Where(t => t.Group == "backend"));

    public IEnumerable<SupervisorTask> Watchers => Tasks.Where(t => t.Group == "frontend");

    public static DevSupervisor ForWorktree(DevSupervisor host, string root, string workspace)
    {
        return new DevSupervisor(root, host, workspace);
    }

    static string LockHash(string root)
    {
        var lockFile = Path.Combine(root, "package-lock.json");
        try
        {
            return File.Exists(lockFile) ? Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(lockFile))) : "";
        }
        catch (IOException)
        {
            return "";
        }
    }

    static void StampInstall(string root, string hash)
    {
        try
        {
            var stamp = Path.Combine(root, InstallStamp);
            Directory.CreateDirectory(Path.GetDirectoryName(stamp));
            File.WriteAllText(stamp, hash);
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
        }
    }

    /// <summary>
    /// Whether a worktree needs npm ci: when its package-lock.json differs from the one of its last successful install,
    /// so a checkout or rebase that only touches the lock file's timestamp does not reinstall everything.
    /// </summary>
    static bool NeedsInstall(string root)
    {
        var installed = Path.Combine(root, "node_modules/.package-lock.json");
        if (!File.Exists(installed))
            return true;

        var hash = LockHash(root);
        var stamp = Path.Combine(root, InstallStamp);
        if (File.Exists(stamp))
            return File.ReadAllText(stamp).Trim() != hash;

        // Installed before the stamp existed: trust the timestamps once, and stamp the install when they agree
        var at = File.GetLastWriteTimeUtc(installed);
        if (new[] { "package.json", "package-lock.json" }.Select(f => Path.Combine(root, f)).Any(f => File.Exists(f) && File.GetLastWriteTimeUtc(f) > at))
            return true;

        StampInstall(root, hash);
        return false;
    }

    SupervisorTask Install => Tasks.FirstOrDefault(t => t.Key == "install");

    public bool InstallRunning => !ShuttingDown && Install?.Process != null;

    public bool InstallWaiting => !ShuttingDown && Install is { Process: null, Status: "waiting" };

    public void StartInstall()
    {
        StartTask(Install);
    }

    public void WaitForInstall(string other)
    {
        var detail = $"after the npm ci of {other}";
        if (Install.Detail != detail)
            Set(Install, "waiting", detail);
    }

    /// <summary>
    /// The end of the npm ci output when this worktree's install failed, which no test run can do without; null otherwise.
    /// </summary>
    public List<string> InstallFailure()
    {
        if (Install?.Status != "error")
            return null;

        return LogAfter(0).Where(e => e.Task == "install").TakeLast(15).Select(e => e.Text).Prepend($"npm ci {Install.Detail}").ToList();
    }

    SupervisorTask InstallTask()
    {
        var npmCli = Path.Combine(Path.GetDirectoryName(Node) ?? "", "node_modules", "npm", "bin", "npm-cli.js");
        var task = File.Exists(npmCli)
            ? NodeTask("install", "npm ci", "frontend", "", new[] { npmCli, "ci", "--no-audit", "--no-fund" }, ParseInstall)
            : new SupervisorTask { Key = "install", Label = "npm ci", Group = "frontend", FileName = OperatingSystem.IsWindows() ? "npm.cmd" : "npm", Arguments = new[] { "ci", "--no-audit", "--no-fund" }, Parse = ParseInstall };

        task.Once = true;
        return task;
    }

    SupervisorTask NodeTask(string key, string label, string group, string cwd, string[] arguments, Action<SupervisorTask, string> parse, params string[] after)
    {
        var script = Path.Combine(Root, arguments[0]);
        return new SupervisorTask { Key = key, Label = label, Group = group, Cwd = cwd, FileName = Node, Arguments = arguments.Skip(1).Prepend(script).ToArray(), Parse = parse, After = after };
    }

    public static void Start(string root)
    {
        var supervisor = new DevSupervisor(root);
        SupervisorLoggerProvider.Flush(supervisor);
        Instance = supervisor;
        supervisor.StartAll();
        Worktrees.Start(supervisor);
    }

    static Timer parentWatch;

    /// <summary>
    /// Stops the backend when the npm run dev process that started it is gone, e.g. because its terminal was closed.
    /// </summary>
    public static void StopWithParent(Action stop)
    {
        if (!int.TryParse(Environment.GetEnvironmentVariable("VIDYANO_DEV_PARENT"), out var pid))
            return;

        parentWatch = new Timer(_ =>
        {
            try
            {
                using var parent = Process.GetProcessById(pid);
                if (!parent.HasExited)
                    return;
            }
            catch (ArgumentException)
            {
            }

            parentWatch?.Dispose();
            Console.WriteLine("npm run dev is gone; stopping the backend");
            stop();
        }, null, 2000, 2000);
    }

    public static void Stop()
    {
        Worktrees.StopAll();
        Instance?.StopAll();
    }

    public static bool IsLocalRequest(HttpContext context)
    {
        if (context.Connection.RemoteIpAddress == null || !IPAddress.IsLoopback(context.Connection.RemoteIpAddress) || context.Request.Host.Host is not ("localhost" or "127.0.0.1" or "[::1]"))
            return false;

        // The dev backend allows any CORS origin, so only the supervisor page itself may call the API.
        var origin = context.Request.Headers.Origin.ToString();
        return origin.Length == 0 || (Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.Host is "localhost" or "127.0.0.1" or "[::1]" && uri.Port == context.Request.Host.Port);
    }

    public static string Now()
    {
        return DateTime.Now.ToString("HH:mm:ss");
    }

    public static string Strip(string text)
    {
        return Ansi.Replace(text, "");
    }

    public SupervisorTask Find(string key)
    {
        return Tasks.FirstOrDefault(t => t.Key == key) ?? Host.Tasks.First(t => t.Key == key);
    }

    public long Version
    {
        get
        {
            lock (Gate)
                return version;
        }
    }

    public long Changed()
    {
        TaskCompletionSource previous;
        long current;
        lock (Gate)
        {
            current = ++version;
            previous = changed;
            changed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        }

        previous.TrySetResult();
        ThreadPool.QueueUserWorkItem(_ => Worktrees.NextRun());
        return current;
    }

    public async Task WaitForChange(long since, TimeSpan timeout)
    {
        Task signal;
        lock (Gate)
        {
            if (version > since)
                return;

            signal = changed.Task;
        }

        await Task.WhenAny(signal, Task.Delay(timeout));
    }

    public List<LogEntry> LogAfter(long id)
    {
        lock (Gate)
            return log.Where(e => e.Id > id).ToList();
    }

    public void ServerLog(string text, string level)
    {
        lock (Gate)
            AddLog(Find("server"), text, level);
    }

    public void ClearLog()
    {
        lock (Gate)
            log.Clear();

        Changed();
    }

    public string Relative(string file)
    {
        return (Path.IsPathRooted(file) ? Path.GetRelativePath(Root, file) : file).Replace('\\', '/');
    }

    string RelativeTo(SupervisorTask t, string file)
    {
        return Relative(Path.GetFullPath(Path.Combine(Root, t.Cwd, file)));
    }

    void Set(SupervisorTask t, string status, string detail = null)
    {
        detail ??= t.Detail;
        if (status != t.Status || detail != t.Detail)
            Console.WriteLine($"[{(IsMain ? "" : $"{Workspace}/")}{t.Key}] {status}{(detail.Length > 0 ? $" · {detail}" : "")}");

        var busy = status is "starting" or "building";
        if (busy && t.Since == null)
            t.Since = Environment.TickCount64;
        else if (!busy && t.Since != null)
        {
            t.Took = Environment.TickCount64 - t.Since;
            t.Since = null;
        }

        t.Status = status;
        t.Detail = detail;
        t.Updated = Now();
        Changed();
    }

    void AddLog(SupervisorTask t, string text, string level = "info")
    {
        log.Add(new LogEntry { Id = nextLogId++, Time = Now(), Task = t.Key, Text = text, Level = level });
        if (log.Count > 3000)
            log.RemoveRange(0, log.Count - 2000);

        Changed();
    }

    static Problem CompilerError(string line, Func<string, string> relative)
    {
        var match = CompilerErrorLine.Match(line);
        return match.Success ? new Problem { File = relative(match.Groups[1].Value), Line = int.Parse(match.Groups[2].Value), Column = int.Parse(match.Groups[3].Value), Message = match.Groups[5].Value, Code = match.Groups[4].Value } : null;
    }

    void ParseTsc(SupervisorTask t, string line)
    {
        if (Regex.IsMatch(line, "Starting compilation|Starting incremental compilation|File change detected"))
        {
            t.PendingErrors = new List<Problem>();
            Set(t, "building", "compiling");
            return;
        }

        var error = CompilerError(line, file => RelativeTo(t, file));
        if (error != null)
        {
            (t.PendingErrors ??= new List<Problem>()).Add(error);
            return;
        }

        var found = Regex.Match(line, @"Found (\d+) errors?");
        if (found.Success)
        {
            t.Problems = t.PendingErrors ?? new List<Problem>();
            t.PendingErrors = null;
            var count = t.Problems.Count;
            Set(t, count > 0 ? "error" : "ok", count > 0 ? $"{count} type {(count == 1 ? "error" : "errors")}" : "no type errors");
            MarkReady(t);
            return;
        }

        if (Regex.IsMatch(line, @"^\s+\S") && t.PendingErrors?.Count > 0)
            t.PendingErrors[^1].Message += $" {line.Trim()}";
    }

    void ParseSass(SupervisorTask t, string line)
    {
        var compiled = Regex.Match(line, "Compiled (.+?) to ");
        if (compiled.Success)
        {
            var file = RelativeTo(t, compiled.Groups[1].Value);
            t.Problems = t.Problems.Where(p => p.File != file && !Path.GetFileName(p.File).StartsWith("_")).ToList();
            t.Detail = $"compiled {Path.GetFileName(file)}";
        }

        var error = Regex.Match(line, "^Error: (.*)");
        if (error.Success)
            t.PendingMessage = error.Groups[1].Value;

        var location = t.PendingMessage != null ? Regex.Match(line, @"^\s+(.+\.s[ac]ss) (\d+):(\d+)") : Match.Empty;
        if (location.Success)
        {
            var file = RelativeTo(t, location.Groups[1].Value);
            t.Problems = t.Problems.Where(p => p.File != file).Append(new Problem { File = file, Line = int.Parse(location.Groups[2].Value), Column = int.Parse(location.Groups[3].Value), Message = t.PendingMessage }).ToList();
            t.PendingMessage = null;
        }

        if (line.Contains("Sass is watching"))
        {
            t.Detail = "watching for changes";
            MarkReady(t);
        }

        Set(t, t.Problems.Count > 0 ? "error" : t.Ready ? "ok" : "building");
    }

    void ParseRollup(SupervisorTask t, string line)
    {
        var bundles = Regex.Match(line, @"^bundles .+ → (.+?)\.\.\.$");
        if (bundles.Success)
        {
            t.Bundle = Path.GetFileName(bundles.Groups[1].Value.Split(',')[0].Trim());
            t.Problems = t.Problems.Where(p => p.Bundle != t.Bundle).ToList();
            Set(t, "building", $"bundling {t.Bundle}");
            return;
        }

        var created = Regex.Match(line, "^created (.+) in (.+)$");
        if (created.Success)
        {
            Set(t, t.Problems.Count > 0 ? "error" : "ok", $"created {Path.GetFileName(created.Groups[1].Value.Split(',')[0].Trim())}");
            return;
        }

        if (line.Contains("waiting for changes"))
        {
            MarkReady(t);
            return;
        }

        if (line.StartsWith("[!] "))
        {
            t.Problems.Add(new Problem { Bundle = t.Bundle, Message = line[4..] });
            t.Collecting = true;
            Set(t, "error", "bundle failed");
            return;
        }

        if (!t.Collecting)
            return;

        t.Collecting = false;
        var location = Regex.Match(line.Trim(), @"^(.+?)(?: \((\d+):(\d+)\))?$");
        if (line.Trim().Length > 0 && !Regex.IsMatch(line, @"^\s|^Error") && location.Success)
        {
            var problem = t.Problems[^1];
            problem.File = RelativeTo(t, location.Groups[1].Value);
            problem.Line = location.Groups[2].Success ? int.Parse(location.Groups[2].Value) : null;
            problem.Column = location.Groups[3].Success ? int.Parse(location.Groups[3].Value) : null;
        }
    }

    void ParseInstall(SupervisorTask t, string line)
    {
        if (t.Status == "starting")
            Set(t, "building", "installing packages");
    }

    static string LevelOf(string line)
    {
        if (Regex.IsMatch(line, @"\berror\b|\[!\]|^fail:|Unhandled exception", RegexOptions.IgnoreCase) || Regex.IsMatch(line, @"\bERR\b"))
            return "error";

        return Regex.IsMatch(line, @"\bwarn(ing)?\b|^\(!\)", RegexOptions.IgnoreCase) || Regex.IsMatch(line, @"\bWRN\b") ? "warn" : "info";
    }

    void MarkReady(SupervisorTask t)
    {
        if (!t.Ready)
            ThreadPool.QueueUserWorkItem(_ => Tests.RetryFailed());

        t.Ready = true;
        foreach (var waiting in Tasks.Where(w => w.After.Contains(t.Key) && w.Process == null && w.Status == "waiting").ToList())
        {
            if (waiting.After.All(key => Find(key).Ready))
                StartTask(waiting);
        }
    }

    public ProcessStartInfo StartInfo(string fileName, IEnumerable<string> arguments, string cwd = "")
    {
        var info = new ProcessStartInfo(fileName) { WorkingDirectory = Path.Combine(Root, cwd), RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8, UseShellExecute = false, CreateNoWindow = true };
        foreach (var argument in arguments)
            info.ArgumentList.Add(argument);

        info.Environment["FORCE_COLOR"] = "1";
        info.Environment.Remove("NO_COLOR");
        return info;
    }

    void StartTask(SupervisorTask t)
    {
        t.Problems = new List<Problem>();
        t.Url = null;
        t.PendingErrors = null;
        t.PendingMessage = null;
        Set(t, "starting", "");

        var process = new Process { StartInfo = StartInfo(t.FileName, t.Arguments, t.Cwd), EnableRaisingEvents = true };
        process.OutputDataReceived += (_, e) => OnLine(t, e.Data);
        process.ErrorDataReceived += (_, e) => OnLine(t, e.Data);
        process.Exited += (_, _) => OnExit(t, process);

        try
        {
            process.Start();
        }
        catch (Exception e)
        {
            AddLog(t, e.Message, "error");
            RecoverLater(t, e.Message);
            return;
        }

        ProcessJob.Add(process);
        t.Process = process;
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
    }

    void OnLine(SupervisorTask t, string output)
    {
        if (output == null)
            return;

        var raw = output.TrimEnd();
        var line = Strip(raw);
        if (line.Trim().Length == 0)
            return;

        lock (Gate)
        {
            var stripped = Timestamp.Replace(line, "");
            AddLog(t, stripped.Length == line.Length ? raw : stripped, LevelOf(line));
            t.Parse(t, line);
        }
    }

    void OnExit(SupervisorTask t, Process process)
    {
        process.WaitForExit();
        lock (Gate)
        {
            if (t.Process != process)
                return;

            t.Process = null;
            if (!t.Once)
                RecoverLater(t, $"exited with code {process.ExitCode}");
            else if (process.ExitCode == 0)
            {
                if (t.Key == "install")
                    StampInstall(Root, installHash);

                Set(t, "ok", "packages installed");
                MarkReady(t);
            }
            else
                Set(t, "error", $"failed with code {process.ExitCode}");
        }

        if (t.Key == "install")
            ThreadPool.QueueUserWorkItem(_ => Worktrees.NextInstall());
    }

    void RecoverLater(SupervisorTask t, string reason)
    {
        t.Recovery?.Dispose();
        if (ShuttingDown)
        {
            Set(t, "stopped", "");
            return;
        }

        var remaining = RecoverySeconds;
        Set(t, "stopped", $"{reason} · restarting in {remaining}s");
        t.Recovery = new Timer(_ =>
        {
            lock (Gate)
            {
                if (--remaining > 0)
                {
                    Set(t, "stopped", $"{reason} · restarting in {remaining}s");
                    return;
                }

                t.Recovery?.Dispose();
                t.Recovery = null;
                if (ShuttingDown || t.Process != null)
                    return;

                AddLog(t, "Restarting", "warn");
                StartTask(t);
            }
        }, null, 1000, 1000);
    }

    public static (int ExitCode, string Output) Capture(string fileName, params string[] arguments)
    {
        try
        {
            var info = new ProcessStartInfo(fileName) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8 };
            foreach (var argument in arguments)
                info.ArgumentList.Add(argument);

            using var process = Process.Start(info);
            var error = process.StandardError.ReadToEndAsync();
            var output = process.StandardOutput.ReadToEnd();
            error.Wait();
            return (process.WaitForExit(60000) ? process.ExitCode : -1, output);
        }
        catch (Exception)
        {
            return (-1, "");
        }
    }

    public void StartAll()
    {
        lock (Gate)
        {
            if (ShuttingDown)
                return;

            // npm ci runs for one worktree at a time (see Worktrees.NextInstall)
            foreach (var t in Tasks.Where(t => t.Group == "frontend" && t.After.Length == 0 && t.Key != "install"))
                StartTask(t);
        }

        if (Install != null)
            Worktrees.NextInstall();

        Tests.Start();
        Console.WriteLine(IsMain ? $"Supervisor: {ServerUrl}/supervisor/" : $"Workspace {Workspace}: {ServerUrl}/{Workspace}/");
    }

    public void StopAll()
    {
        List<Process> processes;
        lock (Gate)
        {
            ShuttingDown = true;
            Tests.CancelAll();
            foreach (var t in Tasks)
                t.Recovery?.Dispose();

            processes = Tasks.Select(t => t.Process).Where(p => p != null).ToList();
        }

        Tests.Stop();
        Changed();
        foreach (var process in processes)
        {
            try
            {
                process.Kill(true);
                process.WaitForExit(5000);
            }
            catch (Exception)
            {
            }
        }
    }

    public void OpenInEditor(string file, int? line, int? column)
    {
        var full = Path.GetFullPath(Path.Combine(Root, file));
        if (!full.StartsWith(Path.GetFullPath(Root), StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
            return;

        var target = $"{full}{(line != null ? $":{line}:{column ?? 1}" : "")}";
        var info = OperatingSystem.IsWindows() ? new ProcessStartInfo("cmd.exe") { UseShellExecute = false, CreateNoWindow = true } : new ProcessStartInfo("code") { UseShellExecute = false };
        if (OperatingSystem.IsWindows())
        {
            info.ArgumentList.Add("/c");
            info.ArgumentList.Add("code");
        }

        info.ArgumentList.Add("-g");
        info.ArgumentList.Add(target);
        Process.Start(info);
    }
}
