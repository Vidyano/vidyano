#nullable disable

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Newtonsoft.Json;

namespace Dev.Service.Supervisor
{
    public sealed class Worktree
    {
        public string Name;
        public string Root;
        public string Branch;
        public DevSupervisor Supervisor;
    }

    public static class Worktrees
    {
        const string WebRoot = "dev/wwwroot";
        const string IndexTemplate = "dev/App_Data/Websites/Default/index.html";

        static readonly HashSet<string> Reserved = new(StringComparer.OrdinalIgnoreCase) { "supervisor", "api" };
        static readonly StringComparison PathComparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        static readonly FileExtensionContentTypeProvider ContentTypes = new();

        static readonly HashSet<string> stoppedByUser = new();
        static List<Worktree> known = new();
        static Dictionary<string, string> skipped = new();
        static string hostBranch;
        static FileSystemWatcher watcher;
        static Timer pending;
        static Timer sweep;

        // npm run test:dev polls a run's output every 300 ms; a run nobody polled for this long has lost its client
        const long AbandonedMs = 30000;

        static DevSupervisor Host => DevSupervisor.Instance;

        // The runs queued without a client while a restart was held, so the new backend queues them again (see Hold)
        const string HeldRunsFile = "node_modules/.cache/vidyano-dev/held-runs.json";
        static string savedHeldRuns;
        static bool stopping;

        sealed record HeldRun(string Workspace, List<string> Args);

        public static void Start(DevSupervisor host)
        {
            Refresh();
            Watch(host.Root);
            sweep = new Timer(_ => Supervisors().ForEach(s => s.Tests.CancelAbandoned(AbandonedMs)), null, 5000, 5000);
            Live.Start(host);
            QueueHeldRuns(host);
        }

        static void QueueHeldRuns(DevSupervisor host)
        {
            var path = Path.Combine(host.Root, HeldRunsFile);
            List<HeldRun> held;
            try
            {
                if (!File.Exists(path))
                    return;

                held = JsonConvert.DeserializeObject<List<HeldRun>>(File.ReadAllText(path)) ?? new List<HeldRun>();
                File.Delete(path);
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException or JsonException)
            {
                return;
            }

            foreach (var run in held)
                (run.Workspace == null ? host : Run(run.Workspace))?.Tests.CreateRun(run.Args);
        }

        /// <summary>
        /// Saves the queued runs without a client while a restart is held. Called under the Gate.
        /// </summary>
        static void SaveHeldRuns(List<DevSupervisor> supervisors)
        {
            if (Held != null && !stopping)
                SaveHeldRuns(supervisors.SelectMany(s => s.Tests.Runs.Where(r => r.Status == "queued" && !r.Followed).Select(r => new HeldRun(s.IsMain ? null : s.Workspace, r.Args))).ToList());
        }

        static void SaveHeldRuns(List<HeldRun> held)
        {
            var json = JsonConvert.SerializeObject(held);
            if (json == savedHeldRuns)
                return;

            var path = Path.Combine(Host.Root, HeldRunsFile);
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                if (held.Count > 0)
                    File.WriteAllText(path, json);
                else
                    File.Delete(path);

                savedHeldRuns = json;
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException)
            {
            }
        }

        public static IReadOnlyList<Worktree> Known
        {
            get
            {
                lock (Host.Gate)
                    return known.ToList();
            }
        }

        public static string HostBranch => hostBranch;

        static List<DevSupervisor> Supervisors()
        {
            var host = Host;
            if (host == null)
                return new List<DevSupervisor>();

            lock (host.Gate)
                return known.Select(w => w.Supervisor).Where(s => s != null).Prepend(host).ToList();
        }

        /// <summary>
        /// Why tools/dev/index.mjs is about to restart the backend, which ends every test run; null when it is not. Until the
        /// restart no queued run starts, so the running ones can finish and the restart never cuts one off. npm run
        /// test:dev queues its run again on the new backend; a run queued without a client is saved for it (see Start).
        /// </summary>
        public static string Held { get; private set; }

        public static void Hold(string reason)
        {
            lock (Host.Gate)
            {
                Held = string.IsNullOrWhiteSpace(reason) ? null : reason;
                if (Held == null)
                    SaveHeldRuns(new List<HeldRun>());
            }

            ChangedAll();
        }

        public static void ChangedAll()
        {
            foreach (var supervisor in Supervisors())
                supervisor.Changed();
        }

        /// <summary>
        /// The queued and running test runs of all checkouts, which a backend restart would end (see tools/dev/index.mjs).
        /// </summary>
        public static List<ActiveRunDto> ActiveRuns()
        {
            var supervisors = Supervisors();
            lock (Host.Gate)
            {
                // tools/dev/index.mjs restarts the backend right after this answer, so the held runs are saved before it
                SaveHeldRuns(supervisors);
                return supervisors.SelectMany(s => s.Tests.Runs.Where(r => !r.Done).Select(r => new ActiveRunDto(Label(s), r.Id, r.Status, r.Followed))).ToList();
            }
        }

        /// <summary>
        /// Starts the npm ci of the first worktree that waits for one, unless another runs: several at once compete for
        /// the npm cache and the disk.
        /// </summary>
        public static void NextInstall()
        {
            var host = Host;
            if (host == null)
                return;

            var supervisors = Supervisors();
            lock (host.Gate)
            {
                var running = supervisors.FirstOrDefault(s => s.InstallRunning);
                foreach (var supervisor in supervisors.Where(s => s.InstallWaiting))
                {
                    if (running == null)
                    {
                        supervisor.StartInstall();
                        running = supervisor;
                    }
                    else
                        supervisor.WaitForInstall(Label(running));
                }
            }
        }

        static string Label(DevSupervisor supervisor)
        {
            return supervisor.IsMain ? "main" : supervisor.Workspace;
        }

        /// <summary>
        /// Starts every queued run, of all checkouts in the order they were queued, that conflicts with no running run
        /// and no run queued before it (see TestRunner.Conflicts), once its own watchers are done building (all
        /// checkouts' watchers for a perf run). A run that only waits for watchers holds back later runs of its own
        /// checkout only, unless it is a perf run.
        /// </summary>
        public static void NextRun()
        {
            var host = Host;
            if (host == null)
                return;

            var supervisors = Supervisors();
            lock (host.Gate)
            {
                if (host.ShuttingDown)
                    return;

                var runs = supervisors.SelectMany(s => s.Tests.Runs.Where(r => !r.Done).Select(r => (Supervisor: s, Run: r))).OrderBy(x => x.Run.Sequence).ToList();
                var ahead = runs.Where(x => x.Run.Running).Select(x => (x.Supervisor, x.Run, Holds: true)).ToList();
                foreach (var (supervisor, run) in runs.Where(x => x.Run.Status == "queued"))
                {
                    if (supervisor.ShuttingDown)
                        continue;

                    if (Held != null)
                    {
                        supervisor.Tests.Wait(run, $"the backend restart ({Held})");
                        continue;
                    }

                    // Without its packages a worktree runs nothing, so its runs fail now instead of waiting forever
                    var installFailure = supervisor.InstallFailure();
                    if (installFailure != null)
                    {
                        supervisor.Tests.Fail(run, "npm ci failed in this worktree; stop and start it in the supervisor to retry", installFailure);
                        continue;
                    }

                    var blocker = ahead.FirstOrDefault(x => x.Supervisor == supervisor || (x.Holds && TestRunner.Conflicts(x.Run.Access, run.Access)));
                    if (blocker.Run != null)
                    {
                        supervisor.Tests.Wait(run, $"run #{blocker.Run.Id} in {Label(blocker.Supervisor)}{(blocker.Run.Running ? "" : " (queued)")}");
                        ahead.Add((supervisor, run, true));
                        continue;
                    }

                    var watchers = supervisor.Tests.Blockers();
                    // A perf run also waits for the other checkouts' builds, which would skew its timings
                    if (run.Access == TestRunner.Machine)
                        watchers.AddRange(supervisors.Where(s => s != supervisor && !s.ShuttingDown).SelectMany(s => s.Watchers.Where(t => t.Status is "starting" or "building").Select(t => $"{Label(s)}: {t.Label}")));

                    if (watchers.Count > 0)
                    {
                        supervisor.Tests.Wait(run, string.Join(", ", watchers));
                        // A perf run keeps its place, or later runs could keep it from ever starting
                        ahead.Add((supervisor, run, run.Access == TestRunner.Machine));
                        continue;
                    }

                    // A perf run also waits for the other checkouts' rebuilds, for the same reason
                    var checkouts = run.Access == TestRunner.Machine ? supervisors.Where(s => !s.ShuttingDown) : new[] { supervisor };
                    var stale = checkouts.SelectMany(s => s.FindStaleSources().Select(source => (Supervisor: s, Stale: source))).ToList();
                    var now = DateTime.UtcNow;
                    // Also a change dated after now: it may have been saved during the scan
                    var rebuilding = stale.Where(x => (now - x.Stale.Changed).Duration() < DevSupervisor.RebuildGrace).OrderByDescending(x => x.Stale.Changed).ToList();
                    if (rebuilding.Count > 0)
                    {
                        var (owner, newest) = rebuilding[0];
                        supervisor.Tests.Wait(run, $"the rebuild after the change to {Path.GetFileName(newest.Source)}{(owner != supervisor ? $" in {Label(owner)}" : "")}");
                        supervisor.RecheckRunsAfter(rebuilding.Min(x => x.Stale.Changed) + DevSupervisor.RebuildGrace - now);
                        ahead.Add((supervisor, run, run.Access == TestRunner.Machine));
                        continue;
                    }

                    // tsc and sass still write their output on an error, so only a failed bundle or a crashed watcher leaves the
                    // last good bundle in place, which the run would test without saying so
                    var missed = stale.Where(x => x.Supervisor == supervisor).Select(x => x.Stale).ToList();
                    var broken = supervisor.Watchers.Where(t => missed.Any(m => m.Spec.Builders.Contains(t.Key) && (t.Status == "stopped" || t.Status == "error" && t.Key == m.Spec.Bundler))).ToList();
                    if (broken.Count > 0)
                    {
                        var first = missed.First(m => broken.Any(t => m.Spec.Builders.Contains(t.Key)));
                        supervisor.Tests.Fail(run, $"{string.Join(", ", broken.Select(t => $"{t.Label} ({t.Detail})"))} did not build the change to {first.Source}, so {first.Spec.Bundle} is out of date; fix the build and run again", broken.SelectMany(t => t.Problems.Select(p => $"{t.Label}: {(p.File != null ? $"{p.File}{(p.Line != null ? $":{p.Line}" : "")} " : "")}{p.Message}")));
                        continue;
                    }

                    foreach (var bundle in missed.GroupBy(m => m.Spec.Bundle))
                    {
                        foreach (var source in bundle)
                            supervisor.AcceptStale(source);

                        supervisor.Tests.Note(run, $"{string.Join(", ", bundle.Select(m => m.Source))} changed after the last build of {bundle.Key}, but no rebuild came within {DevSupervisor.RebuildGrace.TotalSeconds:0} seconds (no bundle may import {(bundle.Count() == 1 ? "it" : "them")}), so this run tests the current build");
                    }

                    supervisor.Tests.Begin(run);
                    ahead.Add((supervisor, run, true));
                }

                SaveHeldRuns(supervisors);
            }
        }

        public static DevSupervisor Running(string name)
        {
            if (string.IsNullOrEmpty(name))
                return Host;

            lock (Host.Gate)
                return known.FirstOrDefault(w => w.Name == name)?.Supervisor;
        }

        public static DevSupervisor Run(string name)
        {
            lock (Host.Gate)
                stoppedByUser.Remove(name);

            return Launch(name) ?? (Refresh() ? Launch(name) : null);
        }

        public static DevSupervisor Resume(string name)
        {
            lock (Host.Gate)
            {
                if (stoppedByUser.Contains(name))
                    return null;
            }

            return Launch(name);
        }

        static DevSupervisor Launch(string name)
        {
            var host = Host;
            DevSupervisor started;
            lock (host.Gate)
            {
                var worktree = known.FirstOrDefault(w => w.Name == name);
                if (worktree == null || host.ShuttingDown)
                    return null;

                if (worktree.Supervisor != null)
                    return worktree.Supervisor;

                started = worktree.Supervisor = DevSupervisor.ForWorktree(host, worktree.Root, worktree.Name);
            }

            started.StartAll();
            ChangedAll();
            return started;
        }

        public static void Stop(string name)
        {
            DevSupervisor stopped;
            lock (Host.Gate)
            {
                var worktree = known.FirstOrDefault(w => w.Name == name);
                stopped = worktree?.Supervisor;
                if (worktree != null)
                    worktree.Supervisor = null;

                stoppedByUser.Add(name);
            }

            stopped?.StopAll();
            ChangedAll();
        }

        public static void StopAll()
        {
            List<DevSupervisor> running;
            lock (Host.Gate)
            {
                // The worktrees' runs are cancelled below, which must not reach the held runs saved for the next backend
                stopping = true;
                running = known.Select(w => w.Supervisor).Where(s => s != null).ToList();
                known.ForEach(w => w.Supervisor = null);
            }

            watcher?.Dispose();
            sweep?.Dispose();
            running.ForEach(s => s.StopAll());
        }

        public static string NameForPath(string path)
        {
            if (string.IsNullOrEmpty(path))
                return null;

            var full = Path.GetFullPath(path);
            var match = Match(full);
            // A subfolder of the main checkout can be a worktree created since the last refresh
            if (match == null && !SamePath(full, Host.Root) && Refresh())
                match = Match(full);

            return match?.Name;
        }

        /// <summary>
        /// Says why a path that matches no worktree cannot run in the main checkout either: it lies in a worktree that
        /// Refresh skipped, or outside the repository. Null when the path belongs to the main checkout.
        /// </summary>
        public static string Unknown(string path)
        {
            if (string.IsNullOrEmpty(path))
                return null;

            var full = Path.GetFullPath(path);
            lock (Host.Gate)
            {
                var hit = skipped.Where(s => IsUnder(full, s.Key)).OrderByDescending(s => s.Key.Length).FirstOrDefault();
                if (hit.Key != null)
                    return $"the dev supervisor skips the worktree {hit.Key} because {hit.Value}; move it to a folder with another name";
            }

            return IsUnder(full, Host.Root) ? null : $"{full} is not the main checkout or one of its worktrees";
        }

        static Worktree Match(string path)
        {
            lock (Host.Gate)
                return known.Where(w => IsUnder(path, w.Root)).OrderByDescending(w => w.Root.Length).FirstOrDefault();
        }

        static bool IsUnder(string path, string root)
        {
            var trimmed = root.TrimEnd(Path.DirectorySeparatorChar);
            return SamePath(path, trimmed) || path.StartsWith(trimmed + Path.DirectorySeparatorChar, PathComparison);
        }

        static bool SamePath(string a, string b)
        {
            return a.TrimEnd(Path.DirectorySeparatorChar).Equals(b.TrimEnd(Path.DirectorySeparatorChar), PathComparison);
        }

        public static bool Refresh()
        {
            var host = Host;
            var found = List(host.Root);
            if (found == null)
                return false;

            var reserved = new HashSet<string>(Reserved, StringComparer.OrdinalIgnoreCase);
            var hostWebRoot = Path.Combine(host.Root, WebRoot);
            if (Directory.Exists(hostWebRoot))
                reserved.UnionWith(Directory.EnumerateFileSystemEntries(hostWebRoot).Select(Path.GetFileName));

            List<DevSupervisor> removed;
            lock (host.Gate)
            {
                var next = new List<Worktree>();
                var nextSkipped = new Dictionary<string, string>();
                foreach (var entry in found)
                {
                    if (SamePath(entry.Root, host.Root))
                    {
                        hostBranch = entry.Branch;
                        continue;
                    }

                    if (entry.Name.Length == 0 || reserved.Contains(entry.Name) || next.Any(w => w.Name == entry.Name))
                    {
                        nextSkipped[entry.Root] = $"the name {entry.Name} is taken";
                        Console.WriteLine($"[worktrees] skipped {entry.Root}: {nextSkipped[entry.Root]}");
                        continue;
                    }

                    entry.Supervisor = known.FirstOrDefault(w => SamePath(w.Root, entry.Root))?.Supervisor;
                    next.Add(entry);
                }

                removed = known.Select(w => w.Supervisor).Where(s => s != null && next.All(w => w.Supervisor != s)).ToList();
                known = next;
                skipped = nextSkipped;
            }

            removed.ForEach(s => s.StopAll());
            // Changes in a worktree count from the moment it is found, not from when someone opens the Live view
            foreach (var worktree in Known)
                Live.Track(worktree.Name, worktree.Root);

            ChangedAll();
            return true;
        }

        static List<Worktree> List(string root)
        {
            var (exitCode, output) = DevSupervisor.Capture("git", "-C", root, "worktree", "list", "--porcelain");
            if (exitCode != 0)
                return null;

            var worktrees = new List<Worktree>();
            foreach (var block in Regex.Split(output.Replace("\r", ""), @"\n\s*\n"))
            {
                var lines = block.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                var path = lines.FirstOrDefault(l => l.StartsWith("worktree "))?["worktree ".Length..];
                if (path == null || lines.Any(l => l == "bare" || l.StartsWith("prunable")))
                    continue;

                var full = Path.GetFullPath(path);
                if (!Directory.Exists(full))
                    continue;

                var branch = lines.FirstOrDefault(l => l.StartsWith("branch "))?["branch ".Length..].Replace("refs/heads/", "") ?? "detached";
                worktrees.Add(new Worktree { Name = NameOf(full), Root = full, Branch = branch });
            }

            return worktrees;
        }

        static string GitDirOf(string root)
        {
            var dotGit = Path.Combine(root, ".git");
            return File.Exists(dotGit) ? Regex.Match(File.ReadAllText(dotGit), @"gitdir:\s*(.+)").Groups[1].Value.Trim() : "";
        }

        static string NameOf(string root)
        {
            var gitDir = GitDirOf(root);
            var name = Path.GetFileName((gitDir.Length > 0 ? gitDir : root).TrimEnd('/', '\\'));
            return Regex.Replace(name.ToLowerInvariant(), "[^a-z0-9-]+", "-").Trim('-');
        }

        static string CommonGitDir(string root)
        {
            var dotGit = Path.Combine(root, ".git");
            if (Directory.Exists(dotGit))
                return dotGit;

            var gitDir = GitDirOf(root);
            return gitDir.Length > 0 ? Path.GetFullPath(Path.Combine(root, gitDir, "..", "..")) : null;
        }

        static void Watch(string root)
        {
            var gitDir = CommonGitDir(root);
            if (gitDir == null)
                return;

            try
            {
                watcher = new FileSystemWatcher(gitDir) { IncludeSubdirectories = true, NotifyFilter = NotifyFilters.DirectoryName };
                FileSystemEventHandler onChange = (_, e) =>
                {
                    if (e.Name?.StartsWith("worktrees", StringComparison.OrdinalIgnoreCase) == true)
                        RefreshSoon();
                };
                watcher.Created += onChange;
                watcher.Deleted += onChange;
                watcher.Renamed += (_, e) => onChange(null, e);
                watcher.Error += (_, _) => RefreshSoon();
                watcher.EnableRaisingEvents = true;
            }
            catch (Exception)
            {
            }
        }

        static void RefreshSoon()
        {
            pending?.Dispose();
            pending = new Timer(_ => Refresh(), null, 1000, Timeout.Infinite);
        }

        public static async Task<bool> TryServe(HttpContext context)
        {
            var path = context.Request.Path.Value ?? "";
            var segment = path.Split('/', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
            if (segment == null || Host == null)
                return false;

            Worktree worktree;
            lock (Host.Gate)
                worktree = known.FirstOrDefault(w => w.Name == segment);

            if (worktree == null)
                return false;

            if (worktree.Supervisor == null)
                Resume(worktree.Name);

            var rest = path[(segment.Length + 1)..];
            if (rest.Length == 0)
            {
                context.Response.Redirect($"{path}/{context.Request.QueryString}");
                return true;
            }

            var webRoot = Path.GetFullPath(Path.Combine(worktree.Root, WebRoot));
            var file = HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method) ? Resolve(webRoot, rest) : null;
            if (file == null)
            {
                // The worktree's app pages come from its own index template; its service calls go to the main backend.
                if (!HttpMethods.IsGet(context.Request.Method) || Path.GetExtension(rest).Length > 0 || !context.Request.Headers.Accept.ToString().Contains("text/html"))
                {
                    context.Request.Path = rest;
                    return false;
                }

                var template = new[] { worktree.Root, Host.Root }.Select(root => Path.Combine(root, IndexTemplate)).FirstOrDefault(File.Exists);
                if (template == null)
                    return NotFound(context);

                context.Response.Headers["Cache-Control"] = "no-store";
                context.Response.ContentType = "text/html; charset=utf-8";
                var index = await File.ReadAllTextAsync(template);
                await context.Response.WriteAsync(Regex.Replace(index, "<head>", $"<head><base href=\"/{worktree.Name}/\">", RegexOptions.IgnoreCase));
                return true;
            }

            context.Response.Headers["Cache-Control"] = "no-cache";
            context.Response.ContentType = ContentTypes.TryGetContentType(file, out var type) ? type : "application/octet-stream";
            await context.Response.SendFileAsync(file);
            return true;
        }

        static string Resolve(string webRoot, string relative)
        {
            var full = Path.GetFullPath(Path.Combine(webRoot, Uri.UnescapeDataString(relative).TrimStart('/')));
            return IsUnder(full, webRoot) && File.Exists(full) ? full : null;
        }

        static bool NotFound(HttpContext context)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return true;
        }
    }
}
