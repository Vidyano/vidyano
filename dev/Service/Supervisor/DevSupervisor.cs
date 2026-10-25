#nullable disable

using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
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

public sealed record BundleSpec(string Bundle, string Bundler, string[] Builders, string[] Sources);

public sealed record StaleSource(BundleSpec Spec, string Source, DateTime Changed);

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
    public Dictionary<string, string> Variables = new();
    public Action<SupervisorTask, string> Parse;
    public long? Since;
    public List<Problem> PendingErrors;
    public string PendingMessage;
    public Process Process;
    public bool Once;
    public string Bundle;
    public bool Collecting;
    public DateTime BundlingSince;
    // When rollup started the last build that wrote each bundle: it read its inputs then, so a change after that is not in
    public Dictionary<string, DateTime> BuiltFrom = new();
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
    // Set on a worktree's own backend (see BackendTask): the worktree it serves, and its folder
    public const string WorktreeVariable = "VIDYANO_DEV_WORKTREE";
    public const string WorktreeRootVariable = "VIDYANO_DEV_WORKTREE_ROOT";
    const int RecoverySeconds = 10;
    const string Tsc = "node_modules/typescript/bin/tsc";
    const string Rollup = "node_modules/rollup/dist/bin/rollup";
    const string Sass = "node_modules/sass/sass.js";
    const string VidyanoSources = "packages/vidyano/src";
    // The SHA-256 of the package-lock.json of a worktree's last successful npm ci
    const string InstallStamp = "node_modules/.cache/vidyano-dev/lock.sha";
    // How long after a source change a run waits for a rebuild that never comes, e.g. for a file no bundle imports
    public static readonly TimeSpan RebuildGrace = TimeSpan.FromSeconds(10);

    // The bundles the tests load, each with the watchers that build it and its sources. Core tests load the core
    // bundle, the virtual-service tests its compiled src (rollup bundles it right after) and the vidyano tests the
    // dev bundle, which includes the core bundle.
    static readonly BundleSpec[] Bundles =
    {
        new("packages/core/dist/index.js", "rollup-core", new[] { "ts-core", "rollup-core" }, new[] { "packages/core/src" }),
        new("packages/labs/virtual-service/dist/index.js", "rollup-virtual-service", new[] { "ts-virtual-service", "rollup-virtual-service" }, new[] { "packages/labs/virtual-service/src" }),
        new("dev/wwwroot/index.js", "rollup-vidyano", new[] { "ts-vidyano", "sass", "rollup-vidyano" }, new[] { "packages/core/dist/index.js", VidyanoSources, "packages/vidyano/tests/index.ts", "packages/vidyano/tests/index.js", "packages/vidyano/tests/web-component", "packages/vidyano/tests/dialog" })
    };

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
    /// <summary>The backend this checkout's test runs use: the main one for the main checkout, its own for a worktree.</summary>
    public string BackendUrl { get; private set; }
    public readonly List<SupervisorTask> Tasks;
    public readonly TestRunner Tests;
    public bool ShuttingDown { get; private set; }

    readonly List<LogEntry> log = new();
    readonly string installHash;
    long version;
    long nextLogId = 1;
    TaskCompletionSource changed = new(TaskCreationOptions.RunContinuationsAsynchronously);
    Timer recheckRuns;
    readonly HashSet<StaleSource> acceptedChanges = new();

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
        {
            BackendUrl = ServerUrl;
            Tasks.Add(new SupervisorTask { Key = "server", Label = "Server", Group = "backend", Status = "ok", Detail = ServerUrl, Updated = Now(), Ready = true });
        }
        else
            Tasks.Add(BackendTask());

        Tests = new TestRunner(this);
    }

    public bool IsMain => Host == this;

    public IEnumerable<SupervisorTask> ViewTasks => Tasks;

    static int FreePort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        return port;
    }

    /// <summary>
    /// A worktree's own backend: the main checkout's build of dev/ on a port of its own, so the data its test runs use is
    /// never changed by another checkout's runs. It starts with the first run that uses it (see BackendReady), on a port
    /// picked at every start, since one picked earlier may be taken by then.
    /// </summary>
    SupervisorTask BackendTask()
    {
        var executable = Environment.ProcessPath;
        // Started as dotnet Dev.dll, the process is dotnet itself
        var arguments = Path.GetFileNameWithoutExtension(executable) == "dotnet" ? new[] { typeof(DevSupervisor).Assembly.Location } : Array.Empty<string>();
        var task = new SupervisorTask { Key = "server", Label = "Server", Group = "backend", Detail = "starts with the first test run that uses it", Updated = Now(), FileName = executable, Arguments = arguments, Cwd = Path.Combine(Host.Root, "dev"), Parse = ParseServer };
        task.Variables["ASPNETCORE_ENVIRONMENT"] = "Development";
        task.Variables[WorktreeVariable] = Workspace;
        task.Variables[WorktreeRootVariable] = Root;
        return task;
    }

    /// <summary>
    /// Whether this worktree's own backend answers, starting it when it does not run. Worktrees.NextRun calls this under the Gate.
    /// </summary>
    public bool BackendReady()
    {
        var backend = Find("server");
        if (backend.Process == null && backend.Recovery == null && !ShuttingDown)
            StartTask(backend);

        return backend.Process != null && backend.Status == "ok";
    }

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
        // Every child process ties up two pool threads, which block reading its redirected stdout and stderr. With the
        // watchers of several worktrees and their test runs that is well over a hundred, and a pool that only adds threads
        // slowly then leaves requests (a test run's output poll among them) waiting long enough to count as abandoned.
        ThreadPool.GetMinThreads(out var workerThreads, out var completionThreads);
        ThreadPool.SetMinThreads(Math.Max(workerThreads, 512), completionThreads);

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
        Worktrees.NextRunSoon();
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

    /// <summary>
    /// The changed sources the bundles the tests load miss. A watcher only reports building once it notices a change, so
    /// right after a save all watchers still look done. A change accepted for a run (see AcceptStale) no longer counts, so
    /// a file no bundle imports doesn't keep every run waiting.
    /// </summary>
    public List<StaleSource> FindStaleSources()
    {
        return Bundles.SelectMany(Scan).Where(stale => !acceptedChanges.Contains(stale)).ToList();
    }

    public void AcceptStale(StaleSource stale)
    {
        acceptedChanges.Add(stale);
    }

    List<StaleSource> Scan(BundleSpec spec)
    {
        try
        {
            // Without a build seen since the supervisor started, the bundle's own time is the best guess
            var built = Find(spec.Bundler) is { } bundler && bundler.BuiltFrom.TryGetValue(spec.Bundle, out var from) ? from : File.GetLastWriteTimeUtc(Path.Combine(Root, spec.Bundle));
            var files = spec.Sources.SelectMany(SourceFiles).Select(file => (File: file, Changed: File.GetLastWriteTimeUtc(file))).ToList();
            var styles = files.Where(f => f.File.EndsWith(".scss")).ToDictionary(f => f.File, f => File.ReadAllText(f.File));
            return files.Where(f => f.Changed > built || f.Changed > CompiledAt(f.File, styles, 0)).Select(f => new StaleSource(spec, Relative(f.File), f.Changed)).ToList();
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            // A checkout or clean in progress; the run waits for the watchers that follow it instead
            return new List<StaleSource>();
        }
    }

    IEnumerable<string> SourceFiles(string source)
    {
        var path = Path.Combine(Root, source);
        if (File.Exists(path))
            return new[] { path };

        return Directory.Exists(path) ? Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories).Where(IsSource) : Array.Empty<string>();
    }

    static bool IsSource(string file)
    {
        return Regex.IsMatch(file, @"\.(ts|js|scss|css|html)$") && !Regex.IsMatch(file, @"\.(d|spec)\.ts$");
    }

    /// <summary>
    /// When tsc wrote a .ts file's .js, or sass a .scss file's .css, next to it. A bundle newer than the source doesn't prove
    /// the change is in: rollup can finish a build it started before the save, while tsc or sass have yet to notice it.
    /// </summary>
    static DateTime CompiledAt(string file, Dictionary<string, string> styles, int depth)
    {
        if (file.EndsWith(".ts"))
            return File.GetLastWriteTimeUtc(Path.ChangeExtension(file, ".js"));

        if (!file.EndsWith(".scss"))
            return DateTime.MaxValue;

        // sass also compiles the stylesheets that use this one again, so its change is in once theirs is too; a partial has
        // no .css of its own
        var name = Path.GetFileNameWithoutExtension(file);
        var own = name.StartsWith('_') ? DateTime.MaxValue : File.GetLastWriteTimeUtc(Path.ChangeExtension(file, ".css"));
        if (depth > 5)
            return own;

        var used = new Regex($@"@(use|import)\s+[""'](?:[^""']*/)?_?{Regex.Escape(name.TrimStart('_'))}(\.scss)?[""']");
        return styles.Where(s => s.Key != file && used.IsMatch(s.Value)).Select(s => CompiledAt(s.Key, styles, depth + 1)).Append(own).Min();
    }

    /// <summary>
    /// Has NextRun look at the queued runs again after the delay, for a run that waits on time rather than on a change.
    /// </summary>
    public void RecheckRunsAfter(TimeSpan delay)
    {
        recheckRuns?.Dispose();
        recheckRuns = new Timer(_ => Worktrees.NextRun(), null, TimeSpan.FromTicks(Math.Clamp(delay.Ticks, 0, RebuildGrace.Ticks)), Timeout.InfiniteTimeSpan);
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
            t.BundlingSince = DateTime.UtcNow;
            Set(t, "building", $"bundling {t.Bundle}");
            return;
        }

        var created = Regex.Match(line, "^created (.+) in (.+)$");
        if (created.Success)
        {
            foreach (var output in created.Groups[1].Value.Split(','))
                t.BuiltFrom[RelativeTo(t, output.Trim())] = t.BundlingSince;

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

    void ParseServer(SupervisorTask t, string line)
    {
        if (!line.Contains("Now listening on:"))
            return;

        Set(t, "ok", BackendUrl);
        MarkReady(t);
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

        if (t.Key == "server" && !IsMain)
            t.Variables["ASPNETCORE_URLS"] = BackendUrl = $"http://localhost:{FreePort()}";

        var info = StartInfo(t.FileName, t.Arguments, t.Cwd);
        foreach (var (name, value) in t.Variables)
            info.Environment[name] = value;

        var process = new Process { StartInfo = info, EnableRaisingEvents = true };
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

    public static void OpenInEditor(string root, string file, int? line, int? column)
    {
        var full = Path.GetFullPath(Path.Combine(root, file));
        if (!full.StartsWith(Path.GetFullPath(root), StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
            return;

        Code("-g", $"{full}{(line != null ? $":{line}:{column ?? 1}" : "")}");
    }

    /// <summary>
    /// Opens the file's changes since its last commit in a VS Code diff; a new file is compared with an empty one, and so
    /// is a deleted one.
    /// </summary>
    public static void OpenDiff(string root, string file)
    {
        var full = Path.GetFullPath(Path.Combine(root, file));
        if (!full.StartsWith(Path.GetFullPath(root), StringComparison.OrdinalIgnoreCase))
            return;

        var relative = Path.GetRelativePath(root, full).Replace('\\', '/');
        var (exitCode, committed) = Capture("git", "-C", root, "show", $"HEAD:{relative}");
        // One folder per checkout and file, so two diffs of files with the same name keep their own HEAD
        var folder = Path.Combine(Path.GetTempPath(), "vidyano-dev-diff", Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(full)))[..12]);
        var name = Path.GetFileName(full);
        var before = Path.Combine(folder, "HEAD", name);
        Directory.CreateDirectory(Path.GetDirectoryName(before));
        File.WriteAllText(before, exitCode == 0 ? committed : "");

        var after = full;
        if (!File.Exists(full))
        {
            after = Path.Combine(folder, "deleted", name);
            Directory.CreateDirectory(Path.GetDirectoryName(after));
            File.WriteAllText(after, "");
        }

        Code("--diff", before, after);
    }

    static void Code(params string[] arguments)
    {
        var info = OperatingSystem.IsWindows() ? new ProcessStartInfo("cmd.exe") { UseShellExecute = false, CreateNoWindow = true } : new ProcessStartInfo("code") { UseShellExecute = false };
        if (OperatingSystem.IsWindows())
        {
            info.ArgumentList.Add("/c");
            info.ArgumentList.Add("code");
        }

        foreach (var argument in arguments)
            info.ArgumentList.Add(argument);

        Process.Start(info);
    }
}
