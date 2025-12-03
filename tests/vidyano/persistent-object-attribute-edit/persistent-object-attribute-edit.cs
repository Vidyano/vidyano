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
    .WithMenuItem(nameof(MockContext.Attributes))
    .WithModel(builder =>
    {
        var po = builder.GetOrCreatePersistentObject(nameof(Mock_Attribute));

        // Configure Name attribute (basic editable string)
        var name = po.GetOrCreateAttribute(nameof(Mock_Attribute.Name));
        name.DataType = "String";

        // Configure ReadOnlyName attribute
        var readOnlyName = po.GetOrCreateAttribute(nameof(Mock_Attribute.ReadOnlyName));
        readOnlyName.DataType = "String";
        readOnlyName.IsReadOnly = true;

        // Configure NameWithActions attribute
        var nameWithActions = po.GetOrCreateAttribute(nameof(Mock_Attribute.NameWithActions));
        nameWithActions.DataType = "String";

        // Configure NameWithError attribute
        var nameWithError = po.GetOrCreateAttribute(nameof(Mock_Attribute.NameWithError));
        nameWithError.DataType = "String";

        // Configure ReadOnlyNameWithError attribute
        var readOnlyNameWithError = po.GetOrCreateAttribute(nameof(Mock_Attribute.ReadOnlyNameWithError));
        readOnlyNameWithError.DataType = "String";
        readOnlyNameWithError.IsReadOnly = true;

        var testAction = builder.GetOrCreateCustomAction(nameof(TestAction));
        testAction.ShowedOn = ShowedOn.PersistentObject;

        var administrators = builder.GetOrCreateGroup("Administrators");
        administrators.AddUserRight($"{nameof(TestAction)}/Mock.{nameof(Mock_Attribute)}");
    })
);

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Attribute> attributes = [];

    public MockContext()
    {
        Register(attributes);
    }

    public IQueryable<Mock_Attribute> Attributes => Query<Mock_Attribute>();

    public static Mock_Attribute GetOrCreateAttribute(string objectId)
    {
        var attribute = attributes.FirstOrDefault(a => a.Id == objectId);

        if (attribute == null)
            attributes.Add(attribute = new Mock_Attribute { Id = objectId });

        return attribute;
    }

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is Mock_Attribute attribute)
            attribute.Id ??= (attributes.Count + 1).ToString();

        base.AddObject(obj, entity);
    }
}

public class MockWeb: CustomApiController
{
    public override void GetWebsiteContent(WebsiteArgs args)
    {
        base.GetWebsiteContent(args);

        var frontEndUrl = ServiceLocator.GetService<IConfiguration>()["frontend:url"];
        if (!string.IsNullOrEmpty(frontEndUrl))
            args.Contents = args.Contents.Replace("https://unpkg.com/@vidyano/vidyano/index.min.js", frontEndUrl);
    }
}

public class Mock_AttributeActions(MockContext context) : PersistentObjectActions<MockContext, Mock_Attribute>(context)
{
    public override Mock_Attribute? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateAttribute(obj.ObjectId);
    }

    public override void OnConstruct(PersistentObject obj)
    {
        base.OnConstruct(obj);

        obj.GetAttribute(nameof(Mock_Attribute.NameWithActions)).Actions = ["TestAction"];
        obj.GetAttribute(nameof(Mock_Attribute.NameWithError)).ValidationError = "This field has an error";
        obj.GetAttribute(nameof(Mock_Attribute.ReadOnlyNameWithError)).ValidationError = "Read-only field error";
    }
}

public class Mock_Attribute
{
    public string Id { get; set; } = null!;

    public string? Name { get; set; } = "Test Name";

    public string? ReadOnlyName { get; set; } = "Read Only Value";

    public string? NameWithActions { get; set; } = "Has Actions";

    public string? NameWithError { get; set; } = "Has Error";

    public string? ReadOnlyNameWithError { get; set; } = "Read Only With Error";
}

public class TestAction (MockContext context): CustomAction<MockContext>(context)
{
    public override PersistentObject? Execute(CustomActionArgs e)
    {
        return Notification("Hello, World!", NotificationType.OK);
    }
}