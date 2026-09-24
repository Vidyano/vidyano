#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

// A queued client operation is the only way an ordinary action can tell the client to run another one.
// A streaming action cannot return a notification, so it finishes by putting one on the dialog instead.

using Vidyano.Service;
using Vidyano.Service.ClientOperations;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithDefaultAdmin()
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Tickets))
    .WithModel(builder =>
    {
        var po = builder.GetOrCreatePersistentObject(nameof(Mock_Ticket));

        var title = po.GetOrCreateAttribute(nameof(Mock_Ticket.Title));
        title.DataType = "String";

        var confirm = builder.GetOrCreateCustomAction(nameof(Confirm));
        confirm.ShowedOn = ShowedOn.Query;

        var runIt = builder.GetOrCreateCustomAction(nameof(RunIt));
        runIt.ShowedOn = ShowedOn.Query;

        var streamThenAct = builder.GetOrCreateCustomAction(nameof(StreamThenAct));
        streamThenAct.ShowedOn = ShowedOn.Query;

        var flag = builder.GetOrCreateCustomAction(nameof(Flag));
        flag.ShowedOn = ShowedOn.Query;

        var administrators = builder.GetOrCreateGroup("Administrators");
        administrators.AddUserRight($"{nameof(Confirm)}/Mock.{nameof(Mock_Ticket)}");
        administrators.AddUserRight($"{nameof(RunIt)}/Mock.{nameof(Mock_Ticket)}");
        administrators.AddUserRight($"{nameof(StreamThenAct)}/Mock.{nameof(Mock_Ticket)}");
        administrators.AddUserRight($"{nameof(Flag)}/Mock.{nameof(Mock_Ticket)}");
    })
);

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Ticket> tickets =
    [
        new Mock_Ticket { Id = "1", Title = "First" }
    ];

    public MockContext()
    {
        Register(tickets);
    }

    public IQueryable<Mock_Ticket> Tickets => Query<Mock_Ticket>();
}

public class Mock_Ticket
{
    public string Id { get; set; } = string.Empty;

    public string? Title { get; set; }
}

public class Confirm(MockContext context) : CustomAction<MockContext>(context)
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        var retry = Manager.Current.RetryResult;

        // RetryAction unwinds, so the second call into Execute is the one carrying an answer.
        if (retry is null)
            Manager.Current.RetryAction("Confirm", "Run the streaming action?", null, ["Yes", "No"], 0, 1);

        if (retry is { Option: "Yes" })
            Manager.Current.QueueClientOperation(new ExecuteActionOperation(e.Query!, nameof(RunIt)));

        return null;
    }
}

public class RunIt(MockContext context, StreamingActionStream stream, IServiceProvider serviceProvider, IAuthenticatedRequest authenticatedRequest)
    : AsyncStreamingAction<MockContext>(context, stream, serviceProvider, authenticatedRequest)
{
    public override async Task ExecuteAsync(StreamingActionArgs e)
    {
        await e.SendMessage("Working");
        await Task.Delay(TimeSpan.FromSeconds(1));
        await e.UpdateDialog(new StreamingDialogOptions { ["notification"] = "All done", ["notificationType"] = "OK" });
    }
}

// A client operation can also travel as a stream frame, which the client has to recognise rather than render.
public class StreamThenAct(MockContext context, StreamingActionStream stream, IServiceProvider serviceProvider, IAuthenticatedRequest authenticatedRequest)
    : AsyncStreamingAction<MockContext>(context, stream, serviceProvider, authenticatedRequest)
{
    public override async Task ExecuteAsync(StreamingActionArgs e)
    {
        await e.SendMessage("Working");
        await e.SendClientOperation(new ExecuteActionOperation(e.Query!, nameof(Flag)));
        await e.UpdateDialog(new StreamingDialogOptions { ["notification"] = "All done", ["notificationType"] = "OK" });
    }
}

public class Flag(MockContext context) : CustomAction<MockContext>(context)
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        Context.Tickets.First().Title = "Flagged";

        return null;
    }
}
