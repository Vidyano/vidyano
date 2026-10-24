#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

// A query the client can refresh; the spec sends the Refresh client operation itself.

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
    })
);

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Ticket> tickets =
    [
        new Mock_Ticket { Id = "1", Title = "First" },
        new Mock_Ticket { Id = "2", Title = "Second" }
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
