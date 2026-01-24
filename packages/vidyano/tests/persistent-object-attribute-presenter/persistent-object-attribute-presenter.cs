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

        // Numeric attribute (Int32)
        var intAttr = po.GetOrCreateAttribute(nameof(Mock_Item.Integer));
        intAttr.DataType = "Int32";

        // Numeric attribute (Decimal)
        var decimalAttr = po.GetOrCreateAttribute(nameof(Mock_Item.Decimal));
        decimalAttr.DataType = "Decimal";

        // DateTime attribute
        var dateTimeAttr = po.GetOrCreateAttribute(nameof(Mock_Item.DateTime));
        dateTimeAttr.DataType = "DateTime";

        // Boolean attribute (YesNo)
        var boolAttr = po.GetOrCreateAttribute(nameof(Mock_Item.Boolean));
        boolAttr.DataType = "YesNo";

        // NullableBoolean attribute
        var nullableBoolAttr = po.GetOrCreateAttribute(nameof(Mock_Item.NullableBoolean));
        nullableBoolAttr.DataType = "NullableBoolean";

        // Guid attribute (renders as String)
        var guidAttr = po.GetOrCreateAttribute(nameof(Mock_Item.Guid));
        guidAttr.DataType = "Guid";

        // Required attribute
        var requiredAttr = po.GetOrCreateAttribute(nameof(Mock_Item.RequiredString));
        requiredAttr.DataType = "String";
        requiredAttr.Rules = "NotEmpty"; // Will mark attribute as required

        // Read-only attribute
        var readOnlyAttr = po.GetOrCreateAttribute(nameof(Mock_Item.ReadOnlyString));
        readOnlyAttr.DataType = "String";
        readOnlyAttr.IsReadOnly = true;

        // Attribute with nolabel type hint
        var noLabelAttr = po.GetOrCreateAttribute(nameof(Mock_Item.NoLabelString));
        noLabelAttr.DataType = "String";
        noLabelAttr.DataTypeHints = "nolabel=true";

        // Attribute with nonedit type hint
        var nonEditAttr = po.GetOrCreateAttribute(nameof(Mock_Item.NonEditString));
        nonEditAttr.DataType = "String";
        nonEditAttr.DataTypeHints = "nonedit=true";

        // Hidden attribute
        var hiddenAttr = po.GetOrCreateAttribute(nameof(Mock_Item.HiddenString));
        hiddenAttr.DataType = "String";
        hiddenAttr.Visibility = AttributeVisibility.Never;
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

    // Basic types
    public string? String { get; set; } = "Test String";
    public int Integer { get; set; } = 42;
    public decimal Decimal { get; set; } = 123.45m;
    public DateTime DateTime { get; set; } = new DateTime(2024, 1, 15, 10, 30, 0);
    public bool Boolean { get; set; } = true;
    public bool? NullableBoolean { get; set; } = null;
    public Guid Guid { get; set; } = System.Guid.Parse("12345678-1234-1234-1234-123456789012");

    // State test attributes
    public string? RequiredString { get; set; } = null;
    public string? ReadOnlyString { get; set; } = "Read Only Value";
    public string? NoLabelString { get; set; } = "No Label";
    public string? NonEditString { get; set; } = "Non Edit";
    public string? HiddenString { get; set; } = "Hidden";
}
