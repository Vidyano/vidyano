#nullable disable

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using Newtonsoft.Json;

namespace Dev.Service.Supervisor
{
    // File and Line are where the test failed; TestFile and TestLine where it is declared, which a rerun needs
    public record LiveFailureDto(string Title, string File, int Line, int Column, string TestFile, int TestLine, string Message, double? Duration);

    public record LiveFileDto(string File, string Status, int Passed, int Failed, int Done);

    public record LiveRunDto(string Key, string Workspace, int Id, string Status, List<string> Targets, List<string> Flags, long Queued, long? Started, long? Ended, string WaitedFor, bool Perf, int? Total, int Passed, int Failed, int Skipped, List<LiveFileDto> Files, List<LiveFailureDto> Failures, List<string> Errors);

    public record LiveChangeDto(string Workspace, string Path, long At, int Adds, int Dels);

    public record LiveCheckoutDto(string Name, string Branch, bool Running, string Building, long? BuildingSince, List<LiveRunDto> Runs, List<LiveChangeDto> Changes);

    public record LiveDto(long Now, List<LiveCheckoutDto> Checkouts);

    /// <summary>
    /// What the Live view of the supervisor shows: the test runs and file changes of every checkout in the last hour.
    /// Finished runs and changes are saved, so they outlive a backend restart.
    /// </summary>
    public static class Live
    {
        public static readonly TimeSpan Window = TimeSpan.FromHours(1);
        const string HistoryFile = "node_modules/.cache/vidyano-dev/live-history.json";

        static readonly object gate = new();
        static readonly Dictionary<string, LiveRunDto> runs = new();
        static readonly List<LiveChangeDto> changes = new();
        static readonly Dictionary<string, ChangeTracker> trackers = new(StringComparer.OrdinalIgnoreCase);
        static string historyPath;
        static Timer save;

        sealed record History(List<LiveRunDto> Runs, List<LiveChangeDto> Changes);

        public static long Now() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        public static void Start(DevSupervisor host)
        {
            historyPath = Path.Combine(host.Root, HistoryFile);
            try
            {
                var history = File.Exists(historyPath) ? JsonConvert.DeserializeObject<History>(File.ReadAllText(historyPath)) : null;
                lock (gate)
                {
                    foreach (var run in history?.Runs ?? new List<LiveRunDto>())
                        runs[run.Key] = run;

                    changes.AddRange(history?.Changes ?? new List<LiveChangeDto>());
                    Prune();
                }
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException or JsonException)
            {
            }

            save = new Timer(_ => Save(), null, Timeout.Infinite, Timeout.Infinite);
            Track(null, host.Root);
        }

        /// <summary>
        /// Keeps a finished run, so it stays on the timeline after its checkout's supervisor dropped it or restarted.
        /// Called under the supervisor's Gate.
        /// </summary>
        public static void Record(DevSupervisor supervisor, TestRun run)
        {
            var dto = From(supervisor, run);
            lock (gate)
                runs[dto.Key] = dto;

            save?.Change(1000, Timeout.Infinite);
        }

        public static void Track(string workspace, string root)
        {
            lock (gate)
            {
                if (!trackers.ContainsKey(root))
                    trackers[root] = new ChangeTracker(workspace, root, Changed);
            }
        }

        static void Changed(LiveChangeDto change)
        {
            lock (gate)
                changes.Add(change);

            save?.Change(1000, Timeout.Infinite);
        }

        static void Prune()
        {
            var since = Now() - (long)Window.TotalMilliseconds;
            foreach (var key in runs.Where(r => (r.Value.Ended ?? r.Value.Started ?? r.Value.Queued) < since).Select(r => r.Key).ToList())
                runs.Remove(key);

            changes.RemoveAll(c => c.At < since);
        }

        static void Save()
        {
            string json;
            lock (gate)
            {
                Prune();
                json = JsonConvert.SerializeObject(new History(runs.Values.ToList(), changes.ToList()));
            }

            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(historyPath));
                File.WriteAllText(historyPath, json);
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException)
            {
            }
        }

        public static LiveDto Snapshot()
        {
            var host = DevSupervisor.Instance;
            var checkouts = Worktrees.Known.Select(w => (w.Name, w.Branch, w.Root, w.Supervisor)).Prepend((Name: (string)null, Branch: Worktrees.HostBranch, host.Root, Supervisor: host)).ToList();
            foreach (var checkout in checkouts)
                Track(checkout.Name, checkout.Root);

            List<ChangeTracker> removed;
            lock (gate)
            {
                removed = trackers.Where(t => checkouts.All(c => !string.Equals(c.Root, t.Key, StringComparison.OrdinalIgnoreCase))).Select(t => t.Value).ToList();
                foreach (var key in trackers.Where(t => removed.Contains(t.Value)).Select(t => t.Key).ToList())
                    trackers.Remove(key);
            }

            removed.ForEach(t => t.Dispose());

            var current = new Dictionary<string, List<LiveRunDto>>();
            var building = new Dictionary<string, (string, long?)>();
            lock (host.Gate)
            {
                foreach (var checkout in checkouts.Where(c => c.Supervisor != null))
                {
                    current[checkout.Name ?? ""] = checkout.Supervisor.Tests.Runs.Select(r => From(checkout.Supervisor, r)).ToList();
                    var install = checkout.Supervisor.Tasks.FirstOrDefault(t => t.Key == "install" && t.Status is "starting" or "building");
                    if (install != null)
                        building[checkout.Name ?? ""] = (install.Label, install.Since != null ? Now() - (Environment.TickCount64 - install.Since) : null);
                }
            }

            lock (gate)
            {
                Prune();
                return new LiveDto(Now(), checkouts.Select(checkout =>
                {
                    var key = checkout.Name ?? "";
                    var live = current.GetValueOrDefault(key) ?? new List<LiveRunDto>();
                    var kept = runs.Values.Where(r => (r.Workspace ?? "") == key && live.All(l => l.Key != r.Key));
                    var (label, since) = building.GetValueOrDefault(key);
                    return new LiveCheckoutDto(checkout.Name, checkout.Branch, checkout.Supervisor != null, label, since, kept.Concat(live).OrderBy(r => r.Queued).ToList(), changes.Where(c => (c.Workspace ?? "") == key).ToList());
                }).ToList());
            }
        }

        static LiveRunDto From(DevSupervisor supervisor, TestRun run)
        {
            var tests = run.Tests;
            int Count(params string[] statuses) => tests.Count(t => statuses.Contains(t.Status));
            var files = run.Files.Select(f =>
            {
                var spec = Regex.Replace(f.File, @":\d+$", "");
                var inFile = tests.Where(t => t.Spec == spec || t.File == spec).ToList();
                return new LiveFileDto(spec, f.Status, inFile.Count(t => t.Status is "passed" or "flaky"), inFile.Count(t => t.Status == "failed"), inFile.Count(t => t.Status is not ("pending" or "running")));
            }).ToList();

            var failures = tests.Where(t => t.Status == "failed").Select(t =>
            {
                var error = t.Errors.FirstOrDefault();
                var location = error?["location"];
                return new LiveFailureDto(t.Title, (string)location?["file"] ?? t.File, (int?)location?["line"] ?? t.Line, (int?)location?["column"] ?? t.Column, t.File, t.Line, (string)error?["message"] ?? "", t.Duration);
            }).ToList();

            // A run that failed without a failed test (a broken build, a spec that does not compile) says why here
            var errors = run.Errors.Select(e => (string)e["message"]).Where(m => !string.IsNullOrEmpty(m)).ToList();
            return new LiveRunDto($"{supervisor.InstanceId}:{run.Id}", supervisor.IsMain ? null : supervisor.Workspace, run.Id, run.Status, run.Targets, run.Flags, run.QueuedMs, run.Started, run.Started != null && run.Took != null ? run.Started + run.Took : null, run.WaitedFor, run.Access == TestRunner.Machine, run.Total, Count("passed", "flaky"), Count("failed"), Count("skipped", "not run"), files, failures, errors);
        }

        /// <summary>
        /// The source files a checkout's people and agents change, with the lines each change added and removed. Build
        /// output (compiled .js and .css next to their source, bundles, packages) is left out.
        /// </summary>
        sealed class ChangeTracker : IDisposable
        {
            static readonly Regex Ignored = new(@"(^|/)(node_modules|\.git|dist|bin|obj|wwwroot|rollup|test-results|playwright-report|\.cache|\.claude|\.vs|\.vscode|\.idea)(/|$)|\.(map|log|tmp|lock)$|~$", RegexOptions.IgnoreCase);
            const long MaxBytes = 1024 * 1024;

            readonly string workspace;
            readonly string root;
            readonly Action<LiveChangeDto> changed;
            readonly FileSystemWatcher watcher;
            readonly Dictionary<string, string[]> seen = new(StringComparer.OrdinalIgnoreCase);
            readonly Dictionary<string, Timer> pending = new(StringComparer.OrdinalIgnoreCase);

            public ChangeTracker(string workspace, string root, Action<LiveChangeDto> changed)
            {
                this.workspace = workspace;
                this.root = root;
                this.changed = changed;
                try
                {
                    watcher = new FileSystemWatcher(root) { IncludeSubdirectories = true, NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size, InternalBufferSize = 64 * 1024 };
                    watcher.Changed += (_, e) => Soon(e.FullPath);
                    watcher.Created += (_, e) => Soon(e.FullPath);
                    watcher.Deleted += (_, e) => Soon(e.FullPath);
                    watcher.Renamed += (_, e) =>
                    {
                        Soon(e.OldFullPath);
                        Soon(e.FullPath);
                    };
                    watcher.EnableRaisingEvents = true;
                }
                catch (Exception e) when (e is IOException or ArgumentException or UnauthorizedAccessException)
                {
                    watcher = null;
                }

                ThreadPool.QueueUserWorkItem(_ => Baseline());
            }

            // Files changed before the tracker started count from their current content, not from the commit, or their
            // first change after a backend restart would show everything changed since the commit
            void Baseline()
            {
                var (exitCode, output) = DevSupervisor.Capture("git", "-C", root, "status", "--porcelain", "--untracked-files=all");
                if (exitCode != 0)
                    return;

                foreach (var line in output.Split('\n').Where(l => l.Length > 3))
                {
                    var path = line[3..].Trim().Trim('"');
                    var arrow = path.IndexOf(" -> ", StringComparison.Ordinal);
                    if (arrow >= 0)
                        path = path[(arrow + 4)..];

                    if (Ignored.IsMatch(path))
                        continue;

                    var lines = Read(Path.Combine(root, path));
                    if (lines == null)
                        continue;

                    lock (seen)
                        seen.TryAdd(path, lines);
                }
            }

            // An editor saves in several writes; the change counts once they stop
            void Soon(string full)
            {
                var path = Path.GetRelativePath(root, full).Replace('\\', '/');
                if (path.StartsWith("..") || Ignored.IsMatch(path) || IsBuildOutput(full))
                    return;

                lock (pending)
                {
                    if (pending.TryGetValue(path, out var timer))
                        timer.Change(300, Timeout.Infinite);
                    else
                        pending[path] = new Timer(_ => Settle(path), null, 300, Timeout.Infinite);
                }
            }

            static bool IsBuildOutput(string full)
            {
                return full.EndsWith(".js", StringComparison.OrdinalIgnoreCase) && File.Exists(Path.ChangeExtension(full, ".ts")) || full.EndsWith(".css", StringComparison.OrdinalIgnoreCase) && File.Exists(Path.ChangeExtension(full, ".scss")) || full.EndsWith(".d.ts", StringComparison.OrdinalIgnoreCase);
            }

            void Settle(string path)
            {
                lock (pending)
                {
                    if (pending.Remove(path, out var timer))
                        timer.Dispose();
                }

                var full = Path.Combine(root, path);
                if (Directory.Exists(full))
                    return;

                var lines = Read(full);
                string[] before;
                lock (seen)
                {
                    if (!seen.TryGetValue(path, out before))
                        before = null;
                }

                before ??= Committed(path);
                if (lines == null && before == null)
                    return;

                var (adds, dels) = Count(before ?? Array.Empty<string>(), lines ?? Array.Empty<string>());
                lock (seen)
                    seen[path] = lines ?? Array.Empty<string>();

                if (adds + dels > 0)
                    changed(new LiveChangeDto(workspace, path, Now(), adds, dels));
            }

            // Null for a file that is gone, too large or binary
            static string[] Read(string full)
            {
                try
                {
                    var info = new FileInfo(full);
                    if (!info.Exists || info.Length > MaxBytes)
                        return null;

                    var text = File.ReadAllText(full);
                    return text.Contains('\0') ? null : text.Split('\n');
                }
                catch (Exception e) when (e is IOException or UnauthorizedAccessException)
                {
                    return null;
                }
            }

            // The file as committed, for its first change since the supervisor started
            string[] Committed(string path)
            {
                var (exitCode, output) = DevSupervisor.Capture("git", "-C", root, "show", $"HEAD:{path}");
                return exitCode == 0 && !output.Contains('\0') ? output.Split('\n') : null;
            }

            // Lines added and removed, as a diff would count them for the lines that differ
            static (int Adds, int Dels) Count(string[] before, string[] after)
            {
                var a = before.Select(l => l.TrimEnd('\r')).ToArray();
                var b = after.Select(l => l.TrimEnd('\r')).ToArray();
                int start = 0, endA = a.Length, endB = b.Length;
                while (start < endA && start < endB && a[start] == b[start])
                    start++;

                while (endA > start && endB > start && a[endA - 1] == b[endB - 1])
                {
                    endA--;
                    endB--;
                }

                int n = endA - start, m = endB - start;
                if (n == 0 || m == 0 || (long)n * m > 4_000_000)
                    return (m, n);

                // The longest common subsequence of what differs, so moved lines count as removed and added
                var row = new int[m + 1];
                for (var i = 1; i <= n; i++)
                {
                    var diagonal = 0;
                    for (var j = 1; j <= m; j++)
                    {
                        var above = row[j];
                        row[j] = a[start + i - 1] == b[start + j - 1] ? diagonal + 1 : Math.Max(row[j], row[j - 1]);
                        diagonal = above;
                    }
                }

                return (m - row[m], n - row[m]);
            }

            public void Dispose()
            {
                watcher?.Dispose();
                lock (pending)
                {
                    foreach (var timer in pending.Values)
                        timer.Dispose();

                    pending.Clear();
                }
            }
        }
    }
}
