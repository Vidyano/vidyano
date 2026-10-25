#nullable disable

using Microsoft.AspNetCore.StaticFiles;
using Newtonsoft.Json;

namespace Dev.Service.Supervisor
{
    /// <summary>
    /// Serves the dev supervisor page at /supervisor/ and its API at /api/supervisor/, to local requests only.
    /// </summary>
    public static class SupervisorApi
    {
        const string PageRoot = "dev/Supervisor";

        static readonly FileExtensionContentTypeProvider ContentTypes = new();

        public static async Task<bool> TryServe(HttpContext context)
        {
            var path = context.Request.Path;
            var page = path.StartsWithSegments("/supervisor", out var pageRest);
            if (!page && !path.StartsWithSegments("/api/supervisor", out _))
                return false;

            var main = DevSupervisor.Instance;
            if (main == null || !DevSupervisor.IsLocalRequest(context))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return true;
            }

            if (page)
                await ServePage(context, main, pageRest.Value ?? "");
            else
                await ServeApi(context, main);

            return true;
        }

        static async Task ServePage(HttpContext context, DevSupervisor main, string rest)
        {
            if (rest.Length == 0)
            {
                context.Response.Redirect($"/supervisor/{context.Request.QueryString}");
                return;
            }

            var root = Path.GetFullPath(Path.Combine(main.Root, PageRoot));
            var file = Path.GetFullPath(Path.Combine(root, rest == "/" ? "index.html" : Uri.UnescapeDataString(rest).TrimStart('/')));
            if (!file.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || !File.Exists(file))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            context.Response.Headers.CacheControl = "no-store";
            context.Response.ContentType = ContentTypes.TryGetContentType(file, out var type) ? type : "application/octet-stream";
            await context.Response.SendFileAsync(file);
        }

        static async Task ServeApi(HttpContext context, DevSupervisor main)
        {
            var action = context.Request.Path.Value?.Split('/', StringSplitOptions.RemoveEmptyEntries).ElementAtOrDefault(2)?.ToLowerInvariant();
            var post = HttpMethods.IsPost(context.Request.Method);
            if (!post && !HttpMethods.IsGet(context.Request.Method))
            {
                context.Response.StatusCode = StatusCodes.Status405MethodNotAllowed;
                return;
            }

            switch (post, action)
            {
                case (false, "status"):
                    await Status(context, main);
                    return;
                case (false, "busy"):
                    await Json(context, new BusyDto(Worktrees.ActiveRuns(), Worktrees.Held, main.InstanceId));
                    return;
                case (false, "lit"):
                    await LitHtml(context, main);
                    return;
                case (false, "live"):
                    await Json(context, Live.Snapshot());
                    return;
                case (true, "workspace"):
                    Workspace(context, await ReadBody<WorkspaceRequest>(context));
                    return;
                case (true, "hold"):
                    Worktrees.Hold((await ReadBody<HoldRequest>(context))?.Reason);
                    context.Response.StatusCode = StatusCodes.Status204NoContent;
                    return;
                case (true, "run"):
                    await Run(context, context.Request.Query["workspace"], await ReadBody<RunRequest>(context));
                    return;
                // Opening a file needs only the checkout's folder, not its supervisor, which a stopped worktree would start
                case (true, "open"):
                case (true, "diff"):
                    var request = await ReadBody<OpenRequest>(context);
                    string name = context.Request.Query["workspace"];
                    var root = string.IsNullOrEmpty(name) ? main.Root : Worktrees.Known.FirstOrDefault(w => w.Name == name)?.Root;
                    if (string.IsNullOrEmpty(request?.File) || root == null)
                        context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    else
                    {
                        if (action == "open")
                            DevSupervisor.OpenInEditor(root, request.File, request.Line, request.Column);
                        else
                            DevSupervisor.OpenDiff(root, request.File);

                        context.Response.StatusCode = StatusCodes.Status204NoContent;
                    }
                    return;
            }

            string workspace = context.Request.Query["workspace"];
            var supervisor = Worktrees.Running(workspace) ?? Worktrees.Resume(workspace);
            if (supervisor == null)
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            switch (post, action)
            {
                case (false, "state"):
                    await State(context, supervisor);
                    break;
                case (false, "output"):
                    await Output(context, supervisor);
                    break;
                case (true, "cancel"):
                    await Cancel(context, supervisor, await ReadBody<RunIdRequest>(context));
                    break;
                case (true, "load-tests"):
                    var load = await ReadBody<LoadTestsRequest>(context);
                    if (string.IsNullOrEmpty(load?.File))
                        context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    else
                    {
                        supervisor.Tests.LoadTests(load.File, load.Refresh);
                        context.Response.StatusCode = StatusCodes.Status204NoContent;
                    }
                    break;
                case (true, "clear-log"):
                    supervisor.ClearLog();
                    context.Response.StatusCode = StatusCodes.Status204NoContent;
                    break;
                default:
                    context.Response.StatusCode = StatusCodes.Status404NotFound;
                    break;
            }
        }

        static async Task Run(HttpContext context, string workspace, RunRequest request)
        {
            var name = string.IsNullOrEmpty(workspace) ? Worktrees.NameForPath(request?.Cwd) : workspace;
            // Never fall through to the main checkout's specs and build for a cwd that is not the main checkout
            var unknown = name == null ? Worktrees.Unknown(request?.Cwd) : null;
            if (unknown != null)
            {
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                await Json(context, new ErrorDto(unknown));
                return;
            }

            var supervisor = name == null ? DevSupervisor.Instance : Worktrees.Run(name);
            if (supervisor == null)
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            var run = supervisor.Tests.CreateRun(request?.Args ?? new List<string>(), request?.Follow == true, request?.Key);
            await Json(context, new RunCreatedDto(run.Id, supervisor.Workspace, supervisor.InstanceId, DevSupervisor.Instance.InstanceId));
        }

        static void Workspace(HttpContext context, WorkspaceRequest request)
        {
            if (string.IsNullOrEmpty(request?.Name))
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            switch (request.Action)
            {
                case "start":
                    context.Response.StatusCode = Worktrees.Run(request.Name) != null ? StatusCodes.Status204NoContent : StatusCodes.Status404NotFound;
                    break;
                case "stop":
                    Worktrees.Stop(request.Name);
                    context.Response.StatusCode = StatusCodes.Status204NoContent;
                    break;
                default:
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    break;
            }
        }

        static async Task State(HttpContext context, DevSupervisor supervisor)
        {
            var query = context.Request.Query;
            var current = query["instance"] == supervisor.InstanceId;
            var since = current && long.TryParse(query["since"], out var version) ? version : 0;
            var log = current && long.TryParse(query["log"], out var logId) ? logId : 0;

            if (supervisor.Version <= since)
            {
                await supervisor.WaitForChange(since, TimeSpan.FromSeconds(20));
                await Task.Delay(100);
            }

            await Json(context, StateDto.Snapshot(supervisor, since, log));
        }

        static async Task Status(HttpContext context, DevSupervisor supervisor)
        {
            List<TaskDto> tasks;
            lock (supervisor.Gate)
                tasks = supervisor.Tasks.Select(TaskDto.From).ToList();

            await Json(context, new StatusDto(new ServiceStatusDto("ok", DevSupervisor.ServerUrl), tasks));
        }

        // lit-html and its directives, under one path: a directive imports ../lit-html.js, which must be the module the
        // page imported, or it renders with a second copy
        static async Task LitHtml(HttpContext context, DevSupervisor supervisor)
        {
            var package = Path.GetFullPath(Path.Combine(supervisor.Root, "node_modules", "lit-html"));
            var path = string.Join('/', context.Request.Path.Value.Split('/', StringSplitOptions.RemoveEmptyEntries).Skip(3));
            var file = Path.GetFullPath(Path.Combine(package, path));
            if (!file.StartsWith(package + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || !file.EndsWith(".js") || !File.Exists(file))
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            context.Response.ContentType = "text/javascript";
            await context.Response.SendFileAsync(file);
        }

        static async Task Output(HttpContext context, DevSupervisor supervisor)
        {
            var query = context.Request.Query;
            var run = int.TryParse(query["id"], out var id) ? supervisor.Tests.FindRun(id) : null;
            if (run == null)
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            var after = long.TryParse(query["after"], out var afterId) ? afterId : -1;
            RunOutputDto output;
            lock (supervisor.Gate)
            {
                run.LastPolled = Environment.TickCount64;
                output = new RunOutputDto(run.Id, supervisor.InstanceId, run.Status, run.ExitCode, run.Done, run.Output.Where(l => l.Id > after).Select(l => new OutputLineDto(l.Id, l.Text)).ToList());
            }

            await Json(context, output);
        }

        static async Task Cancel(HttpContext context, DevSupervisor supervisor, RunIdRequest request)
        {
            // A run id of another backend instance is another run: ids start at 1 again after a restart
            var id = request?.Instance == null || request.Instance == supervisor.InstanceId ? request?.Id : -1;
            TestRun run;
            lock (supervisor.Gate)
                run = request?.Id != null ? supervisor.Tests.Runs.FirstOrDefault(r => r.Id == id) : supervisor.Tests.Runs.FirstOrDefault(r => r.Status == "running") ?? supervisor.Tests.Runs.FirstOrDefault(r => r.Status == "queued");

            if (run == null)
            {
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            supervisor.Tests.Cancel(run);
            await Json(context, new RunIdRequest(run.Id));
        }

        static async Task<T> ReadBody<T>(HttpContext context)
        {
            using var reader = new StreamReader(context.Request.Body);
            var body = await reader.ReadToEndAsync();
            return string.IsNullOrWhiteSpace(body) ? default : JsonConvert.DeserializeObject<T>(body, DevJson.Settings);
        }

        static async Task Json(HttpContext context, object value)
        {
            context.Response.Headers.CacheControl = "no-store";
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonConvert.SerializeObject(value, DevJson.Settings));
        }
    }
}
