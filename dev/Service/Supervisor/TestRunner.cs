#nullable disable

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Dev.Service.Supervisor
{
    public sealed class RunFile
    {
        public string File;
        public string Status = "pending";
        public long? Took;
        public long? Started;
    }

    public sealed class RunTest
    {
        public int RunId;
        public string Id;
        public string Title;
        public string File;
        public int Line;
        public int Column;
        public string Spec;
        public string Status = "pending";
        public double? Duration;
        public long? Ended;
        public JArray Errors = new();
        public long Version;
    }

    public sealed class OutputLine
    {
        public long Id;
        public string Text;
    }

    public sealed class TestRun
    {
        public int Id;
        public List<string> Flags;
        public List<string> Targets;
        public List<RunFile> Files;
        public string Status = "queued";
        public string QueuedAt;
        public long QueuedMs;
        public long? Started;
        public long? Took;
        public string WaitingFor;
        // The last thing the run waited for, kept after it started (the Live view shows the wait)
        public string WaitedFor;
        public long Sequence;
        public string Access;
        /// <summary>The Playwright workers the run starts, at most TestRunner.MaxWorkers; they take turns on the TestSlots.</summary>
        public int Workers;
        public bool Followed;
        public List<string> Args;
        public string Key;
        public long LastPolled;
        public bool Cancelled;
        public int? ExitCode;
        public List<JObject> Errors = new();
        public List<RunTest> Tests = new();
        /// <summary>The number of tests Playwright runs after its project and grep filtering; null until it begins.</summary>
        public int? Total;
        public List<OutputLine> Output = new();
        public long OutputCount;
        public Process Process;
        public long Version;

        public bool Done => Status is not ("queued" or "running");

        public bool Running => Status == "running";
    }

    public sealed class CatalogTest
    {
        public string Id;
        public string Title;
        public string File;
        public int Line;
        public int Column;
    }

    public sealed class CatalogEntry
    {
        public string Status;
        public List<CatalogTest> Tests = new();
        public long? Ticks;
        public long Version;
    }

    public sealed class TestRunner
    {
        public const string Marker = "␞";
        const string PlaywrightCli = "node_modules/playwright/cli.js";
        const int KeptRuns = 30;
        public static readonly (string Name, string Path)[] SpecRoots = { ("core", "packages/core/tests"), ("vidyano", "packages/vidyano/tests"), ("virtual-service", "packages/labs/virtual-service/tests") };
        static readonly HashSet<string> ValueFlags = new() { "-g", "--grep", "--grep-invert", "--project", "-j", "--workers", "--retries", "--timeout", "--repeat-each", "--max-failures", "--shard", "-c", "--config", "--output", "--trace" };

        /// <summary>A run that uses no shared state: its specs start their own backends or need none.</summary>
        public const string Free = "free";
        /// <summary>A run that uses the dev backend and its data: a worktree's run uses the worktree's own backend.</summary>
        public const string Shared = "shared";
        /// <summary>A perf run, which runs alone on the machine.</summary>
        public const string Machine = "machine";
        /// <summary>The Playwright project that runs the tests tagged TimingTag, on one worker (see playwright.config.js).</summary>
        public const string TimingProject = "vidyano-perf";
        /// <summary>The tag of the perf tests that measure wall-clock or frame timings.</summary>
        public const string TimingTag = "@timing";
        // The worker budget set in the supervisor, so it outlives a backend restart
        const string WorkersFile = "node_modules/.cache/vidyano-dev/workers";
        static int maxWorkers;
        // The workers each project runs on, as in playwright.config.js
        static readonly Dictionary<string, int> ProjectWorkers = new() { ["core"] = 1, ["vidyano"] = 4, ["virtual-service"] = 4 };

        // The spec folders whose specs never use the dev backend's data; everything else is shared
        static readonly string[] FreeRoots = { "packages/vidyano/tests", "packages/labs/virtual-service/tests" };
        static readonly string[] SharedRoots = { "packages/vidyano/tests/query-grid" };
        static readonly StringComparison PathComparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        static long sequence;

        readonly DevSupervisor supervisor;
        readonly SemaphoreSlim listing = new(1, 1);
        readonly Dictionary<string, Timer> pendingSpecs = new();
        readonly string catalogCache;
        readonly List<FileSystemWatcher> specWatchers = new();
        int nextId = 1;

        public readonly List<TestRun> Runs = new();
        public readonly Dictionary<string, CatalogEntry> Catalog = new();
        public List<string> SpecFiles = new();
        public long SpecFilesVersion;

        public TestRunner(DevSupervisor supervisor)
        {
            this.supervisor = supervisor;
            catalogCache = Path.Combine(supervisor.Root, "node_modules/.cache/vidyano-dev/test-catalog.json");
        }

        object Gate => supervisor.Gate;

        long Touch()
        {
            return supervisor.Changed();
        }

        static (List<string> flags, List<string> paths) ParseArgs(IReadOnlyList<string> args)
        {
            var flags = new List<string>();
            var paths = new List<string>();
            for (var i = 0; i < args.Count; i++)
            {
                if (args[i] == "--reporter")
                    i++;
                else if (args[i].StartsWith("--reporter="))
                    continue;
                else if (!args[i].StartsWith("-"))
                    paths.Add(args[i].Replace('\\', '/'));
                else if (ValueFlags.Contains(args[i]) && i + 1 < args.Count)
                {
                    flags.Add(args[i]);
                    flags.Add(args[++i]);
                }
                else
                    flags.Add(args[i]);
            }

            return (flags, paths);
        }

        List<string> Expand(IEnumerable<string> paths)
        {
            var targets = paths.Any() ? paths : SpecRoots.Select(r => r.Path);
            return targets.SelectMany(p =>
            {
                var full = Path.Combine(supervisor.Root, Regex.Replace(p, @":\d+$", ""));
                if (!Directory.Exists(full))
                    return new[] { p };

                return Directory.EnumerateFiles(full, "*.spec.ts", SearchOption.AllDirectories)
                    .Select(supervisor.Relative)
                    .Where(f => !f.Contains("/node_modules/"))
                    .OrderBy(f => f, StringComparer.Ordinal)
                    .ToArray();
            }).Distinct().ToList();
        }

        static string SpecOf(string target)
        {
            return Regex.Replace(target, @":\d+$", "");
        }

        static bool IsUnder(string file, string folder)
        {
            return file.StartsWith(folder + "/", PathComparison);
        }

        static List<string> ProjectsOf(IReadOnlyList<string> flags)
        {
            var projects = new List<string>();
            for (var i = 0; i < flags.Count; i++)
            {
                if (flags[i] == "--project" && i + 1 < flags.Count)
                    projects.Add(flags[++i]);
                else if (flags[i].StartsWith("--project="))
                    projects.Add(flags[i]["--project=".Length..]);
            }

            return projects.SelectMany(p => p.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)).ToList();
        }

        public static bool IsPerf(string target)
        {
            var spec = SpecOf(target);
            return spec.StartsWith("perf/", PathComparison) || spec.Contains("/perf/", PathComparison);
        }

        static bool Matches(string projectFilter, string project)
        {
            return Regex.IsMatch(project, $"^{Regex.Escape(projectFilter).Replace(@"\*", ".*")}$", RegexOptions.IgnoreCase);
        }

        /// <summary>
        /// A perf run, one that runs the timing tests: it names the timing project.
        /// </summary>
        public static bool IsPerfRun(IReadOnlyList<string> flags)
        {
            return ProjectsOf(flags).Any(p => Matches(p, TimingProject));
        }

        /// <summary>
        /// The flags a run passes to Playwright: its own, plus what keeps the timing tests away from other tests. A run
        /// without --project would run the timing project next to the others, so it leaves the timing tests out. A perf
        /// run runs every project it would run anyway, timing and other tests alike, but on one worker (its own worker
        /// count is dropped), so a timing test never shares the machine.
        /// </summary>
        static List<string> PlaywrightFlags(IReadOnlyList<string> flags)
        {
            if (IsPerfRun(flags))
            {
                var perf = new List<string>();
                for (var i = 0; i < flags.Count; i++)
                {
                    if (flags[i] is "-j" or "--workers")
                        i++;
                    else if (!flags[i].StartsWith("--workers="))
                        perf.Add(flags[i]);
                }

                perf.Add("--workers");
                perf.Add("1");
                return perf;
            }

            if (ProjectsOf(flags).Count > 0)
                return flags.ToList();

            // Playwright keeps only the last --grep-invert, so the run's own one joins the tag
            var result = new List<string>();
            string invert = null;
            for (var i = 0; i < flags.Count; i++)
            {
                if (flags[i] == "--grep-invert" && i + 1 < flags.Count)
                    invert = flags[++i];
                else if (flags[i].StartsWith("--grep-invert="))
                    invert = flags[i]["--grep-invert=".Length..];
                else
                    result.Add(flags[i]);
            }

            result.Add("--grep-invert");
            result.Add(invert == null ? TimingTag : $"(?:{invert})|{TimingTag}");
            return result;
        }

        /// <summary>
        /// The tests the runs of all checkouts may run at once (see TestSlots): the number set in the supervisor, else
        /// VIDYANO_DEV_WORKERS, else 12.
        /// </summary>
        public static int MaxWorkers
        {
            get
            {
                if (maxWorkers == 0)
                {
                    var saved = Path.Combine(DevSupervisor.Instance?.Root ?? "", WorkersFile);
                    maxWorkers = File.Exists(saved) && int.TryParse(File.ReadAllText(saved).Trim(), out var set) && set > 0 ? set
                        : int.TryParse(Environment.GetEnvironmentVariable("VIDYANO_DEV_WORKERS"), out var variable) && variable > 0 ? variable : 12;
                }

                return maxWorkers;
            }
        }

        public static void SetMaxWorkers(int workers)
        {
            maxWorkers = Math.Clamp(workers, 1, 64);
            try
            {
                var saved = Path.Combine(DevSupervisor.Instance.Root, WorkersFile);
                Directory.CreateDirectory(Path.GetDirectoryName(saved));
                File.WriteAllText(saved, maxWorkers.ToString());
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException)
            {
            }
        }

        static string WorkersValue(IReadOnlyList<string> flags, int i)
        {
            if (flags[i] is "-j" or "--workers")
                return i + 1 < flags.Count ? flags[i + 1] : null;

            if (flags[i].StartsWith("--workers="))
                return flags[i]["--workers=".Length..];

            return flags[i].StartsWith("-j") && flags[i].Length > 2 && flags[i][2] != '-' ? flags[i][2..] : null;
        }

        /// <summary>
        /// The workers a run asks for: its own -j or --workers, or else those of the projects that run its specs together.
        /// Playwright runs the projects of one run side by side. Worktrees.NextRun starts at most MaxWorkers.
        /// </summary>
        static int WorkersOf(IReadOnlyList<string> flags, IReadOnlyList<string> targets)
        {
            for (var i = flags.Count - 1; i >= 0; i--)
            {
                var value = WorkersValue(flags, i);
                if (value != null && value.EndsWith('%') && int.TryParse(value[..^1], out var percent) && percent > 0)
                    return Math.Max(1, Environment.ProcessorCount * percent / 100);

                if (int.TryParse(value, out var own) && own > 0)
                    return own;
            }

            var projects = ProjectsOf(flags);
            var specs = targets.Select(SpecOf).ToList();
            var workers = SpecRoots.Where(r => (projects.Count == 0 || projects.Contains(r.Name)) && specs.Any(s => IsUnder(s, r.Path))).Sum(r => ProjectWorkers[r.Name]);
            return workers > 0 ? workers : ProjectWorkers["vidyano"];
        }

        /// <summary>The flags without their worker count, which RunAll passes as the workers the run got.</summary>
        static List<string> WithoutWorkers(IReadOnlyList<string> flags)
        {
            var result = new List<string>();
            for (var i = 0; i < flags.Count; i++)
            {
                if (flags[i] is "-j" or "--workers")
                    i++;
                else if (WorkersValue(flags, i) == null)
                    result.Add(flags[i]);
            }

            return result;
        }

        /// <summary>
        /// What a run shares with other runs, by the Playwright projects it names and the specs it holds: Free when every
        /// spec it can run lies in a folder that never uses the dev backend's data (the vidyano component specs outside
        /// query-grid, and virtual-service), Shared otherwise, including anything this cannot tell (another config, an
        /// unknown project, a filter that is no spec path).
        /// </summary>
        public static string AccessOf(IReadOnlyList<string> flags, IReadOnlyList<string> targets)
        {
            if (IsPerfRun(flags))
                return Machine;

            // No spec paths (e.g. an empty folder) leaves Playwright to run its whole config
            if (targets.Count == 0)
                return Shared;

            if (flags.Any(f => f is "-c" or "--config" || f.StartsWith("--config=")))
                return Shared;

            var projects = ProjectsOf(flags);
            var names = projects.Count > 0 ? projects : SpecRoots.Select(r => r.Name).ToList();
            var roots = new List<string>();
            foreach (var name in names)
            {
                var root = SpecRoots.FirstOrDefault(r => r.Name == name).Path;
                if (root == null)
                    return Shared;

                roots.Add(root);
            }

            var specs = targets.Select(SpecOf).ToList();
            if (specs.Any(s => !SpecRoots.Any(r => IsUnder(s, r.Path))))
                return Shared;

            var free = specs.Where(s => roots.Any(r => IsUnder(s, r))).All(s => FreeRoots.Any(r => IsUnder(s, r)) && !SharedRoots.Any(r => IsUnder(s, r)));
            return free ? Free : Shared;
        }

        /// <summary>
        /// Whether runs of two different checkouts cannot run at the same time: when either is a perf run. Runs that use the
        /// dev backend's data each use their own checkout's backend (see UsesOwnBackend). Runs of one checkout never run at
        /// the same time, since they share its test-results/ folder.
        /// </summary>
        public static bool Conflicts(string a, string b)
        {
            return a == Machine || b == Machine;
        }

        /// <summary>
        /// Whether a run uses its worktree's own backend (see DevSupervisor.BackendTask), so no run of another checkout
        /// changes the data under it. A Free run uses the main backend, which only serves it the worktree's build.
        /// </summary>
        public bool UsesOwnBackend(TestRun run)
        {
            return !supervisor.IsMain && run.Access != Free;
        }

        /// <summary>The run's name in TestSlots, unique across backend restarts and checkouts.</summary>
        string SlotsKey(TestRun run)
        {
            return $"{supervisor.InstanceId}:{run.Id}";
        }

        ProcessStartInfo PlaywrightStartInfo(IEnumerable<string> arguments, string backend, TestRun run = null)
        {
            var info = supervisor.StartInfo(supervisor.Node, new[] { PlaywrightCli, "test" }.Concat(arguments));
            info.Environment["FORCE_COLOR"] = "0";
            info.Environment["VIDYANO_DEV_EVENTS"] = "1";
            // The backend, and where it serves this checkout's build (/<worktree>/ for a worktree)
            info.Environment["VIDYANO_BACKEND_URL"] = backend;
            info.Environment["VIDYANO_DEV_URL"] = supervisor.IsMain ? backend : $"{backend}/{supervisor.Workspace}";
            var options = $"{Environment.GetEnvironmentVariable("NODE_OPTIONS")} --disable-warning=DEP0205";
            if (run != null)
            {
                // Every test waits for one of the TestSlots; the main checkout's preload serves the worktrees' runs too
                info.Environment["VIDYANO_DEV_RUN"] = SlotsKey(run);
                info.Environment["VIDYANO_DEV_SLOTS"] = $"{DevSupervisor.ServerUrl}/api/supervisor";
                // NODE_OPTIONS reads a backslash in quotes as an escape
                options += $" --require \"{Path.Combine(supervisor.Host.Root, "tools", "dev", "slots.cjs").Replace('\\', '/')}\"";
            }

            info.Environment["NODE_OPTIONS"] = options.Trim();
            return info;
        }

        long? TicksOf(string file)
        {
            var full = Path.Combine(supervisor.Root, file);
            return File.Exists(full) ? File.GetLastWriteTimeUtc(full).Ticks : null;
        }

        void RefreshSpecFiles()
        {
            SpecFiles = Expand(SpecRoots.Select(r => r.Path));
            SpecFilesVersion = Touch();
        }

        void SaveCatalog()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(catalogCache));
                var ready = Catalog.Where(c => c.Value.Status == "ready").ToDictionary(c => c.Key, c => new { ticks = c.Value.Ticks, tests = c.Value.Tests });
                File.WriteAllText(catalogCache, JsonConvert.SerializeObject(ready, DevJson.Settings));
            }
            catch (IOException)
            {
            }
        }

        void List(List<string> targets)
        {
            lock (Gate)
            {
                foreach (var file in targets)
                    Catalog[file] = new CatalogEntry { Status = "loading", Tests = Catalog.TryGetValue(file, out var known) ? known.Tests : new List<CatalogTest>(), Version = Touch() };
            }

            Task.Run(async () =>
            {
                await listing.WaitAsync();
                try
                {
                    var stamps = targets.ToDictionary(f => f, TicksOf);
                    var found = new Dictionary<string, List<CatalogTest>>();
                    var exitCode = -1;
                    try
                    {
                        using var process = Process.Start(PlaywrightStartInfo(targets.Append("--list"), DevSupervisor.ServerUrl));
                        ProcessJob.Add(process);
                        process.ErrorDataReceived += (_, _) => { };
                        process.BeginErrorReadLine();
                        string raw;
                        while ((raw = process.StandardOutput.ReadLine()) != null)
                        {
                            if (!raw.StartsWith(Marker))
                                continue;

                            var e = JObject.Parse(raw[Marker.Length..]);
                            if ((string)e["type"] != "begin")
                                continue;

                            foreach (var test in e["tests"].ToObject<List<CatalogTest>>())
                            {
                                if (!found.TryGetValue(test.File, out var tests))
                                    found[test.File] = tests = new List<CatalogTest>();

                                tests.Add(test);
                            }
                        }

                        process.WaitForExit();
                        exitCode = process.ExitCode;
                    }
                    catch (Exception)
                    {
                    }

                    lock (Gate)
                    {
                        foreach (var file in targets)
                            Catalog[file] = new CatalogEntry { Status = exitCode == 0 ? "ready" : "error", Tests = found.TryGetValue(file, out var tests) ? tests : new List<CatalogTest>(), Ticks = stamps[file], Version = Touch() };

                        SaveCatalog();
                    }
                }
                finally
                {
                    listing.Release();
                }
            });
        }

        public void LoadTests(string file, bool refresh)
        {
            lock (Gate)
            {
                if (Catalog.TryGetValue(file, out var known) && (known.Status == "loading" || !(refresh && (known.Status == "error" || known.Ticks != TicksOf(file)))))
                    return;
            }

            List(new List<string> { file });
        }

        public void RetryFailed()
        {
            List<string> failed;
            lock (Gate)
            {
                if (supervisor.ShuttingDown)
                    return;

                failed = Catalog.Where(c => c.Value.Status == "error").Select(c => c.Key).ToList();
            }

            if (failed.Count > 0)
                List(failed);
        }

        void WatchSpecs()
        {
            foreach (var (_, path) in SpecRoots)
            {
                try
                {
                    var specWatcher = new FileSystemWatcher(Path.Combine(supervisor.Root, path), "*.spec.ts") { IncludeSubdirectories = true };
                    FileSystemEventHandler onChange = (_, e) => SpecChanged(supervisor.Relative(e.FullPath));
                    specWatcher.Changed += onChange;
                    specWatcher.Created += onChange;
                    specWatcher.Deleted += onChange;
                    specWatcher.Renamed += (_, e) =>
                    {
                        SpecChanged(supervisor.Relative(e.OldFullPath));
                        SpecChanged(supervisor.Relative(e.FullPath));
                    };
                    specWatcher.EnableRaisingEvents = true;
                    specWatchers.Add(specWatcher);
                }
                catch (Exception)
                {
                }
            }
        }

        void SpecChanged(string file)
        {
            lock (pendingSpecs)
            {
                if (pendingSpecs.TryGetValue(file, out var pending))
                    pending.Dispose();

                pendingSpecs[file] = new Timer(_ =>
                {
                    lock (pendingSpecs)
                        pendingSpecs.Remove(file);

                    var exists = File.Exists(Path.Combine(supervisor.Root, file));
                    var known = false;
                    lock (Gate)
                    {
                        if (exists != SpecFiles.Contains(file))
                            RefreshSpecFiles();

                        if (!exists)
                            Catalog.Remove(file);

                        known = Catalog.ContainsKey(file);
                    }

                    if (exists && known)
                        LoadTests(file, true);
                }, null, 300, Timeout.Infinite);
            }
        }

        public void Start()
        {
            Dictionary<string, JObject> cached = new();
            try
            {
                cached = JsonConvert.DeserializeObject<Dictionary<string, JObject>>(File.ReadAllText(catalogCache)) ?? cached;
            }
            catch (Exception)
            {
            }

            var stale = new List<string>();
            lock (Gate)
            {
                if (supervisor.ShuttingDown)
                    return;

                RefreshSpecFiles();
                foreach (var file in SpecFiles)
                {
                    var ticks = TicksOf(file);
                    if (cached.TryGetValue(file, out var hit) && hit["ticks"]?.Type == JTokenType.Integer && (long)hit["ticks"] == ticks)
                        Catalog[file] = new CatalogEntry { Status = "ready", Tests = hit["tests"].ToObject<List<CatalogTest>>(), Ticks = ticks, Version = Touch() };
                    else
                        stale.Add(file);
                }
            }

            if (stale.Count > 0)
                List(stale);

            WatchSpecs();
        }

        public void Stop()
        {
            specWatchers.ForEach(w => w.Dispose());
            specWatchers.Clear();
        }

        public List<string> Blockers()
        {
            return supervisor.Watchers.Where(t => t.Status is "waiting" or "starting" or "building").Select(t => t.Label).ToList();
        }

        void Tell(TestRun run, string text)
        {
            Output(run, text);
            Console.WriteLine($"[test #{run.Id}] {text}");
        }

        void Output(TestRun run, string text)
        {
            run.Output.Add(new OutputLine { Id = run.OutputCount++, Text = text });
            if (run.Output.Count > 5000)
                run.Output.RemoveRange(0, 1000);

            run.Version = Touch();
        }

        /// <summary>
        /// Queues a run. A followed run belongs to a client (npm run test:dev) that polls its output; it is cancelled
        /// when that client stops polling (see CancelAbandoned).
        /// </summary>
        public TestRun CreateRun(IReadOnlyList<string> args, bool followed = false, string key = null)
        {
            var (flags, paths) = ParseArgs(args);
            var targets = Expand(paths);
            var access = AccessOf(flags, targets);
            var perf = access == Machine ? null : targets.FirstOrDefault(IsPerf);
            flags = PlaywrightFlags(flags);
            var workers = WorkersOf(flags, targets);
            flags = WithoutWorkers(flags);

            var files = targets.GroupBy(SpecOf).Select(g => new RunFile { File = g.Count() == 1 ? g.First() : g.Key }).ToList();
            lock (Gate)
            {
                // A client that lost the answer to its request sends it again; it gets the run it already queued
                var queued = key != null ? Runs.FirstOrDefault(r => r.Key == key) : null;
                if (queued != null)
                    return queued;

                var run = new TestRun { Id = nextId++, Sequence = ++sequence, Access = access, Workers = workers, Followed = followed, Args = args.ToList(), Key = key, LastPolled = Environment.TickCount64, Flags = flags, Targets = targets, Files = files, QueuedAt = DevSupervisor.Now(), QueuedMs = Live.Now() };
                Runs.Add(run);

                var finished = Runs.Where(r => r.Done).ToList();
                if (Runs.Count > KeptRuns && finished.Count > 0)
                    Runs.Remove(finished[0]);

                Tell(run, $"Run #{run.Id} queued in the dev supervisor{(supervisor.IsMain ? "" : $" for worktree {supervisor.Workspace}")}:{(files.Count == 1 ? files[0].File : $"{files.Count} spec files")}{(flags.Count > 0 ? $" {string.Join(' ', flags)}" : "")}");
                if (perf != null)
                    Tell(run, $"Left out the {TimingTag} perf tests: they run alone, e.g. npm run test:dev -- --project={TimingProject} {Path.GetDirectoryName(SpecOf(perf)).Replace('\\', '/')}");

                if (run.Access == Machine)
                    Tell(run, $"Perf runs ({TimingTag} tests) run alone on one worker: this run waits until no other test run runs and no watcher builds");

                return run;
            }
        }

        public TestRun FindRun(int id)
        {
            lock (Gate)
                return Runs.FirstOrDefault(r => r.Id == id);
        }

        /// <summary>
        /// Keeps a queued run waiting, and says what for whenever that changes. Worktrees.NextRun calls this under the Gate.
        /// </summary>
        public void Wait(TestRun run, string reason)
        {
            if (run.WaitingFor == reason)
                return;

            run.WaitingFor = reason;
            run.WaitedFor = reason;
            Tell(run, $"Waiting for {reason} to finish");
        }

        /// <summary>
        /// Fails a queued run that cannot run at all, with the lines that say why. Worktrees.NextRun calls this under the Gate.
        /// </summary>
        public void Fail(TestRun run, string reason, IEnumerable<string> details)
        {
            run.Status = "failed";
            run.ExitCode = 1;
            run.Took = 0;
            run.WaitingFor = null;
            run.Files.ForEach(f => f.Status = "skipped");
            run.Errors.Add(JObject.FromObject(new { message = reason }));
            foreach (var line in details)
                Output(run, line);

            Tell(run, $"── Run #{run.Id} failed: {reason}");
            Live.Record(supervisor, run);
        }

        /// <summary>
        /// Adds a line to a run's output. Worktrees.NextRun calls this under the Gate.
        /// </summary>
        public void Note(TestRun run, string text)
        {
            Tell(run, text);
        }

        /// <summary>
        /// Starts a queued run. Worktrees.NextRun calls this under the Gate.
        /// </summary>
        public void Begin(TestRun run)
        {
            run.Status = "running";
            run.WaitingFor = null;
            run.Started = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            RunAll(run);
        }

        void RunAll(TestRun run)
        {
            Output(run, $"── {(run.Files.Count == 1 ? run.Files[0].File : $"{run.Files.Count} spec files")}");

            var process = new Process { StartInfo = PlaywrightStartInfo(run.Targets.Concat(run.Flags).Append("--workers").Append(run.Workers.ToString()), UsesOwnBackend(run) ? supervisor.BackendUrl : DevSupervisor.ServerUrl, run), EnableRaisingEvents = true };
            DataReceivedEventHandler onLine = (_, e) =>
            {
                if (e.Data == null)
                    return;

                lock (Gate)
                {
                    if (e.Data.StartsWith(Marker))
                    {
                        Handle(run, JObject.Parse(e.Data[Marker.Length..]));
                        return;
                    }

                    var line = DevSupervisor.Strip(e.Data).TrimEnd();
                    if (line.Trim().Length > 0)
                        Output(run, line);
                }
            };
            process.OutputDataReceived += onLine;
            process.ErrorDataReceived += onLine;
            process.Exited += (_, _) => Closed(run, process);

            try
            {
                process.Start();
            }
            catch (Exception e)
            {
                run.Errors.Add(JObject.FromObject(new { file = run.Files.Count == 1 ? run.Files[0].File : null, message = e.Message }));
                Output(run, e.Message);
                Finish(run);
                return;
            }

            ProcessJob.Add(process);
            run.Process = process;
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
        }

        void Closed(TestRun run, Process process)
        {
            process.WaitForExit();
            lock (Gate)
            {
                run.Process = null;
                var anyFailed = run.Tests.Any(t => t.Status == "failed");
                foreach (var file in run.Files.Where(f => f.Status is not ("passed" or "failed")))
                {
                    foreach (var test in TestsOf(run, file).Where(t => t.Status is "running" or "pending"))
                    {
                        test.Status = "not run";
                        test.Version = Touch();
                    }

                    file.Took = file.Started != null ? Environment.TickCount64 - file.Started : null;
                    file.Status = run.Cancelled ? "cancelled" : TestsOf(run, file).Any(t => t.Status == "failed") ? "failed" : process.ExitCode == 0 ? "passed" : anyFailed ? "skipped" : "failed";
                }

                Finish(run, process.ExitCode);
            }
        }

        static IEnumerable<RunTest> TestsOf(TestRun run, RunFile file)
        {
            return run.Tests.Where(t => t.Spec == file.File);
        }

        void Handle(TestRun run, JObject e)
        {
            switch ((string)e["type"])
            {
                case "begin":
                    foreach (var test in e["tests"].ToObject<List<CatalogTest>>())
                        run.Tests.Add(new RunTest { RunId = run.Id, Id = test.Id, Title = test.Title, File = test.File, Line = test.Line, Column = test.Column, Spec = run.Files.FirstOrDefault(f => Regex.Replace(f.File, @":\d+$", "") == test.File)?.File ?? test.File, Version = Touch() });

                    run.Total = run.Tests.Count;
                    // A --project or grep leaves some targeted spec files without a test: they don't run, so they don't
                    // wait as pending until the end and then show as passed
                    if (run.Tests.Count > 0)
                        run.Files.RemoveAll(f => run.Tests.All(t => t.Spec != f.File));

                    break;

                case "test-begin":
                case "test-end":
                {
                    var test = run.Tests.FirstOrDefault(t => t.Id == (string)e["id"]);
                    if (test == null)
                        return;

                    var file = run.Files.FirstOrDefault(f => f.File == test.Spec);
                    if ((string)e["type"] == "test-begin")
                    {
                        test.Status = "running";
                        // A retry reopens a file that settled after the failed attempt
                        if (file != null && file.Status != "running")
                        {
                            file.Status = "running";
                            file.Started ??= Environment.TickCount64;
                        }
                    }
                    else
                    {
                        var outcome = (string)e["outcome"];
                        test.Status = outcome switch { "expected" => "passed", "flaky" => "flaky", "skipped" => "skipped", _ => (string)e["status"] == "interrupted" ? "not run" : "failed" };
                        test.Duration = (double?)e["duration"];
                        test.Ended = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                        test.Errors = e["errors"] as JArray ?? new JArray();
                        if (file != null)
                            Settle(run, file);
                    }

                    test.Version = Touch();
                    break;
                }

                case "error":
                {
                    var error = (JObject)e["error"];
                    error["file"] = (string)error["location"]?["file"] ?? (run.Files.Count == 1 ? run.Files[0].File : null);
                    run.Errors.Add(error);
                    break;
                }
            }

            run.Version = Touch();
        }

        static void Settle(TestRun run, RunFile file)
        {
            var tests = TestsOf(run, file).ToList();
            if (file.Status != "running" || tests.Any(t => t.Status is "pending" or "running"))
                return;

            file.Status = tests.Any(t => t.Status == "failed") ? "failed" : "passed";
            file.Took = Environment.TickCount64 - file.Started;
        }

        void Finish(TestRun run, int exitCode = 0)
        {
            run.Took = run.Started != null ? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - run.Started : 0;
            run.Status = run.Cancelled ? "cancelled" : run.Files.Any(f => f.Status == "failed") ? "failed" : "passed";

            var failedFiles = run.Files.Where(f => f.Status == "failed").ToList();
            var ran = run.Files.Count(f => f.Status != "skipped");
            run.ExitCode = run.Cancelled ? 130 : failedFiles.Count > 0 ? 1 : exitCode;
            Tell(run, $"── Run #{run.Id} {run.Status}: {ran}/{run.Files.Count} spec files run{(failedFiles.Count > 0 ? $", failed: {string.Join(", ", failedFiles.Select(f => f.File))}" : "")}");
            TestSlots.ReleaseRun(SlotsKey(run));
            Live.Record(supervisor, run);
        }

        public void Cancel(TestRun run)
        {
            lock (Gate)
            {
                if (run.Status == "queued")
                {
                    run.Status = "cancelled";
                    run.ExitCode = 130;
                    run.Files.ForEach(f => f.Status = "skipped");
                    Tell(run, $"Run #{run.Id} was cancelled in the dev supervisor");
                    Live.Record(supervisor, run);
                    return;
                }

                if (run.Status != "running" || run.Cancelled)
                    return;

                run.Cancelled = true;
                Tell(run, $"Run #{run.Id} was cancelled in the dev supervisor");
                try
                {
                    run.Process?.Kill(true);
                }
                catch (Exception)
                {
                }
            }
        }

        /// <summary>
        /// Cancels the followed runs whose client has not polled their output for a while, e.g. because its shell was killed.
        /// </summary>
        public void CancelAbandoned(long idleMs)
        {
            List<TestRun> abandoned;
            lock (Gate)
            {
                abandoned = Runs.Where(r => r.Followed && !r.Done && !r.Cancelled && Environment.TickCount64 - r.LastPolled > idleMs).ToList();
                foreach (var run in abandoned)
                    Tell(run, $"Nothing follows run #{run.Id} anymore (no poll for {idleMs / 1000}s)");
            }

            abandoned.ForEach(Cancel);
        }

        public void CancelAll()
        {
            lock (Gate)
                Runs.ToList().ForEach(Cancel);
        }
    }
}
