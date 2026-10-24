#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

// A query the client can refresh, on its own and as the detail query of a project; the spec sends the Refresh client operation itself.

using Vidyano.Service;
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

        builder.GetOrCreatePersistentObject(nameof(Mock_Project));
        builder.AddDetailQuery(nameof(Mock_Project), nameof(Mock_TicketActions.Project_Tickets));
    })
);

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Project> projects =
    [
        new Mock_Project { Id = "1", Name = "Project" }
    ];

    private static readonly List<Mock_Ticket> tickets =
    [
        new Mock_Ticket { Id = "1", Title = "First", ProjectId = "1" },
        new Mock_Ticket { Id = "2", Title = "Second", ProjectId = "1" }
    ];

    public MockContext()
    {
        Register(projects);
        Register(tickets);
    }

    public IQueryable<Mock_Project> Projects => Query<Mock_Project>();

    public IQueryable<Mock_Ticket> Tickets => Query<Mock_Ticket>();
}

public class Mock_TicketActions(MockContext context) : PersistentObjectActions<MockContext, Mock_Ticket>(context)
{
    public IEnumerable<Mock_Ticket> Project_Tickets(CustomQueryArgs args)
    {
        args.EnsureParent(nameof(Mock_Project));

        return Context.Tickets.Where(t => t.ProjectId == args.Parent.ObjectId);
    }
}

public class Mock_Project
{
    public string Id { get; set; } = string.Empty;

    public string? Name { get; set; }
}

public class Mock_Ticket
{
    public string Id { get; set; } = string.Empty;

    public string? Title { get; set; }

    public string? ProjectId { get; set; }
}
