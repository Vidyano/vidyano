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
        static string hostBranch;
        static FileSystemWatcher watcher;
        static Timer pending;

        static DevSupervisor Host => DevSupervisor.Instance;

        public static void Start(DevSupervisor host)
        {
            Refresh();
            Watch(host.Root);
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

        public static void ChangedAll()
        {
            foreach (var supervisor in Supervisors())
                supervisor.Changed();
        }

        public static void NextRun()
        {
            foreach (var supervisor in Supervisors())
                supervisor.Tests.Next();
        }

        public static bool TestsRunning()
        {
            return Supervisors().Any(s => s.Tests.Runs.Any(r => r.Running));
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
                running = known.Select(w => w.Supervisor).Where(s => s != null).ToList();
                known.ForEach(w => w.Supervisor = null);
            }

            watcher?.Dispose();
            running.ForEach(s => s.StopAll());
        }

        public static string NameForPath(string path)
        {
            if (string.IsNullOrEmpty(path))
                return null;

            var full = Path.GetFullPath(path);
            var match = Match(full);
            if (match == null && !IsUnder(full, Host.Root) && Refresh())
                match = Match(full);

            return match?.Name;
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
                foreach (var entry in found)
                {
                    if (SamePath(entry.Root, host.Root))
                    {
                        hostBranch = entry.Branch;
                        continue;
                    }

                    if (entry.Name.Length == 0 || reserved.Contains(entry.Name) || next.Any(w => w.Name == entry.Name))
                    {
                        Console.WriteLine($"[worktrees] skipped {entry.Root}: the name {entry.Name} is taken");
                        continue;
                    }

                    entry.Supervisor = known.FirstOrDefault(w => SamePath(w.Root, entry.Root))?.Supervisor;
                    next.Add(entry);
                }

                removed = known.Select(w => w.Supervisor).Where(s => s != null && next.All(w => w.Supervisor != s)).ToList();
                known = next;
            }

            removed.ForEach(s => s.StopAll());
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
