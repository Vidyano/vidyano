#nullable disable

using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Serialization;

namespace Dev.Service.Supervisor
{
    public static class DevJson
    {
        public static readonly JsonSerializerSettings Settings = new() { ContractResolver = new CamelCasePropertyNamesContractResolver(), NullValueHandling = NullValueHandling.Ignore };
    }

    public record ProblemDto(string File, int? Line, int? Column, string Message, string Code)
    {
        public static ProblemDto From(Problem p) => new(p.File, p.Line, p.Column, p.Message, p.Code);
    }

    public record TaskDto(string Key, string Label, string Group, string[] After, string Status, string Detail, string Updated, long? Took, string Url, bool Once, List<ProblemDto> Problems)
    {
        public static TaskDto From(SupervisorTask t) => new(t.Key, t.Label, t.Group, t.After, t.Status, t.Detail, t.Updated, t.Took, t.Url, t.Once, t.Problems.Select(ProblemDto.From).ToList());
    }

    public record LogEntryDto(long Id, string Time, string Task, string Text, string Level)
    {
        public static LogEntryDto From(LogEntry e) => new(e.Id, e.Time, e.Task, e.Text, e.Level);
    }

    public record RunFileDto(string File, string Status, long? Took)
    {
        public static RunFileDto From(RunFile f) => new(f.File, f.Status, f.Took);
    }

    public record RunDto(int Id, List<string> Flags, List<RunFileDto> Files, string Status, string QueuedAt, long? Started, long? Took, string WaitingFor, int? ExitCode, int? Total, List<JObject> Errors)
    {
        public static RunDto From(TestRun r) => new(r.Id, r.Flags, r.Files.Select(RunFileDto.From).ToList(), r.Status, r.QueuedAt, r.Started, r.Took, r.WaitingFor, r.ExitCode, r.Total, r.Errors);
    }

    public record RunTestDto(int RunId, string Id, string Title, string File, int Line, int Column, string Spec, string Status, double? Duration, long? Ended, JArray Errors)
    {
        public static RunTestDto From(RunTest t) => new(t.RunId, t.Id, t.Title, t.File, t.Line, t.Column, t.Spec, t.Status, t.Duration, t.Ended, t.Errors);
    }

    public record CatalogTestDto(string Id, string Title, string File, int Line, int Column)
    {
        public static CatalogTestDto From(CatalogTest t) => new(t.Id, t.Title, t.File, t.Line, t.Column);
    }

    public record CatalogEntryDto(string File, string Status, List<CatalogTestDto> Tests);

    public record SpecRootDto(string Name, string Path);

    public record StateDto(string Instance, string Workspace, List<WorkspaceDto> Workspaces, long Version, List<TaskDto> Tasks, List<LogEntryDto> Log, List<int> RunIds, List<RunDto> Runs, List<RunTestDto> Tests, List<CatalogEntryDto> Catalog, List<SpecRootDto> SpecRoots, List<string> SpecFiles, List<string> Blockers)
    {
        public static StateDto Snapshot(DevSupervisor supervisor, long since, long logAfter)
        {
            var workspaces = Worktrees.Known.Select(w => new WorkspaceDto(w.Name, w.Branch, w.Root, w.Supervisor != null)).Prepend(new WorkspaceDto(null, Worktrees.HostBranch, supervisor.Host.Root, true)).ToList();
            lock (supervisor.Gate)
            {
                var tests = supervisor.Tests;
                return new StateDto(
                    supervisor.InstanceId,
                    supervisor.Workspace,
                    workspaces,
                    supervisor.Version,
                    supervisor.ViewTasks.Select(TaskDto.From).ToList(),
                    supervisor.LogAfter(logAfter).Select(LogEntryDto.From).ToList(),
                    tests.Runs.Select(r => r.Id).ToList(),
                    tests.Runs.Where(r => r.Version > since).Select(RunDto.From).ToList(),
                    tests.Runs.SelectMany(r => r.Tests).Where(t => t.Version > since).Select(RunTestDto.From).ToList(),
                    tests.Catalog.Where(c => c.Value.Version > since).Select(c => new CatalogEntryDto(c.Key, c.Value.Status, c.Value.Tests.Select(CatalogTestDto.From).ToList())).ToList(),
                    TestRunner.SpecRoots.Select(r => new SpecRootDto(r.Name, r.Path)).ToList(),
                    tests.SpecFilesVersion > since ? tests.SpecFiles : null,
                    tests.Blockers());
            }
        }
    }

    public record OutputLineDto(long Id, string Text);

    public record RunOutputDto(int Id, string Status, int? ExitCode, bool Done, List<OutputLineDto> Lines);

    public record StatusDto(ServiceStatusDto Server, List<TaskDto> Tasks);

    public record ServiceStatusDto(string Status, string Url);

    public record RunRequest(List<string> Args, string Cwd, bool Follow);

    public record RunCreatedDto(int Id, string Workspace);

    public record ErrorDto(string Error);

    public record ActiveRunDto(string Workspace, int Id, string Status);

    public record BusyDto(List<ActiveRunDto> Runs);

    public record WorkspaceDto(string Name, string Branch, string Root, bool Running);

    public record WorkspaceRequest(string Name, string Action);

    public record RunIdRequest(int? Id);

    public record LoadTestsRequest(string File, bool Refresh);

    public record OpenRequest(string File, int? Line, int? Column);
}
