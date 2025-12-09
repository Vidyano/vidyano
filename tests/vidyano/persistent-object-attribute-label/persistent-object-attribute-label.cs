#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using Vidyano.Core.Services;
using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithDefaultAdmin()
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Items))
    .WithModel(builder =>
    {
        var po = builder.GetOrCreatePersistentObject(nameof(Mock_Item));

        // String attribute
        var stringAttr = po.GetOrCreateAttribute(nameof(Mock_Item.String));
        stringAttr.DataType = "String";

        // Required attribute
        var requiredAttr = po.GetOrCreateAttribute(nameof(Mock_Item.RequiredString));
        requiredAttr.DataType = "String";
        requiredAttr.Rules = "NotEmpty";

        // Read-only attribute
        var readOnlyAttr = po.GetOrCreateAttribute(nameof(Mock_Item.ReadOnlyString));
        readOnlyAttr.DataType = "String";
        readOnlyAttr.IsReadOnly = true;

        // String with tooltip
        var toolTipAttr = po.GetOrCreateAttribute(nameof(Mock_Item.StringWithToolTip));
        toolTipAttr.DataType = "String";
        toolTipAttr.SetToolTip("This is a helpful tooltip message");
    })
);

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Item> items = [];

    public MockContext()
    {
        Register(items);
    }

    public IQueryable<Mock_Item> Items => Query<Mock_Item>();

    public static Mock_Item GetOrCreateItem(string objectId)
    {
        var item = items.FirstOrDefault(a => a.Id == objectId);

        if (item == null)
            items.Add(item = new Mock_Item { Id = objectId });

        return item;
    }

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is Mock_Item item)
            item.Id ??= (items.Count + 1).ToString();

        base.AddObject(obj, entity);
    }
}

public class MockWeb : CustomApiController
{
    public override void GetWebsiteContent(WebsiteArgs args)
    {
        base.GetWebsiteContent(args);

        var frontEndUrl = ServiceLocator.GetService<IConfiguration>()["frontend:url"];
        if (!string.IsNullOrEmpty(frontEndUrl))
            args.Contents = args.Contents.Replace("https://unpkg.com/@vidyano/vidyano/index.min.js", frontEndUrl);
    }
}

public class Mock_ItemActions(MockContext context) : PersistentObjectActions<MockContext, Mock_Item>(context)
{
    public override Mock_Item? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateItem(obj.ObjectId);
    }
}

public class Mock_Item
{
    public string Id { get; set; } = null!;

    public string? String { get; set; } = "Test String";
    public string? RequiredString { get; set; } = null;
    public string? ReadOnlyString { get; set; } = "Read Only Value";
    public string? StringWithToolTip { get; set; } = "Has Tooltip";
}
