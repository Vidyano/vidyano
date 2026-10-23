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
        public long? Started;
        public long? Took;
        public string WaitingFor;
        public bool Cancelled;
        public int? ExitCode;
        public List<JObject> Errors = new();
        public List<RunTest> Tests = new();
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

        ProcessStartInfo PlaywrightStartInfo(IEnumerable<string> arguments)
        {
            var info = supervisor.StartInfo(supervisor.Node, new[] { PlaywrightCli, "test" }.Concat(arguments));
            info.Environment["FORCE_COLOR"] = "0";
            info.Environment["VIDYANO_DEV_EVENTS"] = "1";
            info.Environment["NODE_OPTIONS"] = $"{Environment.GetEnvironmentVariable("NODE_OPTIONS")} --disable-warning=DEP0205".Trim();
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
                        using var process = Process.Start(PlaywrightStartInfo(targets.Append("--list")));
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

        public TestRun CreateRun(IReadOnlyList<string> args)
        {
            var (flags, paths) = ParseArgs(args);
            var targets = Expand(paths);
            var files = targets.GroupBy(t => Regex.Replace(t, @":\d+$", "")).Select(g => new RunFile { File = g.Count() == 1 ? g.First() : g.Key }).ToList();
            lock (Gate)
            {
                var run = new TestRun { Id = nextId++, Flags = flags, Targets = targets, Files = files, QueuedAt = DevSupervisor.Now() };
                Runs.Add(run);

                var finished = Runs.Where(r => r.Done).ToList();
                if (Runs.Count > KeptRuns && finished.Count > 0)
                    Runs.Remove(finished[0]);

                Tell(run, $"Run #{run.Id} queued in the dev supervisor{(supervisor.IsMain ? "" : $" for worktree {supervisor.Workspace}")}:{(files.Count == 1 ? files[0].File : $"{files.Count} spec files")}{(flags.Count > 0 ? $" {string.Join(' ', flags)}" : "")}");
                return run;
            }
        }

        public TestRun FindRun(int id)
        {
            lock (Gate)
                return Runs.FirstOrDefault(r => r.Id == id);
        }

        public void Next()
        {
            lock (Gate)
            {
                if (supervisor.ShuttingDown || Worktrees.TestsRunning())
                    return;

                var run = Runs.FirstOrDefault(r => r.Status == "queued");
                if (run == null)
                    return;

                var waiting = Blockers();
                if (waiting.Count > 0)
                {
                    var reason = string.Join(", ", waiting);
                    if (run.WaitingFor != reason)
                    {
                        run.WaitingFor = reason;
                        Tell(run, $"Waiting for {reason} to finish");
                    }

                    return;
                }

                run.Status = "running";
                run.WaitingFor = null;
                run.Started = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                RunAll(run);
            }
        }

        void RunAll(TestRun run)
        {
            Output(run, $"── {(run.Files.Count == 1 ? run.Files[0].File : $"{run.Files.Count} spec files")}");

            var process = new Process { StartInfo = PlaywrightStartInfo(run.Targets.Concat(run.Flags)), EnableRaisingEvents = true };
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

        public void CancelAll()
        {
            lock (Gate)
                Runs.ToList().ForEach(Cancel);
        }
    }
}
